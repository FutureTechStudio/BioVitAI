'use client';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { ObservationEvidenceSchema } from '../../../shared/contracts/src/intelligence';
import type { createProfileView } from '../../../shared/profile-context/src/index';
import { reportRequest } from './api';
import { BiomarkerInsights, TrendSparkline } from './health-dashboard';
const Result = z.object({
  version: z.string(),
  cohorts: z.array(
    z.object({
      label: z.string(),
      unit: z.string().nullable(),
      observations: z.array(ObservationEvidenceSchema),
    }),
  ),
  exclusions: z.array(
    z.object({ observation: ObservationEvidenceSchema, reason: z.string() }),
  ),
  organs: z.array(
    z.object({ name: z.string(), state: z.string(), reason: z.string() }),
  ),
});
export function HealthIntelligence({
  guard,
  onSource,
  revision,
}: {
  guard: ReturnType<typeof createProfileView>;
  onSource: (id: string) => void;
  revision: string;
}) {
  const [data, setData] = useState<z.infer<typeof Result> | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    const ticket = guard.request();
    void reportRequest('/v1/health/intelligence', ticket.context, {
      signal: ticket.signal,
    })
      .then((raw) => {
        const result = Result.parse(raw);
        guard.publish(ticket, () => setData(result));
      })
      .catch(() =>
        guard.publish(ticket, () => setError('Health evidence unavailable.')),
      );
  }, [guard, revision]);
  return (
    <section className="health-intelligence">
      <div className="insights-intro">
        <p className="eyebrow">An evidence-first view</p>
        <h2>Verified health evidence</h2>
        {data && (
          <div className="insight-totals">
            <span>
              <strong>{data.cohorts.length}</strong> comparable groups
            </span>
            <span>
              <strong>
                {data.cohorts.reduce((n, c) => n + c.observations.length, 0)}
              </strong>{' '}
              verified trend results
            </span>
            <span>
              <strong>{data.exclusions.length}</strong> excluded from trends
            </span>
          </div>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      {data && (
        <>
          <p>
            Results remain separate. Trends require verified concept, specimen,
            method, unit and date. No conversion or averaging is active.
          </p>
          {!data.cohorts.length && <p>No comparable trend is available yet.</p>}
          <BiomarkerInsights analysis={data} guard={guard} />
          {!!data.cohorts.length && (
            <div className="section-title trend-heading">
              <h2>Longitudinal trends</h2>
              <span className="badge">Exact values, original sources</span>
            </div>
          )}
          <div className="trend-collection">
            {data.cohorts.map((c, index) => (
              <article key={index} className="card trend-card">
                <h3>
                  {c.label} · {c.unit}
                </h3>
                <TrendChart label={c.label} rows={c.observations} />
                <table>
                  <caption>
                    Comparable source results, ordered by observation date
                  </caption>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Result</th>
                      <th>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.observations.map((o) => (
                      <tr key={o.id}>
                        <td>{o.date}</td>
                        <td>
                          {o.value} {o.unit}
                        </td>
                        <td>
                          <button onClick={() => onSource(o.reportId)}>
                            Why this value? Page {o.pageNumber} · revision{' '}
                            {o.revision}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </article>
            ))}
          </div>
          {!!data.exclusions.length && (
            <details>
              <summary>
                Results excluded from trends ({data.exclusions.length})
              </summary>
              <ul>
                {data.exclusions.map((e) => (
                  <li key={e.observation.id}>
                    {e.observation.name}: {e.observation.value}{' '}
                    {e.observation.unit} — {e.reason}.{' '}
                    <button onClick={() => onSource(e.observation.reportId)}>
                      View source page {e.observation.pageNumber}
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}
function TrendChart({
  label,
  rows,
}: {
  label: string;
  rows: z.infer<typeof ObservationEvidenceSchema>[];
}) {
  return (
    <div aria-label={`${label} evidence chart`}>
      <TrendSparkline rows={rows} full />
    </div>
  );
}
