import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CatalogService } from '../../catalog/catalog.service';
import { createExtractionWorkflow } from './create-extraction-workflow';
import {
  startExtractionEvent,
  extractionCompleteEvent,
} from './workflow-events';

@Injectable()
export class ExtractionWorkflow {
  private readonly logger = new Logger(ExtractionWorkflow.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogService: CatalogService,
  ) {}

  async run(documentId: string): Promise<void> {
    const document = await this.prisma.document.findUniqueOrThrow({
      where: { id: documentId },
    });

    const entityTypes = await this.catalogService.getEntityTypes();
    const entityTypesDef = entityTypes.map((et) => ({
      name: et.name,
      description: et.description,
      prompt: et.prompt,
    }));

    const factTypes = await this.catalogService.getFactTypes();
    const factTypesDef = factTypes.map((ft) => ({
      name: ft.name,
      description: ft.description,
      prompt: ft.prompt,
      entityLinkHint: ft.entityLinkHint ?? undefined,
    }));

    const workflow = createExtractionWorkflow();

    const ctx = workflow.createContext({
      documentId,
      prisma: this.prisma,
      entityTypes: entityTypesDef,
      factTypes: factTypesDef,
      expectedResultCount: 0,
      collectedResults: [],
    });

    this.logger.log(
      `Starting extraction workflow for document ${documentId}`,
    );

    ctx.sendEvent(
      startExtractionEvent.with({
        documentId,
        filePath: document.filePath,
        mimeType: document.mimeType,
      }),
    );

    await ctx.stream.untilEvent(extractionCompleteEvent);

    this.logger.log(
      `Extraction workflow completed for document ${documentId}`,
    );
  }
}
