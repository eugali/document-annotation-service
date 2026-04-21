import { useState, useEffect, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { getExtractions } from '../api';
import type { Extractions } from '../api';

interface GraphNode {
  id: string;
  label: string;
  type: 'document' | 'entity' | 'fact';
  detail: string;
}

interface GraphLink {
  source: string;
  target: string;
  kind: 'doc-entity' | 'doc-fact' | 'fact-entity';
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

const COLORS: Record<GraphNode['type'], string> = {
  document: '#6c8cff',
  entity: '#5ce0a0',
  fact: '#ffb86c',
};

const FACT_ENTITY_COLOR = '#c084fc';

function buildGraph(data: Extractions): GraphData {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const nodeIds = new Set<string>();

  for (const doc of data.documents ?? []) {
    if (nodeIds.has(doc.id)) continue;
    nodeIds.add(doc.id);
    nodes.push({
      id: doc.id,
      label: doc.filename,
      type: 'document',
      detail: `Document: ${doc.filename} (${doc.status})`,
    });
  }

  for (const group of data.entities) {
    for (const item of group.items) {
      if (!nodeIds.has(item.id)) {
        nodeIds.add(item.id);
        nodes.push({
          id: item.id,
          label: item.name,
          type: 'entity',
          detail: `Entity [${group.type}]: ${item.name}`,
        });
      }
      for (const doc of item.documents) {
        if (nodeIds.has(doc.id)) {
          links.push({ source: doc.id, target: item.id, kind: 'doc-entity' });
        }
      }
    }
  }

  for (const group of data.facts) {
    for (const item of group.items) {
      if (!nodeIds.has(item.id)) {
        nodeIds.add(item.id);
        nodes.push({
          id: item.id,
          label: item.value.length > 40 ? `${item.value.slice(0, 40)}...` : item.value,
          type: 'fact',
          detail: `Fact [${group.type}]: ${item.value}`,
        });
      }
      for (const doc of item.documents) {
        if (nodeIds.has(doc.id)) {
          links.push({ source: doc.id, target: item.id, kind: 'doc-fact' });
        }
      }
      for (const linked of item.linkedEntities) {
        if (nodeIds.has(linked.id)) {
          links.push({ source: item.id, target: linked.id, kind: 'fact-entity' });
        }
      }
    }
  }

  return { nodes, links };
}

export function GraphTab() {
  const [graph, setGraph] = useState<GraphData>({ nodes: [], links: [] });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getExtractions();
      setGraph(buildGraph(data));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleRefresh() {
    setLoading(true);
    try {
      await load();
    } finally {
      setLoading(false);
    }
  }

  const isEmpty = graph.nodes.length === 0;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h2 style={{ marginBottom: 0 }}>Graph</h2>
        <button className="btn btn-sm" onClick={handleRefresh} disabled={loading}>
          {loading ? '...' : '\u21BB'}
        </button>
      </div>
      {error && <p className="error">{error}</p>}

      {isEmpty && <p>No extractions yet.</p>}

      {!isEmpty && (
        <>
          <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
            <span><span style={{ color: COLORS.document }}>&#9679;</span> Document</span>
            <span><span style={{ color: COLORS.entity }}>&#9679;</span> Entity</span>
            <span><span style={{ color: COLORS.fact }}>&#9679;</span> Fact</span>
            <span><span style={{ color: FACT_ENTITY_COLOR }}>&#9679;</span> Fact-Entity link</span>
          </div>
          <ForceGraph2D
            width={900}
            height={600}
            graphData={graph}
            nodeColor={(node: any) => COLORS[(node as GraphNode).type] ?? '#999'}
            nodeLabel={(node: any) => (node as GraphNode).detail}
            linkColor={(link: any) =>
              (link as GraphLink).kind === 'fact-entity' ? FACT_ENTITY_COLOR : '#999'
            }
            linkWidth={(link: any) =>
              (link as GraphLink).kind === 'fact-entity' ? 2.5 : 1
            }
          />
        </>
      )}
    </div>
  );
}
