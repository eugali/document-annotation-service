import { useState, useEffect, useCallback } from 'react';
import { getDocuments, uploadDocument, getAnnotations } from '../api';
import type { Document, Annotations } from '../api';

export function DocumentsTab() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [modalDoc, setModalDoc] = useState<Document | null>(null);
  const [annotations, setAnnotations] = useState<Annotations | null>(null);
  const [annotationsLoading, setAnnotationsLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setDocs(await getDocuments());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const hasPending = docs.some(d => d.status === 'pending' || d.status === 'processing');
    if (!hasPending) return;
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [docs, load]);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.elements.namedItem('file') as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      await uploadDocument(file);
      form.reset();
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleReload() {
    setLoading(true);
    try {
      await load();
    } finally {
      setLoading(false);
    }
  }

  async function openModal(doc: Document) {
    setModalDoc(doc);
    setAnnotations(null);
    setAnnotationsLoading(true);
    try {
      const data = await getAnnotations(doc.id);
      setAnnotations(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load annotations');
      setModalDoc(null);
    } finally {
      setAnnotationsLoading(false);
    }
  }

  function closeModal() {
    setModalDoc(null);
    setAnnotations(null);
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h2 style={{ marginBottom: 0 }}>Documents</h2>
        <button className="btn btn-sm" onClick={handleReload} disabled={loading}>
          {loading ? '...' : '\u21BB'}
        </button>
      </div>
      <form onSubmit={handleUpload} className="upload-row">
        <input type="file" name="file" accept=".pdf,.xlsx,.xls,.docx,.csv" />
        <button type="submit" className="btn" disabled={uploading}>
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
      </form>
      {error && <p className="error">{error}</p>}
      <table>
        <thead>
          <tr>
            <th>Filename</th>
            <th>Status</th>
            <th>Created</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {docs.map((doc) => (
            <tr key={doc.id}>
              <td>{doc.filename}</td>
              <td><span className={`status ${doc.status}`}>{doc.status}</span></td>
              <td>{new Date(doc.createdAt).toLocaleString()}</td>
              <td>
                {(doc.status === 'done' || doc.status === 'partial') && (
                  <button className="btn btn-sm" onClick={() => openModal(doc)}>
                    View
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {docs.length === 0 && <p>No documents yet.</p>}

      {modalDoc && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modalDoc.filename}</h3>
              <button className="btn btn-sm" onClick={closeModal}>&times;</button>
            </div>
            <div className="modal-body">
              {annotationsLoading && <p>Loading annotations...</p>}
              {annotations && (
                <>
                  {annotations.entities && Object.keys(annotations.entities).length > 0 && (
                    <div className="annotation-section annotation-section--entities">
                      <div className="annotation-section-header">
                        <span className="annotation-badge annotation-badge--entity">E</span>
                        Entities
                      </div>
                      {Object.entries(annotations.entities).map(([type, items]) => (
                        <div key={type} className="annotation-group">
                          <h4>{type}</h4>
                          <ul>{items.map((item, i) => <li key={i}>{item}</li>)}</ul>
                        </div>
                      ))}
                    </div>
                  )}
                  {annotations.facts && Object.keys(annotations.facts).length > 0 && (
                    <div className="annotation-section annotation-section--facts">
                      <div className="annotation-section-header">
                        <span className="annotation-badge annotation-badge--fact">F</span>
                        Facts
                      </div>
                      {Object.entries(annotations.facts).map(([type, items]) => (
                        <div key={type} className="annotation-group">
                          <h4>{type}</h4>
                          <ul>{items.map((item, i) => <li key={i}>{item}</li>)}</ul>
                        </div>
                      ))}
                    </div>
                  )}
                  {annotations.error && <p className="error">{annotations.error}</p>}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
