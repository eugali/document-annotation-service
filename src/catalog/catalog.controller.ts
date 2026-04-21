import { Controller, Get, Put, Post, Delete, Param, Body, HttpCode } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { UpdateCatalogTypeDto, CreateEntityTypeDto, CreateFactTypeDto } from './catalog.dto';

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

  @Post('entity-types')
  async createEntityType(@Body() dto: CreateEntityTypeDto) {
    return this.catalogService.createEntityType(dto);
  }

  @Delete('entity-types/:id')
  @HttpCode(204)
  async deleteEntityType(@Param('id') id: string) {
    await this.catalogService.deleteEntityType(id);
  }

  @Post('fact-types')
  async createFactType(@Body() dto: CreateFactTypeDto) {
    return this.catalogService.createFactType(dto);
  }

  @Delete('fact-types/:id')
  @HttpCode(204)
  async deleteFactType(@Param('id') id: string) {
    await this.catalogService.deleteFactType(id);
  }
}
