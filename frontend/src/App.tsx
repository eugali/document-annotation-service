import { useState } from 'react';
import { ReadmeTab } from './tabs/ReadmeTab';
import { DocumentsTab } from './tabs/DocumentsTab';
import { CatalogTab } from './tabs/CatalogTab';
import { JobsTab } from './tabs/JobsTab';
import { ImprovementsTab } from './tabs/ImprovementsTab';
import './App.css';

type Tab = 'readme' | 'documents' | 'catalog' | 'jobs' | 'improvements';

export default function App() {
  const [tab, setTab] = useState<Tab>('readme');

  return (
    <div className="app">
      <nav className="tabs">
        <button className={tab === 'readme' ? 'active' : ''} onClick={() => setTab('readme')}>README</button>
        <button className={tab === 'documents' ? 'active' : ''} onClick={() => setTab('documents')}>Documents</button>
        <button className={tab === 'catalog' ? 'active' : ''} onClick={() => setTab('catalog')}>Catalog</button>
        <button className={tab === 'jobs' ? 'active' : ''} onClick={() => setTab('jobs')}>Jobs</button>
        <button className={tab === 'improvements' ? 'active' : ''} onClick={() => setTab('improvements')}>Improvements</button>
      </nav>
      <main className="content">
        {tab === 'readme' && <ReadmeTab />}
        {tab === 'documents' && <DocumentsTab />}
        {tab === 'catalog' && <CatalogTab />}
        {tab === 'jobs' && <JobsTab />}
        {tab === 'improvements' && <ImprovementsTab />}
      </main>
    </div>
  );
}
