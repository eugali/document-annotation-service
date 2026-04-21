import { useState, useEffect, useCallback } from 'react';
import { getExtractions } from '../api';
import type { Extractions } from '../api';

export function ExtractionsTab() {
  const [data, setData] = useState<Extractions>({ entities: [], facts: [] });
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await getExtractions());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <h2>Extractions</h2>
      {error && <p className="error">{error}</p>}

      {data.entities.length === 0 && data.facts.length === 0 && <p>No extractions yet.</p>}

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
  );
}
