import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExtractionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getGroupedExtractions() {
    const [entityTypes, factTypes] = await Promise.all([
      this.prisma.entityType.findMany({
        include: {
          entities: {
            include: {
              documents: {
                include: { document: { select: { id: true, filename: true } } },
              },
            },
          },
        },
      }),
      this.prisma.factType.findMany({
        include: {
          facts: {
            include: {
              documents: {
                include: { document: { select: { id: true, filename: true } } },
              },
            },
          },
        },
      }),
    ]);

    const entities = entityTypes
      .filter((et) => et.entities.length > 0)
      .map((et) => ({
        type: et.name,
        items: et.entities.map((e) => ({
          id: e.id,
          name: e.name,
          documents: e.documents.map((de) => ({
            id: de.document.id,
            filename: de.document.filename,
          })),
        })),
      }));

    const facts = factTypes
      .filter((ft) => ft.facts.length > 0)
      .map((ft) => ({
        type: ft.name,
        items: ft.facts.map((f) => ({
          id: f.id,
          value: f.value,
          documents: f.documents.map((df) => ({
            id: df.document.id,
            filename: df.document.filename,
          })),
        })),
      }));

    return { entities, facts };
  }
}
