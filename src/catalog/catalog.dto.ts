import { IsString, IsOptional } from 'class-validator';

export class UpdateCatalogTypeDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  prompt?: string;
}
