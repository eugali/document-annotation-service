import { Controller, Get } from '@nestjs/common';
import { ExtractionsService } from './extractions.service';

@Controller('extractions')
export class ExtractionsController {
  constructor(private readonly extractionsService: ExtractionsService) {}

  @Get()
  async getExtractions() {
    return this.extractionsService.getGroupedExtractions();
  }
}
