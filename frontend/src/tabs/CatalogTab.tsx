import { useState, useEffect, useCallback } from 'react';
import { getCatalog, updateEntityType, updateFactType } from '../api';
import type { CatalogType } from '../api';

export function CatalogTab() {
  const [entityTypes, setEntityTypes] = useState<CatalogType[]>([]);
  const [factTypes, setFactTypes] = useState<CatalogType[]>([]);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getCatalog();
      setEntityTypes(data.entityTypes);
      setFactTypes(data.factTypes);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleChange(
    list: CatalogType[],
    setList: (v: CatalogType[]) => void,
    id: string,
    field: 'description' | 'prompt',
    value: string,
  ) {
    setList(list.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  }

  async function handleSave(kind: 'entity' | 'fact', item: CatalogType) {
    try {
      const fn = kind === 'entity' ? updateEntityType : updateFactType;
      await fn(item.id, { description: item.description, prompt: item.prompt });
      setSaved(item.id);
      setTimeout(() => setSaved(null), 2000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    }
  }

  function renderCard(kind: 'entity' | 'fact', item: CatalogType, list: CatalogType[], setList: (v: CatalogType[]) => void) {
    return (
      <div className="card" key={item.id}>
        <h3>{item.name}</h3>
        <label>Description</label>
        <textarea
          value={item.description}
          onChange={(e) => handleChange(list, setList, item.id, 'description', e.target.value)}
        />
        <label>Prompt</label>
        <textarea
          value={item.prompt}
          onChange={(e) => handleChange(list, setList, item.id, 'prompt', e.target.value)}
        />
        <div style={{ marginTop: 8 }}>
          <button className="btn" onClick={() => handleSave(kind, item)}>Save</button>
          {saved === item.id && <span className="save-msg">Saved</span>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2>Extraction Catalog</h2>
      {error && <p className="error">{error}</p>}
      <h3 className="group-header">Entity Types</h3>
      {entityTypes.map((t) => renderCard('entity', t, entityTypes, setEntityTypes))}
      <h3 className="group-header">Fact Types</h3>
      {factTypes.map((t) => renderCard('fact', t, factTypes, setFactTypes))}
    </div>
  );
}
