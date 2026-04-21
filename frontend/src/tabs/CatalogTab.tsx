import { useState, useEffect, useCallback } from 'react';
import {
  getCatalog,
  updateEntityType,
  updateFactType,
  createEntityType,
  deleteEntityType,
  createFactType,
  deleteFactType,
} from '../api';
import type { CatalogType } from '../api';

interface CreateFormState {
  name: string;
  description: string;
  prompt: string;
  entityLinkHint: string;
}

const EMPTY_FORM: CreateFormState = { name: '', description: '', prompt: '', entityLinkHint: '' };

function CreateForm({
  kind,
  onSubmit,
  onCancel,
}: {
  kind: 'entity' | 'fact';
  onSubmit: (form: CreateFormState) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<CreateFormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const update = (field: keyof CreateFormState, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const canSubmit = form.name && form.description && form.prompt && !submitting;

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await onSubmit(form);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="catalog-card" style={{ background: '#1a1a3a' }}>
      <div className="catalog-card-fields">
        <div className="catalog-field">
          <label>Name</label>
          <input value={form.name} onChange={(e) => update('name', e.target.value)} />
        </div>
        <div className="catalog-field">
          <label>Description</label>
          <textarea rows={2} value={form.description} onChange={(e) => update('description', e.target.value)} />
        </div>
        <div className="catalog-field">
          <label>Prompt</label>
          <textarea rows={2} value={form.prompt} onChange={(e) => update('prompt', e.target.value)} />
        </div>
        {kind === 'fact' && (
          <div className="catalog-field">
            <label>Entity Link Hint (optional)</label>
            <input
              value={form.entityLinkHint}
              onChange={(e) => update('entityLinkHint', e.target.value)}
              placeholder="e.g., often related to person or organization"
            />
          </div>
        )}
        <div className="catalog-card-actions">
          <button className="btn" onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? 'Creating...' : 'Create'}
          </button>
          <button className="btn btn-sm" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export function CatalogTab() {
  const [entityTypes, setEntityTypes] = useState<CatalogType[]>([]);
  const [factTypes, setFactTypes] = useState<CatalogType[]>([]);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const [showCreateEntity, setShowCreateEntity] = useState(false);
  const [showCreateFact, setShowCreateFact] = useState(false);

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

  async function handleCreate(kind: 'entity' | 'fact', form: CreateFormState) {
    try {
      if (kind === 'entity') {
        await createEntityType({ name: form.name, description: form.description, prompt: form.prompt });
        setShowCreateEntity(false);
      } else {
        await createFactType({
          name: form.name,
          description: form.description,
          prompt: form.prompt,
          entityLinkHint: form.entityLinkHint || undefined,
        });
        setShowCreateFact(false);
      }
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Create failed');
    }
  }

  async function handleDelete(kind: 'entity' | 'fact', id: string, name: string) {
    if (!confirm(`Delete "${name}"? This will permanently remove all associated extractions.`)) return;
    try {
      if (kind === 'entity') await deleteEntityType(id);
      else await deleteFactType(id);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Delete failed');
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
            <button className="btn btn-sm btn-danger" onClick={() => handleDelete(kind, item.id, item.name)}>Delete</button>
          </div>
        </div>
        <div className="catalog-card-fields">
          <div className="catalog-field">
            <label>Description</label>
            <textarea rows={3} value={item.description} onChange={(e) => handleChange(list, setList, item.id, 'description', e.target.value)} />
          </div>
          <div className="catalog-field">
            <label>Prompt</label>
            <textarea rows={3} value={item.prompt} onChange={(e) => handleChange(list, setList, item.id, 'prompt', e.target.value)} />
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
          <button className="btn btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setShowCreateEntity(!showCreateEntity)}>
            {showCreateEntity ? 'Cancel' : '+ Create'}
          </button>
        </div>
        {showCreateEntity && (
          <CreateForm kind="entity" onSubmit={(form) => handleCreate('entity', form)} onCancel={() => setShowCreateEntity(false)} />
        )}
        {entityTypes.map((t) => renderCard('entity', t, entityTypes, setEntityTypes))}
      </div>

      <div className="extraction-section extraction-section--facts">
        <div className="extraction-section-header">
          <span className="annotation-badge annotation-badge--fact">F</span>
          Fact Types
          <button className="btn btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setShowCreateFact(!showCreateFact)}>
            {showCreateFact ? 'Cancel' : '+ Create'}
          </button>
        </div>
        {showCreateFact && (
          <CreateForm kind="fact" onSubmit={(form) => handleCreate('fact', form)} onCancel={() => setShowCreateFact(false)} />
        )}
        {factTypes.map((t) => renderCard('fact', t, factTypes, setFactTypes))}
      </div>
    </div>
  );
}
