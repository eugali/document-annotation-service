import { Module } from '@nestjs/common';
import { ExtractionsController } from './extractions.controller';
import { ExtractionsService } from './extractions.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [ExtractionsController],
  providers: [ExtractionsService, PrismaService],
})
export class ExtractionsModule {}
