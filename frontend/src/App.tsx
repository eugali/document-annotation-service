import { useState } from 'react';
import { DocumentsTab } from './tabs/DocumentsTab';
import { CatalogTab } from './tabs/CatalogTab';
import { ExtractionsTab } from './tabs/ExtractionsTab';
import { JobsTab } from './tabs/JobsTab';
import { ImprovementsTab } from './tabs/ImprovementsTab';
import './App.css';

type Tab = 'documents' | 'catalog' | 'extractions' | 'jobs' | 'improvements';

export default function App() {
  const [tab, setTab] = useState<Tab>('documents');

  return (
    <div className="app">
      <nav className="tabs">
        <button className={tab === 'documents' ? 'active' : ''} onClick={() => setTab('documents')}>Documents</button>
        <button className={tab === 'catalog' ? 'active' : ''} onClick={() => setTab('catalog')}>Catalog</button>
        <button className={tab === 'extractions' ? 'active' : ''} onClick={() => setTab('extractions')}>All Extractions</button>
        <button className={tab === 'jobs' ? 'active' : ''} onClick={() => setTab('jobs')}>Jobs</button>
        <button className={tab === 'improvements' ? 'active' : ''} onClick={() => setTab('improvements')}>Improvements</button>
      </nav>
      <main className="content">
        {tab === 'documents' && <DocumentsTab />}
        {tab === 'catalog' && <CatalogTab />}
        {tab === 'extractions' && <ExtractionsTab />}
        {tab === 'jobs' && <JobsTab />}
        {tab === 'improvements' && <ImprovementsTab />}
      </main>
    </div>
  );
}
