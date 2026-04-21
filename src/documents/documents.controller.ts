import {
  Controller,
  Post,
  Get,
  Param,
  UploadedFile,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { DocumentsService } from './documents.service';
import { validateFileType } from '../shared/file-validation.pipe';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(FileInterceptor('file', { storage: undefined }))
  async upload(@UploadedFile() file: Express.Multer.File) {
    validateFileType(file);
    return this.documentsService.createDocument(file);
  }

  @Get()
  async list() {
    return this.documentsService.findAll();
  }

  @Get(':id/annotations')
  async getAnnotations(@Param('id') id: string, @Res() res: Response) {
    const document = await this.documentsService.findById(id);
    if (!document) {
      throw new NotFoundException();
    }

    if (document.status === 'pending' || document.status === 'processing') {
      return res.status(HttpStatus.ACCEPTED).json({ status: document.status });
    }

    if (document.status === 'failed') {
      return res
        .status(HttpStatus.OK)
        .json({ status: 'failed', error: document.error });
    }

    const annotations = await this.documentsService.getAnnotations(id);
    return res.status(HttpStatus.OK).json(annotations);
  }
}
