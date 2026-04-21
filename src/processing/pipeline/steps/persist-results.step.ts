import { PrismaService } from '../../../prisma/prisma.service';
import { ExtractedEntity, ExtractedFact, LinkingResult } from '../pipeline.types';

export async function persistResults(
  prisma: PrismaService,
  documentId: string,
  entities: ExtractedEntity[],
  facts: ExtractedFact[],
  _links: LinkingResult[] = [],
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    for (const entity of entities) {
      const entityType = await tx.entityType.findUnique({
        where: { name: entity.typeName },
      });
      if (!entityType) continue;

      const created = await tx.entity.create({
        data: {
          entityTypeId: entityType.id,
          name: entity.name,
        },
      });

      await tx.documentEntity.create({
        data: {
          documentId,
          entityId: created.id,
        },
      });
    }

    for (const fact of facts) {
      const factType = await tx.factType.findUnique({
        where: { name: fact.typeName },
      });
      if (!factType) continue;

      const created = await tx.fact.create({
        data: {
          factTypeId: factType.id,
          value: fact.value,
        },
      });

      await tx.documentFact.create({
        data: {
          documentId,
          factId: created.id,
        },
      });
    }
  });
}
