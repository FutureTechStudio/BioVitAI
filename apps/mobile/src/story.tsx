import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Keyboard,
  Modal,
  Platform,
  ScrollView,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { randomUUID } from 'expo-crypto';
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
  extraStoryFields,
  newStoryDraft,
  storyContent,
  storyKinds,
  storyStates,
} from '../../../shared/journey/src/editor';
import type { StoryDraft } from '../../../shared/journey/src/editor';
import { BioCard, BioText as Text, theme } from './design-system';
import { Action, Field } from './action';
import { nativeApi, NativeRequestError } from './api';
import { useSession, requestProfile } from './session';

type Filters = {
  filter: 'all' | 'observation' | 'context';
  order: 'effective' | 'recorded';
  from: string;
  to: string;
};
const defaults: Filters = {
  filter: 'all',
  order: 'effective',
  from: '',
  to: '',
};
function storyError(cause: unknown) {
  if (cause instanceof NativeRequestError)
    return (
      (
        {
          STORY_REVISION_CHANGED:
            'This record changed. Inspect the latest version before reapplying your draft.',
          JOURNEY_CHANGED: 'The story changed. Refresh to continue.',
          CONTEXT_SOURCE_UNAVAILABLE:
            'The selected source or conflict link is unavailable.',
          INVALID_REQUEST:
            'Check required fields and use YYYY, YYYY-MM or YYYY-MM-DD for dates.',
        } as Record<string, string>
      )[cause.message] ?? 'Health story unavailable. Refresh to retry.'
    );
  return 'Check required fields, source details and dates.';
}
function useNativeJourney(filters: Filters = defaults) {
  const { guard } = useSession(),
    [data, setData] = useState<JourneySnapshot | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    sequence = useRef(0);
  const fail = (
    cause: unknown,
    ticket: NonNullable<ReturnType<typeof requestProfile>>,
    revision: number,
  ) => {
    if (
      cause instanceof NativeRequestError &&
      (cause.status === 401 ||
        ['PROFILE_NOT_FOUND', 'PROFILE_CONTEXT_CHANGED'].includes(
          cause.message,
        ))
    )
      guard.clear();
    else
      guard.publish(ticket, () => {
        if (sequence.current === revision) {
          setData(null);
          setError(storyError(cause));
        }
      });
  };
  const load = useCallback(
    async (offset = 0, snapshot?: string) => {
      const ticket = requestProfile(guard);
      if (!ticket) return;
      const revision = ++sequence.current;
      setBusy(true);
      try {
        const next = JourneySnapshotSchema.parse(
          await nativeApi(
            '/v1/health/journey/query',
            {
              context: ticket.context,
              ...filters,
              from: filters.from || null,
              to: filters.to || null,
              offset,
              ...(snapshot ? { expectedSnapshot: snapshot } : {}),
            },
            ticket.context,
            ticket.signal,
          ),
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
        fail(cause, ticket, revision);
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
    const timer = setInterval(() => void load(), 15000);
    return () => {
      sequence.current++;
      clearInterval(timer);
    };
  }, [load]);
  return { data, error, busy, load };
}
function openSource(id: string, page = 1, field?: string | null) {
  router.push({
    pathname: '/report',
    params: { id, page: String(page), ...(field ? { field } : {}) },
  });
}
export function NativeJourneyDigest() {
  const { guard } = useSession(),
    { data, error, load, busy } = useNativeJourney(),
    [message, setMessage] = useState(''),
    review = useRef<{ snapshot: string; key: string } | null>(null);
  async function mark() {
    if (!data) return;
    const ticket = requestProfile(guard);
    if (!ticket) return;
    if (review.current?.snapshot !== data.snapshot)
      review.current = { snapshot: data.snapshot, key: randomUUID() };
    try {
      await nativeApi(
        '/v1/health/journey/review',
        {
          context: ticket.context,
          snapshot: data.snapshot,
          requestKey: review.current.key,
        },
        ticket.context,
        ticket.signal,
      );
      guard.publish(ticket, () =>
        setMessage('Review point saved. Medical records are unchanged.'),
      );
      await load();
    } catch (cause) {
      guard.publish(ticket, () => setMessage(storyError(cause)));
    }
  }
  return (
    <BioCard style={{ backgroundColor: theme.color.infoSurface }}>
      <Text
        accessibilityRole="header"
        style={{ fontSize: 22, fontWeight: '700' }}
      >
        Your health story
      </Text>
      {error ? (
        <>
          <Text accessibilityRole="alert">{error}</Text>
          <Action onPress={() => void load()}>
            <Text>Retry health story</Text>
          </Action>
        </>
      ) : !data ? (
        <Text>Loading record changes…</Text>
      ) : (
        <>
          <Text>
            {data.summary.observations} verified results ·{' '}
            {data.summary.contextRecords} context records ·{' '}
            {data.summary.undated} undated items
          </Text>
          <Text>
            {data.firstReview
              ? 'Set a review point for future record changes.'
              : `${data.totalChanges} record changes since your review. These are not a medical urgency assessment.`}
          </Text>
          {data.changes.slice(0, 3).map((c) => (
            <View key={c.id} style={{ gap: 5 }}>
              <Text style={{ fontWeight: '600' }}>
                {c.kind}: {c.title}
              </Text>
              <Text>{c.detail}</Text>
            </View>
          ))}
          {data.tasks.slice(0, 3).map((task) => (
            <Action
              key={task.id}
              onPress={() =>
                task.reportId
                  ? openSource(task.reportId)
                  : router.push({
                      pathname: '/story',
                      params: { record: task.recordId ?? '' },
                    })
              }
            >
              <Text style={{ fontWeight: '600' }}>{task.title}</Text>
              <Text>{task.reason}</Text>
            </Action>
          ))}
          <Action disabled={busy} onPress={() => void mark()}>
            <Text>
              {data.firstReview
                ? 'Set review point'
                : 'Mark record snapshot reviewed'}
            </Text>
          </Action>
        </>
      )}
      {!!message && <Text accessibilityLiveRegion="polite">{message}</Text>}
      <Action onPress={() => router.push('/story')}>
        <Text>Open my health story</Text>
      </Action>
    </BioCard>
  );
}
export function NativeStory() {
  const { context } = useSession();
  return context.profile ? (
    <StoryContent key={`${context.profile.id}:${context.revision}`} />
  ) : (
    <Text>Select a profile to view their health story.</Text>
  );
}
function StoryContent() {
  const insets = useSafeAreaInsets();
  const { guard, context } = useSession(),
    { record: linkedRecord } = useLocalSearchParams<{ record?: string }>();
  const [filters, setFilters] = useState<Filters>(defaults),
    [dateDraft, setDateDraft] = useState({ from: '', to: '' }),
    { data, error, busy, load } = useNativeJourney(filters),
    [editor, setEditor] = useState<StoryRecord | 'new' | null>(null),
    [history, setHistory] = useState<StoryRecord[] | null>(null),
    [message, setMessage] = useState(''),
    [kind, setKind] = useState('all'),
    [past, setPast] = useState(false),
    [view, setView] = useState<'timeline' | 'context'>('timeline'),
    linked = useRef(false);
  async function versions(record: StoryRecord) {
    const ticket = requestProfile(guard);
    if (!ticket) return;
    try {
      const result = z
        .object({ versions: z.array(StoryRecordSchema) })
        .parse(
          await nativeApi(
            '/v1/health/journey/records/' + record.id,
            undefined,
            ticket.context,
            ticket.signal,
          ),
        );
      guard.publish(ticket, () => setHistory(result.versions));
    } catch (cause) {
      guard.publish(ticket, () => setMessage(storyError(cause)));
    }
  }
  useEffect(() => {
    if (!data || !linkedRecord || linked.current) return;
    linked.current = true;
    setView('context');
    const r = data.records.find((r) => r.id === linkedRecord);
    if (r?.content && data.canWrite) setEditor(r);
    else if (r) void versions(r);
    else setMessage('Record unavailable for this selected person.');
  }, [data, linkedRecord]);
  return (
    <>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, gap: 16 }}
      >
        <Action onPress={() => router.back()}>
          <Text>Back to My Health</Text>
        </Action>
        <BioCard>
          <Text style={{ color: theme.color.teal }}>
            History with its sources
          </Text>
          <Text
            accessibilityRole="header"
            style={{ fontSize: 28, fontWeight: '700' }}
          >
            My health story
          </Text>
          <Text>
            For {context.profile?.displayName}. Facts, reported context and
            guidance retain their own source labels.
          </Text>
          {data && (
            <Text>
              {data.summary.observations} verified results ·{' '}
              {data.summary.contextRecords} context records ·{' '}
              {data.summary.undated} undated items
            </Text>
          )}
          {data?.canWrite ? (
            <Action onPress={() => setEditor('new')}>
              <Text>Add health context</Text>
            </Action>
          ) : (
            data && <Text>Read-only health access</Text>
          )}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(['timeline', 'context'] as const).map((v) => (
              <Action
                key={v}
                accessibilityState={{ selected: view === v }}
                onPress={() => setView(v)}
              >
                <Text>
                  {v === 'timeline' ? 'Timeline' : 'Personal context'}
                </Text>
              </Action>
            ))}
          </View>
        </BioCard>
        {view === 'timeline' && (
          <BioCard>
            <Text
              accessibilityRole="header"
              style={{ fontSize: 21, fontWeight: '700' }}
            >
              Health journey timeline
            </Text>
            <Text>
              Approximate dates can overlap. Unknown event dates remain separate
              from upload dates.
            </Text>
            <Choice
              label="Timeline type"
              value={filters.filter}
              choices={{
                all: 'All evidence and context',
                observation: 'Verified results',
                context: 'Reported context & guidance',
              }}
              onChange={(filter) =>
                setFilters({
                  ...filters,
                  filter: filter as Filters['filter'],
                })
              }
            />
            <Choice
              label="Timeline order"
              value={filters.order}
              choices={{
                effective: 'Event date',
                recorded: 'Added or revised',
              }}
              onChange={(order) =>
                setFilters({ ...filters, order: order as Filters['order'] })
              }
            />
            <Text>
              Known dates overlap this filter; clear it to include undated
              items.
            </Text>
            <Text>Story from</Text>
            <Field
              accessibilityLabel="Story from"
              placeholder="YYYY-MM-DD"
              value={dateDraft.from}
              onChangeText={(from) => setDateDraft({ ...dateDraft, from })}
            />
            <Text>Story to</Text>
            <Field
              accessibilityLabel="Story to"
              placeholder="YYYY-MM-DD"
              value={dateDraft.to}
              onChangeText={(to) => setDateDraft({ ...dateDraft, to })}
            />
            <Action onPress={() => setFilters({ ...filters, ...dateDraft })}>
              <Text>Apply story dates</Text>
            </Action>
          </BioCard>
        )}
        {!!error && (
          <BioCard>
            <Text accessibilityRole="alert">{error}</Text>
            <Action onPress={() => void load()}>
              <Text>Retry health story</Text>
            </Action>
            <Action
              onPress={() => {
                setFilters(defaults);
                setDateDraft({ from: '', to: '' });
              }}
            >
              <Text>Clear story filters</Text>
            </Action>
          </BioCard>
        )}
        {!!message && <Text accessibilityLiveRegion="polite">{message}</Text>}
        {!data && !error && <Text>Loading health story…</Text>}
        {data && view === 'timeline' && (
          <>
            <Text>{data.totalEvents} matching timeline items</Text>
            {!data.events.length && (
              <Text>
                Add a report or record what you know to begin this story.
              </Text>
            )}
            {data.events.map((e) => (
              <BioCard key={e.id}>
                <Text style={{ color: theme.color.blueInk }}>
                  {storyDateLabel(e.date)}
                  {e.endDate?.value
                    ? ` to ${storyDateLabel(e.endDate)}`
                    : ''} · {e.status.replaceAll('_', ' ')}
                </Text>
                <Text
                  accessibilityRole="header"
                  style={{ fontSize: 19, fontWeight: '600' }}
                >
                  {e.title}
                </Text>
                <Text>{e.detail}</Text>
                <Text>
                  {e.authority} · revision {e.revision}
                </Text>
                <Text>
                  Added or revised{' '}
                  {new Date(e.recordedAt).toLocaleDateString('en')}
                </Text>
                {e.reportId && (
                  <Action
                    onPress={() =>
                      openSource(e.reportId!, e.pageNumber ?? 1, e.rawFieldId)
                    }
                  >
                    <Text>Inspect source · page {e.pageNumber ?? 1}</Text>
                  </Action>
                )}
                {e.recordId && (
                  <Action
                    onPress={() => {
                      const r = data.records.find((r) => r.id === e.recordId);
                      if (r) void versions(r);
                    }}
                  >
                    <Text>Record details & history</Text>
                  </Action>
                )}
              </BioCard>
            ))}
            {data.nextOffset !== null && (
              <Action
                disabled={busy}
                onPress={() => void load(data.nextOffset!, data.snapshot)}
              >
                <Text>Load more timeline items</Text>
              </Action>
            )}
          </>
        )}
        {data && view === 'context' && (
          <>
            <Text
              accessibilityRole="header"
              style={{ fontSize: 22, fontWeight: '700' }}
            >
              Personal context
            </Text>
            <Text>
              Not provided is different from none. Medicines are reported
              records; interaction checks are not available.
            </Text>
            <Choice
              label="Context category"
              value={kind}
              choices={{ all: 'All context', ...storyKinds }}
              onChange={setKind}
            />
            <Action
              accessibilityRole="checkbox"
              accessibilityState={{ checked: past }}
              onPress={() => setPast(!past)}
            >
              <Text>{past ? '☑' : '☐'} Include entered-in-error history</Text>
            </Action>
            {!data.records.length && (
              <Text>No personal context has been recorded here.</Text>
            )}
            {data.records
              .filter(
                (r) =>
                  (kind === 'all' || r.content?.information.kind === kind) &&
                  (past || r.content?.state !== 'entered_in_error'),
              )
              .map((r) => (
                <BioCard key={r.id}>
                  <NativeRecord record={r} />
                  {data.canWrite && r.content && (
                    <Action
                      accessibilityLabel={`Correct record: ${r.content.information.label}`}
                      onPress={() => setEditor(r)}
                    >
                      <Text>Correct record</Text>
                    </Action>
                  )}
                  <Action
                    accessibilityLabel={`View revision history: ${r.content?.information.label ?? 'Source unavailable'}`}
                    onPress={() => void versions(r)}
                  >
                    <Text>View revision history</Text>
                  </Action>
                </BioCard>
              ))}
          </>
        )}
      </ScrollView>
      <Modal
        visible={!!editor}
        onRequestClose={() => setEditor(null)}
        animationType="slide"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{
            flex: 1,
            paddingTop: insets.top + 8,
            paddingBottom: insets.bottom,
            paddingLeft: insets.left,
            paddingRight: insets.right,
            backgroundColor: theme.color.canvas,
          }}
        >
          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 12 }}>
            <Action
              style={{ flex: 1 }}
              accessibilityLabel="Close context editor"
              onPress={() => setEditor(null)}
            >
              <Text>Close editor</Text>
            </Action>
            <Action style={{ flex: 1 }} onPress={Keyboard.dismiss}>
              <Text>Hide keyboard</Text>
            </Action>
          </View>
          {editor && (
            <NativeStoryEditor
              record={editor === 'new' ? null : editor}
              records={data?.records ?? []}
              onSaved={async () => {
                setEditor(null);
                await load();
              }}
            />
          )}
        </KeyboardAvoidingView>
      </Modal>
      <Modal
        visible={!!history}
        onRequestClose={() => setHistory(null)}
        animationType="slide"
      >
        <ScrollView
          contentContainerStyle={{
            padding: 22,
            paddingTop: insets.top + 20,
            paddingBottom: insets.bottom + 20,
            gap: 16,
          }}
        >
          <Action onPress={() => setHistory(null)}>
            <Text>Close revision history</Text>
          </Action>
          <Text
            accessibilityRole="header"
            style={{ fontSize: 24, fontWeight: '700' }}
          >
            Context details and revision history
          </Text>
          {history?.map((r) => (
            <BioCard key={r.versionId}>
              <NativeRecord
                record={r}
                onSource={(id, page) => {
                  setHistory(null);
                  openSource(id, page);
                }}
              />
              <Text>
                Reason: {r.reason ?? 'Unavailable with withdrawn source'}
              </Text>
            </BioCard>
          ))}
        </ScrollView>
      </Modal>
    </>
  );
}
function Choice({
  label,
  value,
  choices,
  onChange,
}: {
  label: string;
  value: string;
  choices: Record<string, string>;
  onChange: (value: string) => void;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontWeight: '600' }}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {Object.entries(choices).map(([key, title]) => (
          <Action
            key={key}
            accessibilityLabel={`${label}: ${title}`}
            accessibilityState={{ selected: value === key }}
            style={{
              borderWidth: 1,
              borderColor:
                value === key ? theme.color.teal : theme.color.border,
            }}
            onPress={() => onChange(key)}
          >
            <Text>{title}</Text>
          </Action>
        ))}
      </View>
    </View>
  );
}
function NativeRecord({
  record,
  onSource = openSource,
}: {
  record: StoryRecord;
  onSource?: ((id: string, page: number) => void) | null;
}) {
  const c = record.content;
  if (!c)
    return (
      <>
        <Text accessibilityRole="header">Source unavailable</Text>
        <Text>
          Document-backed content is withheld because the source is no longer
          verified and available. Revision {record.revision} is preserved.
        </Text>
      </>
    );
  const d = newStoryDraft(c);
  return (
    <>
      <Text style={{ color: theme.color.teal }}>
        {storyKinds[c.information.kind]} · {storyStates[c.state]}
      </Text>
      <Text
        accessibilityRole="header"
        style={{ fontSize: 20, fontWeight: '600' }}
      >
        {c.information.label}
      </Text>
      <Text>{c.information.details}</Text>
      <Text>
        {c.source.kind === 'document'
          ? 'User-confirmed document transcription'
          : record.reporter === 'self'
            ? 'Reported by the person'
            : 'Reported by a caregiver'}{' '}
        ·{' '}
        {record.enteredByYou
          ? 'entered by you'
          : 'another authorized contributor'}
      </Text>
      <Text>
        Effective: {storyDateLabel(c.start)}
        {c.end.value ? ` to ${storyDateLabel(c.end)}` : ''}
      </Text>
      {extraStoryFields[c.information.kind].map(
        (f) =>
          d[f.key] && (
            <Text key={f.key}>
              {f.label}: {d[f.key]}
            </Text>
          ),
      )}
      <Text>
        Recorded {new Date(record.recordedAt).toLocaleString('en')} · revision{' '}
        {record.revision}
      </Text>
      {!!c.conflictsWith.length && (
        <Text>
          Possible conflict recorded with {c.conflictsWith.length} other
          record(s). Clarify the guidance; the app does not choose treatment.
        </Text>
      )}
      {c.source.kind === 'document' && (
        <>
          <Text>Source excerpt: {c.source.excerpt}</Text>
          {onSource && (
            <Action
              onPress={() => {
                if (c.source.kind === 'document')
                  onSource(c.source.reportId, c.source.pageNumber);
              }}
            >
              <Text>Inspect cited source</Text>
            </Action>
          )}
        </>
      )}
      {c.information.kind === 'medication' && (
        <Text>
          Reported medicine only. Interaction checking is not available; this is
          not advice to change treatment.
        </Text>
      )}
    </>
  );
}
function NativeStoryEditor({
  record,
  records,
  onSaved,
}: {
  record: StoryRecord | null;
  records: StoryRecord[];
  onSaved: () => Promise<void>;
}) {
  const { guard, context } = useSession(),
    [draft, setDraft] = useState(() =>
      newStoryDraft(record?.content ?? undefined),
    ),
    [id] = useState(() => record?.id ?? randomUUID()),
    [revision, setRevision] = useState(record?.revision ?? 0),
    [reason, setReason] = useState(''),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [latest, setLatest] = useState<StoryRecord | null>(null),
    [reports, setReports] = useState<{ id: string; fileName: string }[]>([]),
    mutation = useRef<{ value: string; key: string } | null>(null);
  const set = (key: keyof StoryDraft, value: unknown) =>
    setDraft((d) => ({ ...d, [key]: value }));
  useEffect(() => {
    if (draft.sourceKind !== 'document') return;
    const ticket = requestProfile(guard);
    if (!ticket) return;
    void nativeApi(
      '/v1/health/reports',
      undefined,
      ticket.context,
      ticket.signal,
    )
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
      .catch((cause) =>
        guard.publish(ticket, () => setError(storyError(cause))),
      );
  }, [draft.sourceKind, guard]);
  async function loadLatest() {
    const ticket = requestProfile(guard);
    if (!ticket) return;
    try {
      const result = z
        .object({ versions: z.array(StoryRecordSchema) })
        .parse(
          await nativeApi(
            '/v1/health/journey/records/' + id,
            undefined,
            ticket.context,
            ticket.signal,
          ),
        );
      guard.publish(ticket, () => setLatest(result.versions[0] ?? null));
    } catch (cause) {
      guard.publish(ticket, () => setError(storyError(cause)));
    }
  }
  async function save() {
    const ticket = requestProfile(guard);
    if (!ticket || busy) return;
    setBusy(true);
    setError('');
    try {
      const content = storyContent(draft),
        value = JSON.stringify({
          context: ticket.context,
          recordId: id,
          expectedRevision: revision,
          reason: reason || 'Initial user-confirmed context record',
          confirmed,
          content,
        });
      if (mutation.current?.value !== value)
        mutation.current = { value, key: randomUUID() };
      await nativeApi(
        '/v1/health/journey/records',
        { ...JSON.parse(value), requestKey: mutation.current.key },
        ticket.context,
        ticket.signal,
      );
      guard.publish(ticket, () => {
        void onSaved();
      });
    } catch (cause) {
      if (
        cause instanceof NativeRequestError &&
        ['PROFILE_NOT_FOUND', 'PROFILE_CONTEXT_CHANGED'].includes(cause.message)
      )
        guard.clear();
      else guard.publish(ticket, () => setError(storyError(cause)));
    } finally {
      guard.publish(ticket, () => setBusy(false));
    }
  }
  function field(
    key: keyof StoryDraft,
    label: string,
    multiline = false,
    max = 300,
  ) {
    return (
      <View key={key} style={{ gap: 6 }}>
        <Text>{label}</Text>
        <Field
          editable={!busy}
          accessibilityLabel={label}
          value={String(draft[key])}
          onChangeText={(value) => set(key, value)}
          onSubmitEditing={Keyboard.dismiss}
          multiline={multiline}
          maxLength={max}
          style={
            multiline ? { minHeight: 100, textAlignVertical: 'top' } : undefined
          }
        />
      </View>
    );
  }
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: 20, gap: 16 }}
    >
      <Text
        accessibilityRole="header"
        style={{ fontSize: 24, fontWeight: '700' }}
      >
        {record ? 'Correct health context' : 'Add health context'}
      </Text>
      <Text>
        For {context.profile?.displayName}. Confirmation records a report or
        transcription, not clinical assessment.
      </Text>
      {!record && (
        <Choice
          label="Record type"
          value={draft.kind}
          choices={storyKinds}
          onChange={(v) => set('kind', v)}
        />
      )}
      {field('label', 'Record name', false, 200)}
      {field('details', 'Details as reported or recorded', true, 1000)}
      {draft.kind === 'condition' && (
        <Choice
          label="Statement type"
          value={draft.assertion}
          choices={{
            concern: 'A concern to discuss',
            reported_condition: 'Reported condition',
          }}
          onChange={(v) => set('assertion', v)}
        />
      )}
      {extraStoryFields[draft.kind].map((f) =>
        field(f.key, f.label + ' (optional)'),
      )}
      {field('start', 'Effective from (optional)', false, 10)}
      {field('end', 'Effective to (optional)', false, 10)}
      <Text>Use YYYY, YYYY-MM or YYYY-MM-DD. Leave unknown dates empty.</Text>
      <Choice
        label="Record status"
        value={draft.state}
        choices={storyStates}
        onChange={(v) => set('state', v)}
      />
      <Choice
        label="Source basis"
        value={draft.sourceKind}
        choices={{
          reported: 'Personal or caregiver report',
          document: 'Checked against verified document',
        }}
        onChange={(v) => set('sourceKind', v)}
      />
      {draft.sourceKind === 'document' && (
        <>
          <Choice
            label="Verified source report"
            value={draft.reportId}
            choices={Object.fromEntries(reports.map((r) => [r.id, r.fileName]))}
            onChange={(v) => set('reportId', v)}
          />
          {field('pageNumber', 'Source page number', false, 2)}
          {field('excerpt', 'Exact source excerpt', true, 1000)}
          <Text>
            This form does not automatically extract prescriptions or clinician
            letters.
          </Text>
        </>
      )}
      {records
        .filter(
          (r) =>
            r.id !== id && r.content && r.content.state !== 'entered_in_error',
        )
        .map((r) => (
          <Action
            key={r.id}
            accessibilityRole="checkbox"
            accessibilityLabel={`Possible conflict: ${r.content!.information.label}`}
            accessibilityState={{ checked: draft.conflictsWith.includes(r.id) }}
            onPress={() =>
              set(
                'conflictsWith',
                draft.conflictsWith.includes(r.id)
                  ? draft.conflictsWith.filter((v) => v !== r.id)
                  : [...draft.conflictsWith, r.id],
              )
            }
          >
            <Text>
              {draft.conflictsWith.includes(r.id) ? '☑' : '☐'} Possible
              conflict: {r.content!.information.label}
            </Text>
          </Action>
        ))}
      {record && (
        <>
          <Text>Correction reason</Text>
          <Field
            accessibilityLabel="Correction reason"
            editable={!busy}
            maxLength={1000}
            value={reason}
            onChangeText={setReason}
          />
        </>
      )}
      <Action
        accessibilityRole="checkbox"
        accessibilityLabel="Confirm reported or transcribed context"
        accessibilityState={{ checked: confirmed }}
        onPress={() => setConfirmed(!confirmed)}
      >
        <Text>
          {confirmed ? '☑' : '☐'} I confirm this is what was reported or
          transcribed for {context.profile?.displayName}, and checked any cited
          source.
        </Text>
      </Action>
      {!!error && (
        <>
          <Text accessibilityRole="alert">{error}</Text>
          {record && (
            <Action onPress={() => void loadLatest()}>
              <Text>Inspect latest saved version</Text>
            </Action>
          )}
        </>
      )}
      {latest && (
        <BioCard>
          <Text>Latest saved version</Text>
          <NativeRecord record={latest} onSource={null} />
          <Text>Your draft is kept above; compare it before reapplying.</Text>
          {latest.content && (
            <Action
              onPress={() => {
                setRevision(latest.revision);
                setLatest(null);
                setError(
                  'Next save will append your draft to the latest revision.',
                );
              }}
            >
              <Text>Use latest revision for this draft</Text>
            </Action>
          )}
        </BioCard>
      )}
      <Action
        disabled={busy || !confirmed || (!!record && reason.trim().length < 5)}
        onPress={() => void save()}
      >
        <Text>
          {busy
            ? 'Saving context…'
            : record
              ? 'Save corrected record'
              : 'Save health context'}
        </Text>
      </Action>
    </ScrollView>
  );
}
