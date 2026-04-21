import { useState, useEffect, useCallback } from 'react';
import { getJobs, getJob } from '../api';
import type { Job } from '../api';

export function JobsTab() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setJobs(await getJobs());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleRefresh(jobId: string) {
    setRefreshing(jobId);
    try {
      const updated = await getJob(jobId);
      setJobs((prev) => prev.map((j) => (j.jobId === jobId ? updated : j)));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Refresh failed');
    } finally {
      setRefreshing(null);
    }
  }

  function formatTime(ts: number | null) {
    if (!ts) return '-';
    return new Date(ts).toLocaleString();
  }

  return (
    <div>
      <h2>Jobs</h2>
      <button className="btn" onClick={load} style={{ marginBottom: 12 }}>Refresh All</button>
      {error && <p className="error">{error}</p>}
      <table>
        <thead>
          <tr>
            <th>Job ID</th>
            <th>Document ID</th>
            <th>State</th>
            <th>Attempts</th>
            <th>Created</th>
            <th>Finished</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.jobId}>
              <td>{job.jobId}</td>
              <td title={job.documentId}>{job.documentId.slice(0, 8)}...</td>
              <td><span className={`status ${job.state}`}>{job.state}</span></td>
              <td>{job.attemptsMade}</td>
              <td>{formatTime(job.timestamp)}</td>
              <td>{formatTime(job.finishedOn)}</td>
              <td>
                <button
                  className="btn btn-sm"
                  onClick={() => handleRefresh(job.jobId)}
                  disabled={refreshing === job.jobId}
                >
                  {refreshing === job.jobId ? '...' : '\u21BB'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {jobs.length === 0 && <p>No jobs yet.</p>}
    </div>
  );
}
