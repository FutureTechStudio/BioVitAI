'use client';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { ObservationEvidenceSchema } from '../../../shared/contracts/src/intelligence';
import type { createProfileView } from '../../../shared/profile-context/src/index';
import { reportRequest } from './api';
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
      <h2>Verified health evidence</h2>
      {error && <p role="alert">{error}</p>}
      {data && (
        <>
          <p>
            Results remain separate. Trends require verified concept, specimen,
            method, unit and date. No conversion or averaging is active.
          </p>
          {!data.cohorts.length && <p>No comparable trend is available yet.</p>}
          {data.cohorts.map((c, index) => (
            <article key={index}>
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
          <h3>Organ evidence map</h3>
          <svg
            viewBox="0 0 160 300"
            width="160"
            height="300"
            role="img"
            aria-label="Evidence coverage diagram. Heart, liver, kidneys, thyroid and metabolic health are not assessed."
          >
            <circle
              cx="80"
              cy="25"
              r="19"
              fill="#eef2eb"
              stroke="#52645c"
              strokeWidth="2"
            />
            <path
              d="M68 45v13L43 70 22 145l13 5 22-61-4 77 9 120h16l2-102 2 102h16l9-120-4-77 22 61 13-5-21-75-25-12V45"
              fill="#eef2eb"
              stroke="#52645c"
              strokeWidth="2"
            />
            {[
              [80, 65, 'Thyroid'],
              [88, 93, 'Heart'],
              [72, 122, 'Liver'],
              [65, 150, 'Kidneys'],
              [95, 150, 'Kidneys'],
            ].map(([x, y, name], i) => (
              <circle key={i} cx={x} cy={y} r="6" fill="#52645c">
                <title>{name}: not assessed</title>
              </circle>
            ))}
          </svg>
          <ul aria-label="Organ evidence status">
            {data.organs.map((o) => (
              <li key={o.name}>
                <strong>{o.name}: not assessed.</strong> {o.reason}
              </li>
            ))}
          </ul>
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
  const values = rows.map((r) => Number(r.amount));
  if (values.length < 2 || !values.every(Number.isFinite)) return null;
  const low = Math.min(...values),
    high = Math.max(...values),
    points = values
      .map(
        (value, i) =>
          `${20 + (i * 460) / (values.length - 1)},${130 - ((value - low) * 110) / (high - low || 1)}`,
      )
      .join(' ');
  return (
    <svg
      viewBox="0 0 500 160"
      role="img"
      aria-label={`${label} trend. Exact values, dates and sources follow in the table.`}
    >
      <title>{label} source trend</title>
      <desc>
        Separate verified results ordered by date. Chart positions are
        approximate; the table preserves exact source values.
      </desc>
      <polyline points={points} fill="none" stroke="#27614e" strokeWidth="3" />
      {values.map((value, i) => (
        <circle
          key={i}
          cx={20 + (i * 460) / (values.length - 1)}
          cy={130 - ((value - low) * 110) / (high - low || 1)}
          r="4"
          fill="#27614e"
        />
      ))}
    </svg>
  );
}
