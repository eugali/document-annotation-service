import { useState, useEffect, useCallback } from 'react';
import { getExtractions } from '../api';
import type { Extractions } from '../api';

export function ExtractionsTab() {
  const [data, setData] = useState<Extractions>({ entities: [], facts: [], documents: [] });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await getExtractions());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleReload() {
    setLoading(true);
    try {
      await load();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h2 style={{ marginBottom: 0 }}>Extractions</h2>
        <button className="btn btn-sm" onClick={handleReload} disabled={loading}>
          {loading ? '...' : '\u21BB'}
        </button>
      </div>
      {error && <p className="error">{error}</p>}

      {data.entities.length === 0 && data.facts.length === 0 && <p>No extractions yet.</p>}

      {data.entities.length > 0 && (
        <div className="extraction-section extraction-section--entities">
          <div className="extraction-section-header">
            <span className="annotation-badge annotation-badge--entity">E</span>
            Entities
          </div>
          {data.entities.map((group) => (
            <div key={group.type}>
              <h3 className="group-header">{group.type}</h3>
              <table>
                <thead>
                  <tr><th>Entity</th><th>Found in</th></tr>
                </thead>
                <tbody>
                  {group.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td className="doc-link">
                        {item.documents.map((d) => d.filename).join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {data.facts.length > 0 && (
        <div className="extraction-section extraction-section--facts">
          <div className="extraction-section-header">
            <span className="annotation-badge annotation-badge--fact">F</span>
            Facts
          </div>
          {data.facts.map((group) => (
            <div key={group.type}>
              <h3 className="group-header">{group.type}</h3>
              <table>
                <thead>
                  <tr><th>Fact</th><th>Found in</th></tr>
                </thead>
                <tbody>
                  {group.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.value}</td>
                      <td className="doc-link">
                        {item.documents.map((d) => d.filename).join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
