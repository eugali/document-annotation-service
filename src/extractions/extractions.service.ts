import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExtractionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getGroupedExtractions() {
    const [entityTypes, factTypes, documents] = await Promise.all([
      this.prisma.entityType.findMany({
        include: {
          entities: {
            include: {
              documents: {
                include: {
                  document: { select: { id: true, filename: true } },
                },
              },
              sources: true,
              facts: {
                include: { fact: { select: { id: true } } },
              },
            },
          },
        },
      }),
      this.prisma.factType.findMany({
        include: {
          facts: {
            include: {
              documents: {
                include: {
                  document: { select: { id: true, filename: true } },
                },
              },
              entities: {
                include: {
                  entity: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.document.findMany({
        select: { id: true, filename: true, status: true },
      }),
    ]);

    const entities = entityTypes
      .filter((et) => et.entities.length > 0)
      .map((et) => ({
        type: et.name,
        items: et.entities.map((e) => ({
          id: e.id,
          name: e.name,
          documents: e.documents.map((de) => ({
            id: de.document.id,
            filename: de.document.filename,
          })),
          sources: e.sources.map((s) => ({
            snippet: s.snippet,
            page: s.page,
            cell: s.cell,
            chunkIndex: s.chunkIndex,
          })),
          linkedFactIds: e.facts.map((fe) => fe.fact.id),
        })),
      }));

    const facts = factTypes
      .filter((ft) => ft.facts.length > 0)
      .map((ft) => ({
        type: ft.name,
        items: ft.facts.map((f) => ({
          id: f.id,
          value: f.value,
          sourceSnippet: f.sourceSnippet,
          sourcePage: f.sourcePage,
          sourceCell: f.sourceCell,
          documents: f.documents.map((df) => ({
            id: df.document.id,
            filename: df.document.filename,
          })),
          linkedEntities: f.entities.map((fe) => ({
            id: fe.entity.id,
            name: fe.entity.name,
          })),
        })),
      }));

    return { entities, facts, documents };
  }
}
