import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAME } from '../config/constants';

@Controller('jobs')
export class JobsController {
  constructor(@InjectQueue(QUEUE_NAME) private readonly queue: Queue) {}

  @Get()
  async listJobs() {
    const jobs = await this.queue.getJobs([
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed',
    ]);

    return Promise.all(
      jobs.map(async (job) => ({
        jobId: job.id,
        documentId: job.data.documentId,
        state: await job.getState(),
        attemptsMade: job.attemptsMade,
        failedReason: job.failedReason ?? null,
        finishedOn: job.finishedOn ?? null,
        processedOn: job.processedOn ?? null,
        timestamp: job.timestamp,
      })),
    );
  }

  @Get(':jobId')
  async getJob(@Param('jobId') jobId: string) {
    const job = await this.queue.getJob(jobId);
    if (!job) throw new NotFoundException(`Job ${jobId} not found`);

    return {
      jobId: job.id,
      documentId: job.data.documentId,
      state: await job.getState(),
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason ?? null,
      finishedOn: job.finishedOn ?? null,
      processedOn: job.processedOn ?? null,
      timestamp: job.timestamp,
    };
  }
}
