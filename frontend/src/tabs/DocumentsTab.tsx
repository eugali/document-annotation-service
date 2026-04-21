import { useState, useEffect, useCallback } from 'react';
import { getDocuments, uploadDocument, getAnnotations } from '../api';
import type { Document, Annotations } from '../api';

export function DocumentsTab() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<Annotations | null>(null);

  const load = useCallback(async () => {
    try {
      setDocs(await getDocuments());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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

  async function toggleAnnotations(docId: string) {
    if (expandedId === docId) {
      setExpandedId(null);
      setAnnotations(null);
      return;
    }
    try {
      const data = await getAnnotations(docId);
      setAnnotations(data);
      setExpandedId(docId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load annotations');
    }
  }

  return (
    <div>
      <h2>Documents</h2>
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
            <>
              <tr key={doc.id}>
                <td>{doc.filename}</td>
                <td><span className={`status ${doc.status}`}>{doc.status}</span></td>
                <td>{new Date(doc.createdAt).toLocaleString()}</td>
                <td>
                  {(doc.status === 'done' || doc.status === 'partial') && (
                    <button className="btn btn-sm" onClick={() => toggleAnnotations(doc.id)}>
                      {expandedId === doc.id ? 'Hide' : 'View'}
                    </button>
                  )}
                </td>
              </tr>
              {expandedId === doc.id && annotations && (
                <tr key={`${doc.id}-ann`}>
                  <td colSpan={4}>
                    <div className="annotations">
                      {annotations.entities && Object.entries(annotations.entities).map(([type, items]) => (
                        <div key={type}>
                          <h4>{type}</h4>
                          <ul>{items.map((item, i) => <li key={i}>{item}</li>)}</ul>
                        </div>
                      ))}
                      {annotations.facts && Object.entries(annotations.facts).map(([type, items]) => (
                        <div key={type}>
                          <h4>{type}</h4>
                          <ul>{items.map((item, i) => <li key={i}>{item}</li>)}</ul>
                        </div>
                      ))}
                      {annotations.error && <p className="error">{annotations.error}</p>}
                    </div>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
      {docs.length === 0 && <p>No documents yet.</p>}
    </div>
  );
}
