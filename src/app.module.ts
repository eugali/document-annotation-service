import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DocumentsModule } from './documents/documents.module';
import { ProcessingModule } from './processing/processing.module';
import { CatalogModule } from './catalog/catalog.module';
import { ExtractionsModule } from './extractions/extractions.module';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_URL?.replace('redis://', '').split(':')[0] || 'localhost',
        port: parseInt(
          process.env.REDIS_URL?.replace('redis://', '').split(':')[1] || '6379',
          10,
        ),
      },
    }),
    CatalogModule,
    DocumentsModule,
    ProcessingModule,
    ExtractionsModule,
  ],
})
export class AppModule {}
