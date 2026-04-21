import { PrismaService } from '../../../prisma/prisma.service';
import { DedupedEntity, ExtractedFact, LinkingResult } from '../pipeline.types';

export async function persistResults(
  prisma: PrismaService,
  documentId: string,
  entities: DedupedEntity[],
  facts: ExtractedFact[],
  links: LinkingResult[],
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const entityIdMap = new Map<string, string>();

    for (const entity of entities) {
      const entityType = await tx.entityType.findUnique({
        where: { name: entity.typeName },
      });
      if (!entityType) continue;

      const existing = await tx.entity.findUnique({
        where: { entityTypeId_name: { entityTypeId: entityType.id, name: entity.name } },
      });

      const entityId = existing
        ? existing.id
        : (await tx.entity.create({ data: { entityTypeId: entityType.id, name: entity.name } })).id;

      entityIdMap.set(`${entity.typeName}:${entity.name}`, entityId);

      const existingLink = await tx.documentEntity.findUnique({
        where: { documentId_entityId: { documentId, entityId } },
      });
      if (!existingLink) {
        await tx.documentEntity.create({ data: { documentId, entityId } });
      }

      for (const source of entity.sources) {
        await tx.entitySource.create({
          data: {
            entityId,
            snippet: source.snippet,
            page: source.page ?? null,
            cell: source.cell ?? null,
            chunkIndex: source.chunkIndex,
          },
        });
      }
    }

    const factIds: string[] = [];

    for (const fact of facts) {
      const factType = await tx.factType.findUnique({
        where: { name: fact.typeName },
      });
      if (!factType) {
        factIds.push('');
        continue;
      }

      const created = await tx.fact.create({
        data: {
          factTypeId: factType.id,
          value: fact.value,
          sourceSnippet: fact.sourceSnippet || '',
          sourcePage: fact.sourcePage ?? null,
          sourceCell: fact.sourceCell ?? null,
        },
      });

      factIds.push(created.id);
      await tx.documentFact.create({ data: { documentId, factId: created.id } });
    }

    for (const link of links) {
      const factId = factIds[link.factIndex];
      if (!factId) continue;

      for (let i = 0; i < link.entityNames.length; i++) {
        const entityName = link.entityNames[i];
        const entityType = link.entityTypes[i];
        const entityId = entityIdMap.get(`${entityType}:${entityName}`);
        if (!entityId) continue;

        const existingFactEntity = await tx.factEntity.findUnique({
          where: { factId_entityId: { factId, entityId } },
        });
        if (!existingFactEntity) {
          await tx.factEntity.create({ data: { factId, entityId } });
        }
      }
    }
  });
}
