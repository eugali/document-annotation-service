import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { ExtractionWorkflow } from './pipeline/extraction.workflow';
import { WebhookService } from './webhook.service';
import { QUEUE_NAME, MAX_CONCURRENT_JOBS } from '../config/constants';

@Processor(QUEUE_NAME, { concurrency: MAX_CONCURRENT_JOBS })
@Injectable()
export class ProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(ProcessingProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pipeline: ExtractionWorkflow,
    private readonly webhookService: WebhookService,
  ) {
    super();
  }

  async process(job: Job<{ documentId: string }>): Promise<void> {
    const { documentId } = job.data;
    this.logger.log(`Processing document ${documentId}`);

    await this.prisma.document.update({
      where: { id: documentId },
      data: { status: 'processing' },
    });

    let pipelineError: Error | undefined;

    try {
      await this.pipeline.run(documentId);

      const doc = await this.prisma.document.findUniqueOrThrow({
        where: { id: documentId },
      });

      if (doc.status !== 'partial') {
        await this.prisma.document.update({
          where: { id: documentId },
          data: { status: 'done' },
        });
      }

      this.logger.log(
        `Document ${documentId} processed (status: ${doc.status === 'partial' ? 'partial' : 'done'})`,
      );
    } catch (error) {
      pipelineError = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(`Processing failed for ${documentId}: ${pipelineError.message}`);

      await this.prisma.document.update({
        where: { id: documentId },
        data: { status: 'failed', error: pipelineError.message },
      });
    }

    this.webhookService.notify(documentId).catch((err) => {
      this.logger.error(`Webhook notify error for ${documentId}: ${err}`);
    });

    if (pipelineError) {
      throw pipelineError;
    }
  }
}
