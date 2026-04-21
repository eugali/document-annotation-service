import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUE_NAME } from '../config/constants';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuid } from 'uuid';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAME) private readonly queue: Queue,
  ) {}

  async createDocument(
    file: Express.Multer.File,
  ): Promise<{ id: string }> {
    const id = uuid();
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `${id}${ext}`;
    const uploadsDir = path.join(process.cwd(), 'uploads');

    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filePath = path.join(uploadsDir, filename);
    fs.writeFileSync(filePath, file.buffer);

    const document = await this.prisma.document.create({
      data: {
        id,
        filename: file.originalname,
        mimeType: file.mimetype,
        filePath,
        status: 'pending',
      },
    });

    const job = await this.queue.add(
      'process-document',
      { documentId: id },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    );

    await this.prisma.document.update({
      where: { id },
      data: { jobId: String(job.id) },
    });

    return { id: document.id };
  }

  async findById(id: string) {
    return this.prisma.document.findUnique({ where: { id } });
  }

  async getAnnotations(id: string) {
    const document = await this.prisma.document.findUnique({
      where: { id },
      include: {
        entities: {
          include: { entity: { include: { entityType: true } } },
        },
        facts: {
          include: { fact: { include: { factType: true } } },
        },
      },
    });

    if (!document) return null;

    const entities: Record<string, string[]> = {};
    for (const de of document.entities) {
      const typeName = de.entity.entityType.name;
      if (!entities[typeName]) entities[typeName] = [];
      entities[typeName].push(de.entity.name);
    }

    const facts: Record<string, string[]> = {};
    for (const df of document.facts) {
      const typeName = df.fact.factType.name;
      if (!facts[typeName]) facts[typeName] = [];
      facts[typeName].push(df.fact.value);
    }

    if (document.status === 'partial') {
      return {
        status: 'partial',
        entities,
        facts,
        error: document.error,
      };
    }

    return {
      status: 'done',
      entities,
      facts,
    };
  }
}
