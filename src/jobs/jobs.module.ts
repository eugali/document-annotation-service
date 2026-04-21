import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { JobsController } from './jobs.controller';
import { QUEUE_NAME } from '../config/constants';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_NAME })],
  controllers: [JobsController],
})
export class JobsModule {}
