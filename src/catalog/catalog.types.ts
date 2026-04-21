export interface CatalogTypeDef {
  name: string;
  description: string;
  prompt: string;
  entityLinkHint?: string;
}

export interface CatalogSeed {
  entities: CatalogTypeDef[];
  facts: CatalogTypeDef[];
}
