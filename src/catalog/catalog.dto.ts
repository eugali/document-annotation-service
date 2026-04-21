import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class UpdateCatalogTypeDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  prompt?: string;

  @IsOptional()
  @IsString()
  entityLinkHint?: string;
}

export class CreateEntityTypeDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  prompt: string;
}

export class CreateFactTypeDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  prompt: string;

  @IsOptional()
  @IsString()
  entityLinkHint?: string;
}
