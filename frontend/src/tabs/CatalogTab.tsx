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
      <div className="catalog-card" key={item.id}>
        <div className="catalog-card-header">
          <span className="catalog-card-name">{item.name}</span>
          <div className="catalog-card-actions">
            {saved === item.id && <span className="save-msg">Saved</span>}
            <button className="btn btn-sm" onClick={() => handleSave(kind, item)}>Save</button>
          </div>
        </div>
        <div className="catalog-card-fields">
          <div className="catalog-field">
            <label>Description</label>
            <textarea
              rows={2}
              value={item.description}
              onChange={(e) => handleChange(list, setList, item.id, 'description', e.target.value)}
            />
          </div>
          <div className="catalog-field">
            <label>Prompt</label>
            <textarea
              rows={2}
              value={item.prompt}
              onChange={(e) => handleChange(list, setList, item.id, 'prompt', e.target.value)}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2>Extraction Catalog</h2>
      {error && <p className="error">{error}</p>}

      <div className="extraction-section extraction-section--entities">
        <div className="extraction-section-header">
          <span className="annotation-badge annotation-badge--entity">E</span>
          Entity Types
        </div>
        {entityTypes.map((t) => renderCard('entity', t, entityTypes, setEntityTypes))}
      </div>

      <div className="extraction-section extraction-section--facts">
        <div className="extraction-section-header">
          <span className="annotation-badge annotation-badge--fact">F</span>
          Fact Types
        </div>
        {factTypes.map((t) => renderCard('fact', t, factTypes, setFactTypes))}
      </div>
    </div>
  );
}
