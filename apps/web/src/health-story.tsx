'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { z } from 'zod';
import {
  JourneySnapshotSchema,
  StoryRecordSchema,
  storyDateLabel,
} from '../../../shared/contracts/src/journey';
import type {
  JourneySnapshot,
  StoryRecord,
} from '../../../shared/contracts/src/journey';
import {
  newStoryDraft,
  storyContent,
  storyKinds,
  storyStates,
  extraStoryFields,
} from '../../../shared/journey/src/editor';
import type { StoryDraft } from '../../../shared/journey/src/editor';
import type { createProfileView } from '../../../shared/profile-context/src/index';
import { reportRequest, ApiError, friendlyError } from './api';
import {
  BioCard,
  EmptyState,
  Icon,
  SideDrawer,
  StatusBadge,
} from './design-system';

type Guard = ReturnType<typeof createProfileView>;
type Filters = {
  filter: 'all' | 'observation' | 'context';
  order: 'effective' | 'recorded';
  from: string;
  to: string;
};
const initialFilters: Filters = {
  filter: 'all',
  order: 'effective',
  from: '',
  to: '',
};
export function journeyError(error: unknown) {
  if (error instanceof ApiError)
    return (
      (
        {
          JOURNEY_CHANGED:
            'The story changed. Refresh before continuing; your draft has been kept.',
          STORY_REVISION_CHANGED:
            'This record changed elsewhere. Inspect the latest saved version before reapplying your draft.',
          CONTEXT_SOURCE_UNAVAILABLE:
            'That source or conflict link is no longer available. Check the selected source.',
          STORY_RECORD_LIMIT:
            'The local pilot supports up to 500 context records per person.',
          JOURNEY_SNAPSHOT_LIMIT:
            'This history exceeds the local pilot snapshot limit. The report library remains available.',
          INVALID_REQUEST:
            'Check the required fields, dates and source details.',
        } as Record<string, string>
      )[error.code] ?? friendlyError(error)
    );
  return error instanceof z.ZodError
    ? 'Check the required fields and use YYYY, YYYY-MM or YYYY-MM-DD for dates.'
    : friendlyError(error);
}
function lostAccess(error: unknown, guard: Guard) {
  if (
    error instanceof ApiError &&
    (error.status === 401 ||
      ['PROFILE_NOT_FOUND', 'PROFILE_CONTEXT_CHANGED'].includes(error.code))
  ) {
    guard.clear();
    return true;
  }
  return false;
}
function useJourney(guard: Guard, filters: Filters = initialFilters) {
  const [data, setData] = useState<JourneySnapshot | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const sequence = useRef(0);
  const load = useCallback(
    async (offset = 0, snapshot?: string) => {
      const revision = ++sequence.current;
      let ticket;
      try {
        ticket = guard.request();
      } catch {
        return;
      }
      setBusy(true);
      try {
        const next = JourneySnapshotSchema.parse(
          await reportRequest('/v1/health/journey/query', ticket.context, {
            signal: ticket.signal,
            body: {
              context: ticket.context,
              ...filters,
              from: filters.from || null,
              to: filters.to || null,
              offset,
              ...(snapshot ? { expectedSnapshot: snapshot } : {}),
            },
          }),
        );
        guard.publish(ticket, () => {
          if (sequence.current === revision) {
            setData((old) =>
              offset && old?.snapshot === next.snapshot
                ? { ...next, events: [...old.events, ...next.events] }
                : old?.snapshot === next.snapshot &&
                    old.events.length > next.events.length
                  ? { ...next, events: old.events, nextOffset: old.nextOffset }
                  : next,
            );
            setError('');
          }
        });
      } catch (cause) {
        if (!lostAccess(cause, guard))
          guard.publish(ticket, () => {
            if (sequence.current === revision) {
              setData(null);
              setError(journeyError(cause));
            }
          });
      } finally {
        guard.publish(ticket, () => {
          if (sequence.current === revision) setBusy(false);
        });
      }
    },
    [guard, filters.filter, filters.order, filters.from, filters.to],
  );
  useEffect(() => {
    setData(null);
    void load();
    return () => {
      sequence.current++;
    };
  }, [load]);
  // Revalidate visible history without storing private payloads in browser storage.
  useEffect(() => {
    const timer = setInterval(() => void load(), 15000);
    return () => clearInterval(timer);
  }, [load]);
  return { data, error, busy, load };
}
function sourceHref(
  reportId: string,
  page?: number | null,
  field?: string | null,
) {
  return `/reports?report=${reportId}${page ? `&page=${page}` : ''}${field ? `&field=${field}` : ''}`;
}
export function JourneyDigest({ guard }: { guard: Guard }) {
  const { data, error, busy, load } = useJourney(guard),
    [message, setMessage] = useState('');
  const reviewKey = useRef<{ snapshot: string; key: string } | null>(null);
  async function review() {
    if (!data) return;
    const ticket = guard.request();
    if (reviewKey.current?.snapshot !== data.snapshot)
      reviewKey.current = { snapshot: data.snapshot, key: crypto.randomUUID() };
    try {
      await reportRequest('/v1/health/journey/review', ticket.context, {
        signal: ticket.signal,
        body: {
          context: ticket.context,
          requestKey: reviewKey.current.key,
          snapshot: data.snapshot,
        },
      });
      guard.publish(ticket, () =>
        setMessage(
          'Your review point was saved. This does not change any medical record.',
        ),
      );
      await load();
    } catch (cause) {
      if (!lostAccess(cause, guard))
        guard.publish(ticket, () => setMessage(journeyError(cause)));
    }
  }
  return (
    <section className="journey-digest" aria-label="Health story digest">
      <BioCard className="story-digest-card">
        <div className="section-title">
          <div>
            <p className="eyebrow">Your story, continuing</p>
            <h2>What changed in your records</h2>
          </div>
          <Icon name="book" size={30} />
        </div>
        {error ? (
          <>
            <p role="alert">{error}</p>
            <button onClick={() => void load()}>Retry health story</button>
          </>
        ) : !data ? (
          <p role="status">Loading your health story…</p>
        ) : (
          <>
            <p className="muted">
              {data.firstReview
                ? 'Set a review point to see record changes on your next visit.'
                : `Since your review on ${new Date(data.reviewedAt!).toLocaleDateString('en')}. These are record changes, not an assessment of medical urgency.`}
            </p>
            <p className="story-summary">
              <strong>{data.summary.observations}</strong> verified results ·{' '}
              <strong>{data.summary.contextRecords}</strong> reported or
              transcribed context records
              {data.summary.earliest
                ? ` · records dated ${data.summary.earliest} to ${data.summary.latest}`
                : ''}
            </p>
            {!!data.summary.undated && (
              <p>
                {data.summary.undated} timeline{' '}
                {data.summary.undated === 1 ? 'item has' : 'items have'} an
                unknown event date.
              </p>
            )}
            {!data.firstReview && !data.totalChanges && (
              <p>
                No record changes since your review point. This does not
                establish that your health is unchanged.
              </p>
            )}
            <ul className="story-change-list">
              {data.changes.slice(0, 5).map((c) => (
                <li key={c.id}>
                  <StatusBadge tone={c.kind === 'removed' ? 'warning' : 'info'}>
                    {c.kind}
                  </StatusBadge>
                  <div>
                    <strong>{c.title}</strong>
                    <p>{c.detail}</p>
                    {c.reportId ? (
                      <Link href={sourceHref(c.reportId)}>Inspect report</Link>
                    ) : c.recordId ? (
                      <Link href={`/health?record=${c.recordId}#story`}>
                        Inspect context
                      </Link>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
            {data.totalChanges > 5 && (
              <p>
                {data.totalChanges} changed items in total. Open My Health to
                review the current story.
              </p>
            )}
            <div className="story-actions">
              <Link className="primary" href="/health#story">
                Open my health story <Icon name="chevron" size={17} />
              </Link>
              <button disabled={busy} onClick={() => void review()}>
                {data.firstReview
                  ? 'Set review point'
                  : 'Mark this record snapshot reviewed'}
              </button>
            </div>
          </>
        )}
        {!!message && <p role="status">{message}</p>}
      </BioCard>
      <BioCard className="story-next-card">
        <p className="eyebrow">A manageable next step</p>
        <h2>Record tasks</h2>
        <p className="muted">
          Ordered by record workflow, not clinical severity.
        </p>
        {data && !data.tasks.length && (
          <p>
            No source-review or recorded-conflict tasks are pending. You can add
            missing personal context or prepare a question.
          </p>
        )}
        {data?.tasks.slice(0, 3).map((task) => (
          <div className="story-task" key={task.id}>
            <strong>{task.title}</strong>
            <p>{task.reason}</p>
            <Link
              href={
                task.reportId
                  ? sourceHref(task.reportId)
                  : `/health?record=${task.recordId}#story`
              }
            >
              Open task <Icon name="chevron" size={15} />
            </Link>
          </div>
        ))}
        {!!data && data.tasks.length > 3 && (
          <p>More tasks are available in My Health and the report library.</p>
        )}
        <Link href="/reports">Open report library</Link>
      </BioCard>
    </section>
  );
}
export function HealthStory({
  guard,
  profileName,
}: {
  guard: Guard;
  profileName: string;
}) {
  const [filters, setFilters] = useState<Filters>(initialFilters),
    { data, error, busy, load } = useJourney(guard, filters);
  const [editor, setEditor] = useState<StoryRecord | 'new' | null>(null),
    [history, setHistory] = useState<StoryRecord[] | null>(null),
    [message, setMessage] = useState('');
  const [kind, setKind] = useState('all'),
    [showPast, setShowPast] = useState(false);
  const linked = useRef(false);
  useEffect(() => {
    if (!data || linked.current) return;
    const id = new URL(window.location.href).searchParams.get('record');
    if (!id) return;
    linked.current = true;
    const record = data.records.find((r) => r.id === id);
    if (record?.content && data.canWrite) setEditor(record);
    else if (record) void openHistory(record);
    else
      setMessage('That context record is unavailable for the selected person.');
  }, [data]);
  async function openHistory(record: StoryRecord) {
    const ticket = guard.request();
    setMessage('');
    try {
      const result = z
        .object({ versions: z.array(StoryRecordSchema) })
        .strict()
        .parse(
          await reportRequest(
            '/v1/health/journey/records/' + record.id,
            ticket.context,
            { signal: ticket.signal },
          ),
        );
      guard.publish(ticket, () => setHistory(result.versions));
    } catch (cause) {
      if (!lostAccess(cause, guard))
        guard.publish(ticket, () => setMessage(journeyError(cause)));
    }
  }
  const records =
    data?.records.filter(
      (r) =>
        (kind === 'all' || r.content?.information.kind === kind) &&
        (showPast || r.content?.state !== 'entered_in_error'),
    ) ?? [];
  return (
    <section id="story" className="health-story" aria-label="My health story">
      <BioCard className="story-intro">
        <div className="section-title">
          <div>
            <p className="eyebrow">History with its sources</p>
            <h2>My health story</h2>
          </div>
          {data?.canWrite && (
            <button
              data-drawer-trigger
              className="primary"
              onClick={() => setEditor('new')}
            >
              <Icon name="plus" size={18} />
              Add health context
            </button>
          )}
        </div>
        <p>
          For {profileName}. Laboratory facts, reported context and recorded
          guidance keep their own source labels. No diagnosis or interaction
          check is inferred.
        </p>
        <p className="muted">
          The current assistant reads verified laboratory evidence; these
          context records are not sent to AI in this release.
        </p>
        {data && (
          <div className="story-facts">
            <span>{data.summary.observations} verified results</span>
            <span>{data.summary.contextRecords} context records</span>
            <span>{data.summary.undated} undated items</span>
          </div>
        )}
        {data && !data.canWrite && (
          <StatusBadge>Read-only health access</StatusBadge>
        )}
      </BioCard>
      <BioCard aria-label="Timeline filters">
        <div className="story-filters">
          <label>
            Timeline type
            <select
              value={filters.filter}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  filter: e.target.value as Filters['filter'],
                })
              }
            >
              <option value="all">All evidence and context</option>
              <option value="observation">Verified results</option>
              <option value="context">Reported context & guidance</option>
            </select>
          </label>
          <label>
            Timeline order
            <select
              value={filters.order}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  order: e.target.value as Filters['order'],
                })
              }
            >
              <option value="effective">Event date · newest first</option>
              <option value="recorded">Added or revised · newest first</option>
            </select>
          </label>
          <label>
            Story from
            <input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters({ ...filters, from: e.target.value })}
            />
          </label>
          <label>
            Story to
            <input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters({ ...filters, to: e.target.value })}
            />
          </label>
        </div>
        {(filters.from || filters.to) && (
          <p className="muted">
            Date filters show overlapping known dates/periods. Clear the dates
            to include undated items.
          </p>
        )}
      </BioCard>
      {error && (
        <BioCard>
          <p role="alert">{error}</p>
          <button onClick={() => void load()}>Retry health story</button>
          <button onClick={() => setFilters(initialFilters)}>
            Clear story filters
          </button>
        </BioCard>
      )}
      {!!message && <p role="status">{message}</p>}
      {!data && !error && (
        <p role="status">Loading timeline and personal context…</p>
      )}
      {data && (
        <div className="story-layout">
          <BioCard className="story-timeline">
            <div className="section-title">
              <h2>Health journey timeline</h2>
              <StatusBadge tone="info">
                {data.totalEvents} matching items
              </StatusBadge>
            </div>
            <p className="muted">
              Approximate dates can overlap. Unknown event dates stay separate;
              uploading an old report does not make its measurement recent.
            </p>
            {!data.events.length && (
              <EmptyState title="Your story can start here.">
                <p>
                  Add a report or record what you know. Matching verified
                  results and reported context will appear with their dates and
                  sources.
                </p>
              </EmptyState>
            )}
            <ol className="timeline-list">
              {data.events.map((e, i) => (
                <li key={e.id} className={`timeline-event event-${e.kind}`}>
                  {!e.date.value &&
                    filters.order === 'effective' &&
                    (i === 0 || data.events[i - 1]?.date.value) && (
                      <h3 className="undated-heading">Date unknown</h3>
                    )}
                  <div className="event-meta">
                    <span>
                      {storyDateLabel(e.date)}
                      {e.endDate?.value
                        ? ` to ${storyDateLabel(e.endDate)}`
                        : ''}
                    </span>
                    <StatusBadge
                      tone={e.kind === 'observation' ? 'info' : 'neutral'}
                    >
                      {e.kind === 'observation'
                        ? 'Verified result'
                        : e.status.replaceAll('_', ' ')}
                    </StatusBadge>
                  </div>
                  <h3>{e.title}</h3>
                  <p className="event-detail">{e.detail}</p>
                  <p className="muted">
                    {e.authority} · revision {e.revision}
                    <br />
                    Added or revised{' '}
                    {new Date(e.recordedAt).toLocaleDateString('en')}
                  </p>
                  {e.reportId && (
                    <Link
                      href={sourceHref(e.reportId, e.pageNumber, e.rawFieldId)}
                    >
                      Inspect source · page {e.pageNumber ?? 1}
                    </Link>
                  )}
                  {e.recordId && (
                    <button
                      data-drawer-trigger
                      onClick={() => {
                        const r = data.records.find((r) => r.id === e.recordId);
                        if (r) void openHistory(r);
                      }}
                    >
                      Record details & history
                    </button>
                  )}
                </li>
              ))}
            </ol>
            {data.nextOffset !== null && (
              <button
                disabled={busy}
                onClick={() => void load(data.nextOffset!, data.snapshot)}
              >
                Load more timeline items
              </button>
            )}
          </BioCard>
          <div className="story-context-column">
            <BioCard>
              <div className="section-title">
                <h2>Personal context</h2>
                <Icon name="user" />
              </div>
              <p className="muted">
                An empty medicine or allergy list means not provided here. It
                does not mean none, or that interactions have been checked.
              </p>
              <label>
                Context category
                <select value={kind} onChange={(e) => setKind(e.target.value)}>
                  <option value="all">All context</option>
                  {Object.entries(storyKinds).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={showPast}
                  onChange={(e) => setShowPast(e.target.checked)}
                />
                Include entered-in-error history
              </label>
              {!records.length && (
                <p>No context records match this selection.</p>
              )}
              {records.map((record) => (
                <article className="story-record" key={record.id}>
                  <StoryRecordDetails record={record} />
                  <div className="story-actions">
                    {data.canWrite && record.content && (
                      <button
                        data-drawer-trigger
                        onClick={() => setEditor(record)}
                      >
                        Correct record
                      </button>
                    )}
                    <button
                      data-drawer-trigger
                      onClick={() => void openHistory(record)}
                    >
                      View revision history
                    </button>
                  </div>
                </article>
              ))}
            </BioCard>
          </div>
        </div>
      )}
      {editor && (
        <SideDrawer
          title={
            editor === 'new' ? 'Add health context' : 'Correct health context'
          }
          onClose={() => setEditor(null)}
        >
          <StoryEditor
            guard={guard}
            profileName={profileName}
            record={editor === 'new' ? null : editor}
            records={data?.records ?? []}
            onSaved={async () => {
              setEditor(null);
              await load();
            }}
          />
        </SideDrawer>
      )}
      {history && (
        <SideDrawer
          title="Context details and revision history"
          onClose={() => setHistory(null)}
        >
          {history.map((record) => (
            <article className="story-record" key={record.versionId}>
              <StoryRecordDetails record={record} />
              <p>
                Reason: {record.reason ?? 'Unavailable with withdrawn source'}
              </p>
            </article>
          ))}
        </SideDrawer>
      )}
    </section>
  );
}
export function StoryRecordDetails({ record }: { record: StoryRecord }) {
  const c = record.content;
  if (!c)
    return (
      <>
        <h3>Source unavailable</h3>
        <p>
          This document-backed record is withheld because its source is no
          longer verified and available. Revision {record.revision} is
          preserved.
        </p>
      </>
    );
  const d = newStoryDraft(c);
  return (
    <>
      <div className="event-meta">
        <StatusBadge>{storyKinds[c.information.kind]}</StatusBadge>
        <StatusBadge tone={c.state === 'disputed' ? 'warning' : 'neutral'}>
          {storyStates[c.state]}
        </StatusBadge>
      </div>
      <h3>{c.information.label}</h3>
      <p className="event-detail">{c.information.details}</p>
      <dl className="context-fields">
        <div>
          <dt>Source authority</dt>
          <dd>
            {c.source.kind === 'document'
              ? 'User-confirmed document transcription'
              : record.reporter === 'self'
                ? 'Reported by the person'
                : 'Reported by a caregiver'}{' '}
            ·{' '}
            {record.enteredByYou
              ? 'entered by you'
              : 'another authorized contributor'}
          </dd>
        </div>
        <div>
          <dt>Effective period</dt>
          <dd>
            {storyDateLabel(c.start)}
            {c.end.value ? ` to ${storyDateLabel(c.end)}` : ''}
          </dd>
        </div>
        {c.information.kind === 'condition' && (
          <div>
            <dt>Statement type</dt>
            <dd>
              {c.information.assertion === 'concern'
                ? 'Concern to discuss'
                : 'Reported condition; no diagnosis established by this app'}
            </dd>
          </div>
        )}
        {extraStoryFields[c.information.kind].map(
          (f) =>
            d[f.key] && (
              <div key={f.key}>
                <dt>{f.label}</dt>
                <dd>{d[f.key]}</dd>
              </div>
            ),
        )}
        <div>
          <dt>Recorded</dt>
          <dd>
            {new Date(record.recordedAt).toLocaleString('en')} · revision{' '}
            {record.revision}
          </dd>
        </div>
      </dl>
      {!!c.conflictsWith.length && (
        <p className="notice">
          Possible conflict recorded with {c.conflictsWith.length} other
          record(s). Keep both sources and clarify the guidance; the app does
          not choose treatment.
        </p>
      )}
      {c.source.kind === 'document' && (
        <>
          <blockquote>{c.source.excerpt}</blockquote>
          <Link href={sourceHref(c.source.reportId, c.source.pageNumber)}>
            Inspect cited source · page {c.source.pageNumber}
          </Link>
        </>
      )}
      {c.information.kind === 'medication' && (
        <p className="muted">
          Reported medicine record only. Interaction checking is not available;
          this is not advice to start, stop or change treatment.
        </p>
      )}
    </>
  );
}
function StoryEditor({
  guard,
  profileName,
  record,
  records,
  onSaved,
}: {
  guard: Guard;
  profileName: string;
  record: StoryRecord | null;
  records: StoryRecord[];
  onSaved: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(() =>
      newStoryDraft(record?.content ?? undefined),
    ),
    [baseRevision, setBaseRevision] = useState(record?.revision ?? 0),
    [reason, setReason] = useState(''),
    [checked, setChecked] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [latest, setLatest] = useState<StoryRecord | null>(null),
    [reports, setReports] = useState<{ id: string; fileName: string }[]>([]);
  const [id] = useState(() => record?.id ?? crypto.randomUUID());
  const mutation = useRef<{ value: string; key: string } | null>(null);
  const change = (key: keyof StoryDraft, value: unknown) =>
    setDraft((d) => ({ ...d, [key]: value }));
  useEffect(() => {
    if (draft.sourceKind !== 'document') return;
    const ticket = guard.request();
    void reportRequest('/v1/health/reports', ticket.context, {
      signal: ticket.signal,
    })
      .then((raw) => {
        const r = z
          .object({
            reports: z.array(
              z.object({
                id: z.uuid(),
                fileName: z.string(),
                state: z.string(),
              }),
            ),
          })
          .parse(raw);
        guard.publish(ticket, () =>
          setReports(r.reports.filter((r) => r.state === 'verified')),
        );
      })
      .catch((cause) => {
        if (!lostAccess(cause, guard))
          guard.publish(ticket, () => setError(journeyError(cause)));
      });
  }, [draft.sourceKind, guard]);
  async function loadLatest() {
    const ticket = guard.request();
    try {
      const result = z
        .object({ versions: z.array(StoryRecordSchema) })
        .parse(
          await reportRequest(
            '/v1/health/journey/records/' + id,
            ticket.context,
            { signal: ticket.signal },
          ),
        );
      guard.publish(ticket, () => setLatest(result.versions[0] ?? null));
    } catch (cause) {
      if (!lostAccess(cause, guard))
        guard.publish(ticket, () => setError(journeyError(cause)));
    }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const ticket = guard.request();
    setBusy(true);
    setError('');
    try {
      const content = storyContent(draft),
        value = JSON.stringify({
          context: ticket.context,
          recordId: id,
          expectedRevision: baseRevision,
          reason: reason || 'Initial user-confirmed context record',
          content,
          confirmed: checked,
        });
      if (mutation.current?.value !== value)
        mutation.current = { value, key: crypto.randomUUID() };
      await reportRequest('/v1/health/journey/records', ticket.context, {
        signal: ticket.signal,
        body: { ...JSON.parse(value), requestKey: mutation.current.key },
      });
      guard.publish(ticket, () => {
        void onSaved();
      });
    } catch (cause) {
      if (!lostAccess(cause, guard))
        guard.publish(ticket, () => setError(journeyError(cause)));
    } finally {
      guard.publish(ticket, () => setBusy(false));
    }
  }
  return (
    <form className="story-form" onSubmit={(e) => void save(e)}>
      <fieldset disabled={busy} className="story-editor-fields">
        <p>
          Recording information for <strong>{profileName}</strong>. Confirmation
          records what you reported or checked against a document; it is not
          clinical assessment.
        </p>
        <label>
          Record type
          <select
            value={draft.kind}
            disabled={!!record || busy}
            onChange={(e) => change('kind', e.target.value)}
          >
            {Object.entries(storyKinds).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          Record name
          <input
            required
            maxLength={200}
            value={draft.label}
            onChange={(e) => change('label', e.target.value)}
          />
        </label>
        <label>
          Details as reported or recorded
          <textarea
            required
            maxLength={1000}
            value={draft.details}
            onChange={(e) => change('details', e.target.value)}
          />
        </label>
        {draft.kind === 'condition' && (
          <label>
            Statement type
            <select
              value={draft.assertion}
              onChange={(e) => change('assertion', e.target.value)}
            >
              <option value="concern">A concern to discuss</option>
              <option value="reported_condition">
                A condition reported by the person or caregiver
              </option>
            </select>
          </label>
        )}
        {extraStoryFields[draft.kind].map((f) => (
          <label key={f.key}>
            {f.label} (optional)
            <input
              maxLength={300}
              value={draft[f.key]}
              onChange={(e) => change(f.key, e.target.value)}
            />
          </label>
        ))}
        <div className="story-form-grid">
          <label>
            Effective from (optional)
            <input
              placeholder="YYYY, YYYY-MM or YYYY-MM-DD"
              value={draft.start}
              maxLength={10}
              onChange={(e) => change('start', e.target.value)}
            />
          </label>
          <label>
            Effective to (optional)
            <input
              placeholder="Leave empty if unknown"
              value={draft.end}
              maxLength={10}
              onChange={(e) => change('end', e.target.value)}
            />
          </label>
        </div>
        <p className="muted">
          Leave unknown dates empty. Partial dates remain approximate; dates do
          not default to today.
        </p>
        <label>
          Record status
          <select
            value={draft.state}
            onChange={(e) => change('state', e.target.value)}
          >
            {Object.entries(storyStates).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          Source basis
          <select
            value={draft.sourceKind}
            onChange={(e) => change('sourceKind', e.target.value)}
          >
            <option value="reported">Personal or caregiver report</option>
            <option value="document">
              Checked against a verified source document
            </option>
          </select>
        </label>
        {draft.sourceKind === 'document' && (
          <>
            <label>
              Verified source report
              <select
                required
                value={draft.reportId}
                onChange={(e) => change('reportId', e.target.value)}
              >
                <option value="">Choose a verified source</option>
                {reports.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.fileName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Source page number
              <input
                type="number"
                min={1}
                max={50}
                required
                value={draft.pageNumber}
                onChange={(e) => change('pageNumber', e.target.value)}
              />
            </label>
            <label>
              Exact source excerpt
              <textarea
                required
                maxLength={1000}
                value={draft.excerpt}
                onChange={(e) => change('excerpt', e.target.value)}
              />
            </label>
            <p className="muted">
              Only currently verified sources can be cited. The current pipeline
              parses laboratory reports; this form does not claim automatic
              prescription or letter extraction.
            </p>
          </>
        )}
        {!!records.filter((r) => r.id !== id && r.content).length && (
          <fieldset>
            <legend>Possible conflicts you want to clarify (optional)</legend>
            {records
              .filter(
                (r) =>
                  r.id !== id &&
                  r.content &&
                  r.content.state !== 'entered_in_error',
              )
              .map((r) => (
                <label className="check" key={r.id}>
                  <input
                    type="checkbox"
                    checked={draft.conflictsWith.includes(r.id)}
                    onChange={(e) =>
                      change(
                        'conflictsWith',
                        e.target.checked
                          ? [...draft.conflictsWith, r.id]
                          : draft.conflictsWith.filter((id) => id !== r.id),
                      )
                    }
                  />
                  {r.content!.information.label}
                </label>
              ))}
          </fieldset>
        )}
        {!!record && (
          <label>
            Correction reason
            <input
              required
              minLength={5}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
        )}
        <label className="check">
          <input
            type="checkbox"
            required
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
          />
          I confirm this is what was reported or transcribed for {profileName}.
          I have checked any cited source.
        </label>
        {error && (
          <div role="alert" className="notice error">
            <p>{error}</p>
            {!!record && (
              <button type="button" onClick={() => void loadLatest()}>
                Inspect latest saved version
              </button>
            )}
          </div>
        )}
        {latest && (
          <section className="notice">
            <h3>Latest saved version</h3>
            <StoryRecordDetails record={latest} />
            <p>
              Your draft above is kept. Compare it before choosing to append to
              this version.
            </p>
            {latest.content && (
              <button
                type="button"
                onClick={() => {
                  setBaseRevision(latest.revision);
                  setError(
                    `Next save will append your draft to revision ${latest.revision}.`,
                  );
                  setLatest(null);
                }}
              >
                Use latest revision for this draft
              </button>
            )}
          </section>
        )}
        <button className="primary" disabled={busy || !checked}>
          {busy
            ? 'Saving context…'
            : record
              ? 'Save corrected record'
              : 'Save health context'}
        </button>
      </fieldset>
    </form>
  );
}
