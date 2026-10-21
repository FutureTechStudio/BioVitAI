'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import {
  HealthAnalysisSchema,
  ObservationEvidenceSchema,
} from '../../../shared/contracts/src/intelligence';
import {
  IngestionSchema,
  ReportDetailSchema,
} from '../../../shared/contracts/src/reports';
import type { PublicProfile } from '../../../shared/contracts/src/web';
import type { createProfileView } from '../../../shared/profile-context/src/index';
import { bodyOutline } from '../../../shared/design-tokens/src/index';
import { reportRequest, ApiError, friendlyError } from './api';
import {
  BioCard,
  EmptyState,
  Icon,
  LoadingSkeleton,
  SideDrawer,
  StatusBadge,
} from './design-system';
type Guard = ReturnType<typeof createProfileView>;
type Observation = z.infer<typeof ObservationEvidenceSchema>;
type Analysis = z.infer<typeof HealthAnalysisSchema>;
export function useHealthSnapshot(guard: Guard) {
  const [snapshot, setSnapshot] = useState<{
    reports: z.infer<typeof IngestionSchema>[];
    analysis: Analysis;
    observations: Observation[];
  } | null>(null);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    const ticket = guard.request();
    try {
      const [reports, analysis, observations] = await Promise.all([
        reportRequest('/v1/health/reports', ticket.context, {
          signal: ticket.signal,
        }),
        reportRequest('/v1/health/intelligence', ticket.context, {
          signal: ticket.signal,
        }),
        reportRequest('/v1/health/observations', ticket.context, {
          signal: ticket.signal,
        }),
      ]);
      const next = {
        reports: z.object({ reports: z.array(IngestionSchema) }).parse(reports)
          .reports,
        analysis: HealthAnalysisSchema.parse(analysis),
        observations: z
          .object({ observations: z.array(ObservationEvidenceSchema) })
          .parse(observations).observations,
      };
      guard.publish(ticket, () => {
        setSnapshot(next);
        setError('');
      });
    } catch (cause) {
      if (
        cause instanceof ApiError &&
        ([401, 403, 404].includes(cause.status) ||
          cause.code === 'PROFILE_CONTEXT_CHANGED')
      ) {
        guard.clear();
        return;
      }
      guard.publish(ticket, () => {
        setSnapshot(null);
        setError(friendlyError(cause));
      });
    }
  }, [guard]);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 10000);
    return () => clearInterval(timer);
  }, [refresh]);
  return { snapshot, error, refresh };
}
export function HealthDashboard({
  profile,
  guard,
  search = '',
  overview = false,
}: {
  profile: PublicProfile;
  guard: Guard;
  search?: string;
  overview?: boolean;
}) {
  const { snapshot, error, refresh } = useHealthSnapshot(guard);
  if (error)
    return (
      <BioCard>
        <h2>Health evidence unavailable</h2>
        <p role="alert">{error}</p>
        <button onClick={() => void refresh()}>Retry loading evidence</button>
      </BioCard>
    );
  if (!snapshot) return <LoadingSkeleton />;
  const { reports, analysis, observations } = snapshot;
  const active = reports.filter((r) => r.state !== 'cancelled');
  const metrics = [
    {
      label: 'Reports',
      value: active.length,
      note: 'Active source documents',
      icon: 'reports',
      href: '/reports',
    },
    {
      label: 'Verified reports',
      value: reports.filter((r) => r.state === 'verified').length,
      note: 'Source checked',
      icon: 'check',
      href: '/reports',
    },
    {
      label: 'Verified results',
      value: observations.length,
      note: 'Distinct observations',
      icon: 'health',
      href: '/insights',
    },
    {
      label: 'Needs review',
      value: reports.filter((r) =>
        ['review_needed', 'quarantined'].includes(r.state),
      ).length,
      note: 'Includes identity review',
      icon: 'search',
      href: '/reports',
    },
    {
      label: 'Trend series',
      value: analysis.cohorts.length,
      note: 'Comparable evidence',
      icon: 'insights',
      href: '/insights',
    },
  ];
  return (
    <>
      <section className="welcome">
        <div>
          <p>
            {overview
              ? 'Your health evidence'
              : 'Welcome to your health space,'}
          </p>
          <h1>{profile.displayName}</h1>
          <p>
            Verified evidence, clear sources, and a little more perspective.
          </p>
        </div>
        <p className="welcome-note">
          Small steps today.
          <br />A clearer picture over time.
        </p>
      </section>
      <div className="metric-grid">
        {metrics.map((m) => (
          <Link href={m.href} className="card metric-card" key={m.label}>
            <span className="metric-icon">
              <Icon name={m.icon} />
            </span>
            <div>
              <h2>{m.label}</h2>
              <div className="metric-value">{m.value}</div>
              <small>{m.note}</small>
            </div>
          </Link>
        ))}
      </div>
      <div className="dashboard-grid">
        <BodyInsights organs={analysis.organs} />
        <div className="dashboard-side">
          <BiomarkerInsights
            analysis={analysis}
            guard={guard}
            search={search}
          />
          <BioCard>
            <div className="section-title">
              <h2>
                <Icon name="spark" size={18} /> Your next steps
              </h2>
              <StatusBadge>Evidence actions</StatusBadge>
            </div>
            <p className="muted">
              Personalized wellness recommendations are not yet available.
            </p>
            <div className="next-actions">
              <Link href="/reports">
                <Icon name="reports" />
                Review your reports
                <Icon name="chevron" size={16} />
              </Link>
              <Link href="/insights">
                <Icon name="insights" />
                Explore your trends
                <Icon name="chevron" size={16} />
              </Link>
            </div>
          </BioCard>
        </div>
      </div>
      {!!search.trim() && (
        <BioCard className="report-library">
          <h2>Reports matching “{search}”</h2>
          <ul>
            {reports
              .filter((r) =>
                r.fileName.toLowerCase().includes(search.toLowerCase()),
              )
              .map((r) => (
                <li key={r.id}>
                  <Link href={`/reports?report=${r.id}`}>
                    {r.fileName} · {r.state.replaceAll('_', ' ')}
                  </Link>
                </li>
              ))}
          </ul>
          <p className="muted">
            Search uses only this profile’s available reports and verified
            biomarkers.
          </p>
        </BioCard>
      )}
    </>
  );
}
export function BodyInsights({ organs }: { organs: Analysis['organs'] }) {
  const [selected, setSelected] = useState<Analysis['organs'][number] | null>(
    null,
  );
  const [filter, setFilter] = useState('All');
  const positions = [
    [120, 118],
    [106, 162],
    [102, 185],
    [120, 93],
    [125, 205],
  ];
  return (
    <BioCard className="body-insights">
      <div className="section-title">
        <h2>Your body insights</h2>
        <StatusBadge>Evidence coverage</StatusBadge>
      </div>
      <div className="segmented" aria-label="Body region filters">
        {['All', ...organs.map((o) => o.name)].map((name) => (
          <button
            key={name}
            aria-pressed={filter === name}
            onClick={() => setFilter(name)}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="body-layout">
        <div className="body-figure">
          <svg
            viewBox="0 0 260 480"
            role="group"
            aria-label="Body evidence navigator. Wellness goal progress is not yet available."
          >
            <defs>
              <radialGradient id="body-halo">
                <stop stopColor="var(--bf-celadon)" />
                <stop offset="1" stopColor="var(--bf-white)" />
              </radialGradient>
              <linearGradient id="body-surface" x2="1" y2=".3">
                <stop stopColor="var(--bf-white)" />
                <stop offset=".5" stopColor="var(--bf-body)" />
                <stop offset="1" stopColor="var(--bf-white)" />
              </linearGradient>
            </defs>
            <ellipse
              cx="120"
              cy="245"
              rx="116"
              ry="208"
              fill="url(#body-halo)"
            />
            <ellipse
              cx="120"
              cy="454"
              rx="100"
              ry="14"
              fill="none"
              stroke="var(--bf-border)"
            />
            <circle
              cx="120"
              cy="38"
              r="25"
              fill="url(#body-surface)"
              stroke="var(--bf-bodyEdge)"
            />
            <path
              d={bodyOutline}
              fill="url(#body-surface)"
              stroke="var(--bf-bodyEdge)"
              strokeWidth="1.3"
            />
            {organs.map((o, i) => {
              const [x, y] = positions[i % positions.length]!;
              return (
                <g key={o.name}>
                  <path
                    className="body-connector-ltr"
                    d={`M${x} ${y}L245 ${90 + i * 70}`}
                    stroke="var(--bf-bodyEdge)"
                    strokeWidth="1"
                    fill="none"
                  />
                  <path
                    className="body-connector-rtl"
                    d={`M${x} ${y}L15 ${90 + i * 70}`}
                    stroke="var(--bf-bodyEdge)"
                    strokeWidth="1"
                    fill="none"
                  />
                  <circle
                    data-drawer-trigger
                    cx={x}
                    cy={y}
                    r="14"
                    fill="transparent"
                    role="button"
                    tabIndex={0}
                    aria-label={`${o.name}: not assessed. Open evidence details`}
                    className="body-pointer"
                    onClick={() => setSelected(o)}
                    onKeyDown={(e) => {
                      if (['Enter', ' '].includes(e.key)) {
                        e.preventDefault();
                        setSelected(o);
                      }
                    }}
                  />
                  <circle
                    cx={x}
                    cy={y}
                    r="7"
                    fill="var(--bf-neutral)"
                    stroke="var(--bf-white)"
                    strokeWidth="3"
                    pointerEvents="none"
                  />
                </g>
              );
            })}
          </svg>
          <div className="progress-label">
            <strong>Wellness goal progress</strong>
            <br />
            Not yet available
          </div>
        </div>
        <div className="body-cards">
          {organs
            .filter((o) => filter === 'All' || o.name === filter)
            .map((o) => (
              <button
                data-drawer-trigger
                className="body-card"
                key={o.name}
                onClick={() => setSelected(o)}
              >
                <Icon
                  name={
                    o.name.toLowerCase().includes('heart')
                      ? 'health'
                      : 'wellness'
                  }
                />
                <span>
                  <strong>{o.name}</strong>
                  <small>Not assessed</small>
                  <small>Interpretation rules not active</small>
                </span>
                <Icon name="chevron" size={15} />
              </button>
            ))}
        </div>
      </div>
      <p className="evidence-note">
        This figure navigates evidence. It does not measure how much of your
        body is healthy. No overall health or organ score is calculated.
      </p>
      {selected && (
        <SideDrawer
          title={`${selected.name} evidence`}
          onClose={() => setSelected(null)}
        >
          <StatusBadge>Not assessed</StatusBadge>
          <p>{selected.reason}</p>
          <p>
            Verified laboratory measurements remain distinct from an organ
            assessment. No approved organ interpretation is active.
          </p>
          <Link className="secondary" href="/insights">
            Explore verified evidence
            <Icon name="chevron" />
          </Link>
        </SideDrawer>
      )}
    </BioCard>
  );
}
export function TrendSparkline({
  rows,
  full = false,
}: {
  rows: Observation[];
  full?: boolean;
}) {
  const amounts = rows.map((o) => Number(o.amount));
  if (rows.length < 2 || !amounts.every(Number.isFinite))
    return <span className="muted">—</span>;
  const lo = Math.min(...amounts),
    hi = Math.max(...amounts);
  const points = amounts
    .map(
      (v, i) =>
        `${5 + (i * 90) / (amounts.length - 1)},${35 - ((v - lo) * 28) / (hi - lo || 1)}`,
    )
    .join(' ');
  return (
    <svg
      viewBox="0 0 100 42"
      className={full ? 'chart' : 'sparkline'}
      role="img"
      aria-label={`${rows[0]?.name ?? 'Measurement'} trend; exact values and sources are in the detail table.`}
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={full ? 1 : 2}
      />
      {amounts.map((v, i) => (
        <circle
          key={rows[i]!.id}
          cx={5 + (i * 90) / (amounts.length - 1)}
          cy={35 - ((v - lo) * 28) / (hi - lo || 1)}
          r={full ? 1 : 2}
          fill="currentColor"
        />
      ))}
    </svg>
  );
}
export function BiomarkerInsights({
  analysis,
  guard,
  search = '',
}: {
  analysis: Analysis;
  guard: Guard;
  search?: string;
}) {
  const [query, setQuery] = useState(''),
    [from, setFrom] = useState(''),
    [to, setTo] = useState('');
  const [selected, setSelected] = useState<{
    label: string;
    observations: Observation[];
  } | null>(null);
  const [references, setReferences] = useState<Record<string, string>>({});
  const signature = analysis.cohorts
    .flatMap((c) =>
      c.observations.map((o) => `${o.id}:${o.revision}:${o.reportRevision}`),
    )
    .join();
  useEffect(() => setSelected(null), [signature]);
  useEffect(() => {
    const ticket = guard.request();
    let alive = true;
    setReferences({});
    const latest = analysis.cohorts.flatMap((c) => {
      const date = c.observations
        .map((o) => o.date ?? '')
        .sort()
        .at(-1);
      return c.observations.filter((o) => (o.date ?? '') === date);
    });
    const ids = [...new Set(latest.map((o) => o.reportId))];
    void Promise.all(
      ids.map(async (id) =>
        ReportDetailSchema.parse(
          await reportRequest(`/v1/health/reports/${id}`, ticket.context, {
            signal: ticket.signal,
          }),
        ),
      ),
    )
      .then((details) => {
        const next: Record<string, string> = {};
        for (const detail of details)
          for (const o of latest) {
            if (
              o.reportId !== detail.report.id ||
              o.reportRevision !== detail.report.revision
            )
              continue;
            const source = detail.observations.find((r) => r.id === o.id);
            if (source?.referenceText) next[o.id] = source.referenceText;
          }
        guard.publish(ticket, () => {
          if (alive) setReferences(next);
        });
      })
      .catch((cause) => {
        if (cause instanceof ApiError && [401, 403, 404].includes(cause.status))
          guard.clear();
      });
    return () => {
      alive = false;
    };
  }, [guard, signature]);
  const invalidDates = !!from && !!to && from > to;
  const cohorts = analysis.cohorts
    .map((c) => ({
      ...c,
      observations: c.observations.filter(
        (o) =>
          (!from || (!!o.date && o.date >= from)) &&
          (!to || (!!o.date && o.date <= to)),
      ),
    }))
    .filter(
      (c) =>
        c.observations.length &&
        c.label.toLowerCase().includes(query.toLowerCase()) &&
        c.label.toLowerCase().includes(search.toLowerCase()),
    );
  return (
    <BioCard>
      <div className="section-title">
        <h2>Biomarker insights</h2>
        <Link href="/insights">View all</Link>
      </div>
      <div className="segmented">
        <StatusBadge>Verified evidence</StatusBadge>
        <StatusBadge>Clinical interpretation pending</StatusBadge>
      </div>
      <div className="filter-row">
        <label>
          Search biomarkers
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a verified biomarker…"
          />
        </label>
        <label>
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
      </div>
      {invalidDates && (
        <p role="alert">Choose an end date on or after the start date.</p>
      )}
      {!invalidDates && (
        <div className="biomarker-list">
          {cohorts.map((c, i) => {
            const rows = [...c.observations].sort((a, b) =>
              (a.date ?? '').localeCompare(b.date ?? ''),
            );
            const last = rows.at(-1)!;
            const tied = rows.filter((r) => r.date === last.date);
            return (
              <button
                data-drawer-trigger
                className="biomarker-row"
                key={`${c.label}:${i}`}
                onClick={() =>
                  setSelected({ label: c.label, observations: rows })
                }
              >
                <span className="biomarker-name">
                  <strong>{c.label}</strong>
                  <small>{last.date ?? 'Date unknown'}</small>
                  <small>
                    {tied.length > 1
                      ? 'Individual source ranges in details'
                      : references[last.id]
                        ? `Source range: ${references[last.id]}`
                        : 'Reference text not available'}
                  </small>
                </span>
                <TrendSparkline rows={rows} />
                <span className="biomarker-value">
                  {tied.length > 1
                    ? `${tied.length} results`
                    : last.comparator === '='
                      ? (last.amount ?? last.value)
                      : last.value}
                  <small>{last.unit ?? 'Unit unknown'}</small>
                </span>
                <Icon name="chevron" size={16} />
              </button>
            );
          })}
        </div>
      )}
      {!invalidDates && !cohorts.length && (
        <EmptyState title="No matching verified trends">
          <p>
            Upload and verify reports with sufficient comparison context to
            explore changes over time.
          </p>
        </EmptyState>
      )}
      {!!(from || to) && (
        <p className="evidence-note">
          Date filters use observation dates. Results without a verified
          observation date are excluded.
        </p>
      )}
      {!!analysis.exclusions.length && (
        <details>
          <summary>
            Results excluded from trends ({analysis.exclusions.length})
          </summary>
          {analysis.exclusions.map((e) => (
            <p key={e.observation.id}>
              {e.observation.name}: {e.reason}.{' '}
              <Link href={`/reports?report=${e.observation.reportId}`}>
                View source
              </Link>
            </p>
          ))}
        </details>
      )}
      {selected && (
        <SideDrawer title={selected.label} onClose={() => setSelected(null)}>
          <StatusBadge>
            Verified measurements · no clinical interpretation
          </StatusBadge>
          <TrendSparkline rows={selected.observations} full />
          <div className="table-wrap">
            <table>
              <caption>
                Distinct results ordered by verified observation date
              </caption>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Value</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {selected.observations.map((o) => (
                  <tr key={o.id}>
                    <td>{o.date ?? 'Unknown'}</td>
                    <td>
                      {o.value} {o.unit}
                    </td>
                    <td>
                      <Link href={`/reports?report=${o.reportId}`}>
                        Why this value? Page {o.pageNumber}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            No unit conversion or averaging is active. Rising or falling values
            do not by themselves imply improvement.
          </p>
          <ObservationContext
            observation={selected.observations.at(-1)!}
            guard={guard}
          />
        </SideDrawer>
      )}
    </BioCard>
  );
}
function ObservationContext({
  observation,
  guard,
}: {
  observation: Observation;
  guard: Guard;
}) {
  const [detail, setDetail] = useState<z.infer<
      typeof ReportDetailSchema
    > | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    const ticket = guard.request();
    let alive = true;
    void reportRequest(
      `/v1/health/reports/${observation.reportId}`,
      ticket.context,
      { signal: ticket.signal },
    )
      .then((raw) => {
        const result = ReportDetailSchema.parse(raw);
        guard.publish(ticket, () => {
          if (alive) setDetail(result);
        });
      })
      .catch((e) =>
        guard.publish(ticket, () => {
          if (alive) setError(friendlyError(e));
        }),
      );
    return () => {
      alive = false;
    };
  }, [guard, observation.reportId]);
  const row = detail?.observations.find((o) => o.id === observation.id);
  return (
    <div>
      <h3>Source context</h3>
      {error && <p role="alert">{error}</p>}
      <p>
        Specimen: {observation.specimen ?? 'Unknown'} · Method:{' '}
        {observation.method ?? 'Unknown'}
      </p>
      <p>Source reference text: {row?.referenceText ?? 'Not available'}</p>
      <p>
        Observation revision {observation.revision} · report revision{' '}
        {observation.reportRevision}
      </p>
      {detail && detail.report.revision !== observation.reportRevision && (
        <p role="alert">
          Evidence changed. Close this panel and refresh before using these
          results.
        </p>
      )}
    </div>
  );
}
