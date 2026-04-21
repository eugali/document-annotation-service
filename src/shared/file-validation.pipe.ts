import { BadRequestException } from '@nestjs/common';
import { SUPPORTED_EXTENSIONS } from '../config/constants';
import * as path from 'path';

export function validateFileType(file: Express.Multer.File): void {
  if (!file) {
    throw new BadRequestException('File is required');
  }
  const ext = path.extname(file.originalname).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.includes(ext as (typeof SUPPORTED_EXTENSIONS)[number])) {
    throw new BadRequestException(
      `Unsupported file type "${ext}". Supported: ${SUPPORTED_EXTENSIONS.join(', ')}`,
    );
  }
}
