const GENAI_IMPROVEMENTS = [
  'Embedding-based entity deduplication instead of LLM string matching — faster, cheaper, more accurate.',
  'Per-extraction confidence scores to let reviewers prioritize low-confidence results.',
  'Relation extraction between entities (e.g. "works at", "signed by"), not just standalone items.',
  'Chunk-boundary context overlap to avoid missed extractions at split points.',
  'Incremental re-extraction: only re-run affected types when the catalog schema changes.',
];

const PLATFORM_IMPROVEMENTS = [
  'Link a single entity to multiple documents, enabling cross-document relationship mapping.',
  'User authentication and role-based access control for multi-tenant usage.',
  'Bulk operations for batch re-processing, export, or deletion of multiple documents.',
  'Real-time pipeline progress via SSE instead of polling.',
  'Full audit log tracking uploads, annotations, and re-processing per document.',
  'Failed-webhook dashboard with payload inspection and one-click retry.',
];

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h3>{title}</h3>
      <ul style={{ listStyle: 'disc', paddingLeft: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((text) => (
          <li key={text} style={{ color: 'var(--text-primary)', fontSize: 15, lineHeight: 1.5 }}>
            {text}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ImprovementsTab() {
  return (
    <div>
      <h2>System Improvements</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
        Areas where the document annotation system could be enhanced.
      </p>
      <Section title="GenAI Pipeline" items={GENAI_IMPROVEMENTS} />
      <Section title="General Platform" items={PLATFORM_IMPROVEMENTS} />
    </div>
  );
}
