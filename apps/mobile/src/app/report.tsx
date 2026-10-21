import { BioText as Text, theme } from '../design-system';
import { Action as Pressable, Field as TextInput } from '../action';
import { useEffect, useState, useRef } from 'react';
import { ScrollView, Image, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import {
  ReportDetailSchema,
  IngestionSchema,
  type ReportDetail,
} from '../../../../shared/contracts/src/reports';
import { z } from 'zod';
import { router } from 'expo-router';
import { useSession, requestProfile } from '../session';
import { nativeApi, previewPage, NativeRequestError } from '../api';
export default function Report() {
  const session = useSession(),
    { id } = useLocalSearchParams<{ id: string }>();
  return session.context.profile ? (
    <Review
      key={`${session.context.profile.id}:${session.context.revision}:${id}`}
      id={id}
    />
  ) : (
    <Text>Select a profile first.</Text>
  );
}
function Review({ id }: { id: string }) {
  const { guard } = useSession(),
    [detail, setDetail] = useState<ReportDetail | null>(null),
    [message, setMessage] = useState(''),
    [reason, setReason] = useState(''),
    [image, setImage] = useState(''),
    [previewNumber, setPreviewNumber] = useState(1),
    [reports, setReports] = useState<z.infer<typeof IngestionSchema>[]>([]),
    [related, setRelated] = useState(''),
    [relation, setRelation] = useState<'rerun' | 'amendment'>('rerun'),
    [relationReason, setRelationReason] = useState(''),
    [busy, setBusy] = useState(false);
  const imageRevision = useRef(0);
  const sourcePage = detail?.pages.find((p) => p.number === previewNumber);
  async function load() {
    const ticket = requestProfile(guard);
    if (!ticket) return;
    try {
      const data = ReportDetailSchema.parse(
        await nativeApi(
          '/v1/health/reports/' + id,
          undefined,
          ticket.context,
          ticket.signal,
        ),
      );
      const library = await nativeApi(
        '/v1/health/reports',
        undefined,
        ticket.context,
        ticket.signal,
      );
      guard.publish(ticket, () => {
        setDetail(data);
        setReports(z.array(IngestionSchema).parse(library.reports));
      });
    } catch (cause) {
      guard.publish(ticket, () => {
        setDetail(null);
        setImage('');
        setMessage('Report unavailable for this selected profile.');
      });
      if (
        cause instanceof NativeRequestError &&
        [401, 403, 404].includes(cause.status)
      )
        guard.clear();
    }
  }
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 5000);
    return () => {
      clearInterval(timer);
      setImage('');
    };
  }, [id]);
  async function action(route: string, fields: Record<string, unknown> = {}) {
    if (!detail) return;
    const ticket = requestProfile(guard);
    if (!ticket) return;
    setBusy(true);
    try {
      await nativeApi(
        `/v1/health/reports/${id}/${route}`,
        {
          context: ticket.context,
          expectedRevision: detail.report.revision,
          ...fields,
        },
        ticket.context,
        ticket.signal,
      );
      guard.publish(ticket, () => setMessage('Saved.'));
      await load();
    } catch (error) {
      guard.publish(ticket, () =>
        setMessage(
          error instanceof Error ? error.message : 'Request unavailable',
        ),
      );
    } finally {
      guard.publish(ticket, () => setBusy(false));
    }
  }
  async function page(number: number) {
    const revision = ++imageRevision.current;
    const ticket = requestProfile(guard);
    if (!ticket) return;
    setImage('');
    try {
      const uri = await previewPage(id, number, ticket.context, ticket.signal);
      if (revision === imageRevision.current)
        guard.publish(ticket, () => {
          setPreviewNumber(number);
          setImage(uri);
        });
    } catch {
      guard.publish(ticket, () => setMessage('Source unavailable.'));
    }
  }
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: 22, gap: 18 }}
    >
      <Text style={{ fontSize: 25 }}>
        {detail?.report.fileName ?? 'Report'}
      </Text>
      {!!message && <Text accessibilityRole="alert">{message}</Text>}
      {detail && (
        <>
          <Text>
            {detail.report.state} · identity{' '}
            {detail.identity?.state ?? 'pending'}
          </Text>
          {detail.report.state === 'failed' && (
            <Pressable disabled={busy} onPress={() => void action('retry')}>
              <Text>Retry processing</Text>
            </Pressable>
          )}
          {detail.report.state !== 'cancelled' && (
            <Pressable disabled={busy} onPress={() => void action('cancel')}>
              <Text>Cancel and withdraw this report</Text>
            </Pressable>
          )}
          {detail.identity?.state === 'pending' && (
            <>
              <Text>
                Compare the source with this selected person. Names and emails
                alone do not prove identity.
              </Text>
              <TextInput
                accessibilityLabel="Identity confirmation reason"
                placeholder="Reason for confirming the report belongs to this profile"
                value={reason}
                onChangeText={setReason}
              />
              <Pressable
                disabled={busy || reason.trim().length < 5}
                onPress={() =>
                  void action('identity', {
                    state: 'matched',
                    confirmedSubject: true,
                    reason,
                  })
                }
              >
                <Text>I checked the source and confirm this person</Text>
              </Pressable>
            </>
          )}
          {detail.pages.map((p) => (
            <Pressable key={p.number} onPress={() => void page(p.number)}>
              <Text>View source page {p.number}</Text>
            </Pressable>
          ))}
          {!!image && sourcePage && (
            <View
              style={{
                width: '100%',
                aspectRatio: sourcePage.width / sourcePage.height,
              }}
            >
              <Image
                source={{ uri: image }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="contain"
                accessibilityLabel="Original report source page"
              />
              {detail.candidates
                .filter((c) => c.pageNumber === previewNumber)
                .map((c) => (
                  <View
                    key={c.id}
                    pointerEvents="none"
                    accessible={false}
                    style={{
                      position: 'absolute',
                      borderWidth: 2,
                      borderColor: theme.color.teal,
                      left: `${Number(c.x0) * 100}%`,
                      top: `${Number(c.y0) * 100}%`,
                      width: `${(Number(c.x1) - Number(c.x0)) * 100}%`,
                      height: `${(Number(c.y1) - Number(c.y0)) * 100}%`,
                    }}
                  />
                ))}
            </View>
          )}
          {detail.candidates.map((c) => (
            <Candidate
              key={`${c.id}:${detail.report.revision}`}
              candidate={c}
              rawFields={detail.rawFields}
              current={detail.observations.find(
                (o) => o.id === c.observationId,
              )}
              enabled={
                !busy &&
                detail.identity?.state === 'matched' &&
                detail.report.state !== 'cancelled'
              }
              save={(fields) => void action('verify', fields)}
            />
          ))}
          {detail.identity?.state === 'matched' && (
            <View style={{ gap: 12 }}>
              <Text>Add an unrecognized result region</Text>
              {detail.rawFields.map((field) => (
                <Pressable
                  key={field.id}
                  disabled={busy || reason.trim().length < 5}
                  onPress={() =>
                    void action('candidates', {
                      requestKey: randomUUID(),
                      rawFieldId: field.id,
                      reason,
                    })
                  }
                >
                  <Text>
                    Page {field.pageNumber}: {field.text}
                  </Text>
                </Pressable>
              ))}
              <TextInput
                accessibilityLabel="Manual source selection reason"
                placeholder="Reason for selecting a source region"
                value={reason}
                onChangeText={setReason}
              />
            </View>
          )}
          {detail.observations.map((o) => (
            <Text key={o.id}>
              {o.name} {o.value} {o.unit} · revision {o.revision} ·{' '}
              {o.verificationState}
            </Text>
          ))}
          {detail.report.state === 'verified' && (
            <View style={{ gap: 14 }}>
              <Text>Declare a report relationship</Text>
              {reports
                .filter((r) => r.id !== id && r.state === 'verified')
                .map((r) => (
                  <Pressable
                    key={r.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: related === r.id }}
                    onPress={() => setRelated(r.id)}
                  >
                    <Text>
                      {related === r.id ? 'Selected: ' : ''}
                      {r.fileName}
                    </Text>
                  </Pressable>
                ))}
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  setRelation((v) => (v === 'rerun' ? 'amendment' : 'rerun'))
                }
              >
                <Text>Relationship: {relation} (tap to change)</Text>
              </Pressable>
              <TextInput
                accessibilityLabel="Report relationship reason"
                value={relationReason}
                onChangeText={setRelationReason}
                placeholder="Reason for this relationship"
              />
              <Pressable
                disabled={busy || !related || relationReason.trim().length < 5}
                onPress={() => {
                  const other = reports.find((r) => r.id === related);
                  if (other)
                    void action('relationships', {
                      requestKey: randomUUID(),
                      relatedReportId: related,
                      relatedRevision: other.revision,
                      kind: relation,
                      reason: relationReason,
                    });
                }}
              >
                <Text>Record relationship</Text>
              </Pressable>
              <Text>
                Both sources remain distinct. No result is averaged or
                withdrawn.
              </Text>
            </View>
          )}
          {detail.relationships.map((r) => (
            <Pressable
              key={r.id}
              onPress={() =>
                router.push({
                  pathname: '/report',
                  params: { id: r.relatedReportId },
                })
              }
            >
              <Text>
                {r.kind}: {r.reason}. View related source.
              </Text>
            </Pressable>
          ))}
        </>
      )}
    </ScrollView>
  );
}
function Candidate({
  rawFields,
  candidate: c,
  current,
  enabled,
  save,
}: {
  rawFields: ReportDetail['rawFields'];
  candidate: ReportDetail['candidates'][number];
  current: ReportDetail['observations'][number] | undefined;
  enabled: boolean;
  save: (fields: Record<string, unknown>) => void;
}) {
  const match = current?.value.match(
    /^(<=|>=|<|>|=)(-?(?:0|[1-9]\d*)(?:\.\d+)?)$/,
  );
  const [name, setName] = useState(current?.name ?? c.parsed.originalName),
    [kind, setKind] = useState(current?.valueKind ?? c.parsed.value.kind),
    [amount, setAmount] = useState(
      match?.[2] ??
        (c.parsed.value.kind === 'quantity' ? c.parsed.value.amount : ''),
    ),
    [comparator, setComparator] = useState(
      match?.[1] ??
        (c.parsed.value.kind === 'quantity' ? c.parsed.value.comparator : '='),
    ),
    [text, setText] = useState(
      current?.value ??
        (c.parsed.value.kind === 'qualitative'
          ? c.parsed.value.text
          : c.parsed.value.kind === 'missing'
            ? c.parsed.value.reason
            : ''),
    ),
    [unit, setUnit] = useState(current?.unit ?? c.parsed.unit ?? ''),
    [reason, setReason] = useState(''),
    [reference, setReference] = useState(
      current ? (current.referenceText ?? '') : (c.parsed.referenceText ?? ''),
    ),
    [referenceSource, setReferenceSource] = useState(
      current?.referenceFieldId ?? c.rawFieldId,
    ),
    [verifiedContext, setVerifiedContext] = useState(!!current?.metadata),
    [metadata, setMetadata] = useState({
      conceptSystem: current?.metadata?.conceptSystem ?? '',
      conceptCode: current?.metadata?.conceptCode ?? '',
      specimen: current?.metadata?.specimen ?? '',
      method: current?.metadata?.method ?? '',
      observedDate: current?.metadata?.observedDate ?? '',
    });
  return (
    <View
      style={{
        padding: 18,
        borderWidth: 1,
        borderColor: theme.color.border,
        gap: 15,
      }}
    >
      <Text>
        Source page {c.pageNumber}: {c.rawText}
      </Text>
      <TextInput
        accessibilityLabel="Test name"
        value={name}
        onChangeText={setName}
        editable={enabled}
      />
      <Pressable
        accessibilityRole="button"
        disabled={!enabled}
        onPress={() => {
          const kinds = ['quantity', 'qualitative', 'missing'] as const;
          setKind(kinds[(kinds.indexOf(kind) + 1) % kinds.length]);
        }}
      >
        <Text>Result type: {kind} (tap to change)</Text>
      </Pressable>
      {kind === 'quantity' ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change comparator"
            disabled={!enabled}
            onPress={() => {
              const values = ['=', '<', '<=', '>', '>='];
              setComparator(
                values[(values.indexOf(comparator) + 1) % values.length],
              );
            }}
          >
            <Text>Comparator: {comparator} (tap to change)</Text>
          </Pressable>
          <TextInput
            accessibilityLabel="Result value"
            value={amount}
            onChangeText={setAmount}
            editable={enabled}
          />
        </>
      ) : (
        <TextInput
          accessibilityLabel="Qualitative result or missing reason"
          value={text}
          onChangeText={setText}
          editable={enabled}
        />
      )}
      <TextInput
        accessibilityLabel="Unit"
        value={unit}
        onChangeText={setUnit}
        editable={enabled}
      />
      <TextInput
        accessibilityLabel="Verification reason"
        placeholder="Verification or correction reason"
        value={reason}
        onChangeText={setReason}
        editable={enabled}
      />
      <TextInput
        accessibilityLabel="Source reference interval or text"
        placeholder="Source reference interval or text (optional)"
        value={reference}
        onChangeText={setReference}
        editable={enabled}
        maxLength={1000}
      />
      {!!reference.trim() && (
        <View>
          <Text>Reference interval source region</Text>
          {rawFields.map((field) => (
            <Pressable
              key={field.id}
              disabled={!enabled}
              accessibilityRole="radio"
              accessibilityState={{ checked: referenceSource === field.id }}
              onPress={() => setReferenceSource(field.id)}
            >
              <Text>
                {referenceSource === field.id ? 'Selected: ' : ''}Page{' '}
                {field.pageNumber}: {field.text}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      <Pressable
        disabled={!enabled || reason.trim().length < 5}
        onPress={() =>
          save({
            candidateId: c.id,
            originalName: name,
            unit: unit.trim() || null,
            referenceText: reference.trim() || null,
            referenceFieldId: referenceSource,
            value:
              kind === 'quantity'
                ? { kind: 'quantity', amount, comparator }
                : kind === 'qualitative'
                  ? { kind: 'qualitative', text }
                  : { kind: 'missing', reason: text },
            reason,
            previousObservationId: c.observationId,
            metadata: verifiedContext
              ? {
                  ...Object.fromEntries(
                    Object.entries(metadata).map(([key, value]) => [
                      key,
                      value.trim() || null,
                    ]),
                  ),
                  sourceFieldId: c.rawFieldId,
                }
              : null,
          })
        }
      >
        <Text>
          {c.observationId ? 'Save corrected revision' : 'Verify result'}
        </Text>
      </Pressable>
      <Pressable
        disabled={!enabled}
        onPress={() => setVerifiedContext((v) => !v)}
      >
        <Text>
          {verifiedContext ? '☑' : '☐'} I checked the comparison context against
          this source
        </Text>
      </Pressable>
      {verifiedContext &&
        (Object.keys(metadata) as (keyof typeof metadata)[]).map((key) => (
          <TextInput
            key={key}
            accessibilityLabel={key}
            placeholder={
              key === 'observedDate' ? 'Observation date YYYY-MM-DD' : key
            }
            value={metadata[key]}
            onChangeText={(value) =>
              setMetadata((prior) => ({ ...prior, [key]: value }))
            }
            editable={enabled}
          />
        ))}
    </View>
  );
}
