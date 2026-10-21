'use client';
import { useState } from 'react';
import { z } from 'zod';
import { ObservationEvidenceSchema } from '../../../shared/contracts/src/intelligence';
import type { Ingestion } from '../../../shared/contracts/src/reports';
import type { createProfileView } from '../../../shared/profile-context/src/index';
import { reportRequest, friendlyError } from './api';
import { Icon } from './design-system';
const Result = z.object({
  pairs: z.array(
    z.object({
      left: ObservationEvidenceSchema,
      right: ObservationEvidenceSchema,
      reason: z.string(),
    }),
  ),
  exclusions: z.array(
    z.object({ observation: ObservationEvidenceSchema, reason: z.string() }),
  ),
});
export function ReportComparison({
  guard,
  reports,
  onSource,
}: {
  guard: ReturnType<typeof createProfileView>;
  reports: Ingestion[];
  onSource: (id: string) => void;
}) {
  const [left, setLeft] = useState(''),
    [right, setRight] = useState(''),
    [data, setData] = useState<z.infer<typeof Result> | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function compare() {
    const ticket = guard.request();
    setBusy(true);
    setData(null);
    try {
      const result = Result.parse(
        await reportRequest('/v1/health/comparisons', ticket.context, {
          signal: ticket.signal,
          body: { context: ticket.context, left, right },
        }),
      );
      guard.publish(ticket, () => setData(result));
    } catch (cause) {
      guard.publish(ticket, () => setError(friendlyError(cause)));
    } finally {
      guard.publish(ticket, () => setBusy(false));
    }
  }
  return (
    <section
      className="card comparison-card"
      id="compare"
      aria-label="Report comparison"
    >
      <div className="section-title">
        <h2>Compare reports</h2>
        <span className="section-icon tone-blue">
          <Icon name="switch" />
        </span>
      </div>
      <p className="muted">
        Two sources. Each result kept distinct, with its original context.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void compare();
        }}
      >
        {[
          { label: 'First report', value: left, change: setLeft },
          { label: 'Second report', value: right, change: setRight },
        ].map((field) => (
          <label key={field.label}>
            {field.label}
            <select
              required
              value={field.value}
              onChange={(e) => {
                field.change(e.target.value);
                setData(null);
              }}
              disabled={busy}
            >
              <option value="">Choose a verified report</option>
              {reports
                .filter((r) => r.state === 'verified')
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.fileName}
                  </option>
                ))}
            </select>
          </label>
        ))}
        <button disabled={busy || !left || !right || left === right}>
          Compare verified results
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {data && (
        <>
          {!data.pairs.length && (
            <p>No comparable result pairs. Review the exclusions below.</p>
          )}
          {data.pairs.map((pair) => (
            <article key={`${pair.left.id}:${pair.right.id}`}>
              <h3>{pair.left.name}</h3>
              <p>{pair.reason}</p>
              {[pair.left, pair.right].map((o) => (
                <p key={o.id}>
                  {o.date}: {o.value} {o.unit}{' '}
                  <button onClick={() => onSource(o.reportId)}>
                    Source page {o.pageNumber} · revision {o.revision}
                  </button>
                </p>
              ))}
            </article>
          ))}
          <ul>
            {data.exclusions.map((e) => (
              <li key={e.observation.id}>
                {e.observation.name}: {e.reason}{' '}
                <button onClick={() => onSource(e.observation.reportId)}>
                  Source
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
