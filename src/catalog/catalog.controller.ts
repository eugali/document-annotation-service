import { Controller, Get, Put, Param, Body } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { UpdateCatalogTypeDto } from './catalog.dto';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  async getCatalog() {
    return this.catalogService.getCatalog();
  }

  @Put('entity-types/:id')
  async updateEntityType(
    @Param('id') id: string,
    @Body() dto: UpdateCatalogTypeDto,
  ) {
    return this.catalogService.updateEntityType(id, dto);
  }

  @Put('fact-types/:id')
  async updateFactType(
    @Param('id') id: string,
    @Body() dto: UpdateCatalogTypeDto,
  ) {
    return this.catalogService.updateFactType(id, dto);
  }
}
