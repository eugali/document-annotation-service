import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { DocumentsTab } from './tabs/DocumentsTab';
import { CatalogTab } from './tabs/CatalogTab';
import { JobsTab } from './tabs/JobsTab';
import './App.css';

const tabs = [
  { path: '/documents', label: 'Documents' },
  { path: '/catalog', label: 'Catalog' },
  { path: '/jobs', label: 'Jobs' },
] as const;

export default function App() {
  return (
    <div className="app">
      <nav className="tabs">
        {tabs.map(({ path, label }) => (
          <NavLink key={path} to={path} className={({ isActive }) => isActive ? 'active' : ''}>
            {label}
          </NavLink>
        ))}
      </nav>
      <main className="content">
        <Routes>
          <Route path="/documents" element={<DocumentsTab />} />
          <Route path="/catalog" element={<CatalogTab />} />
          <Route path="/jobs" element={<JobsTab />} />
          <Route path="*" element={<Navigate to="/documents" replace />} />
        </Routes>
      </main>
    </div>
  );
}
