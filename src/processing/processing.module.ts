import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ProcessingProcessor } from './processing.processor';
import { WebhookService } from './webhook.service';
import { ExtractionWorkflow } from './pipeline/extraction.workflow';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogModule } from '../catalog/catalog.module';
import { QUEUE_NAME } from '../config/constants';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_NAME }),
    CatalogModule,
  ],
  providers: [
    ProcessingProcessor,
    WebhookService,
    ExtractionWorkflow,
    PrismaService,
  ],
  exports: [BullModule],
})
export class ProcessingModule {}
