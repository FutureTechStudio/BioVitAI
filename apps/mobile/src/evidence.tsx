import { BioText as Text, theme } from './design-system';
import { Action as Pressable } from './action';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { router } from 'expo-router';
import { z } from 'zod';
import { HealthAnalysisSchema } from '../../../shared/contracts/src/intelligence';
import { ObservationEvidenceSchema } from '../../../shared/contracts/src/intelligence';
import type { Ingestion } from '../../../shared/contracts/src/reports';
import { nativeApi } from './api';
import { Field } from './action';
import { useSession, requestProfile } from './session';
export function Evidence({
  revision,
  reports,
}: {
  revision: string;
  reports: Ingestion[];
}) {
  const { guard } = useSession(),
    [data, setData] = useState<z.infer<typeof HealthAnalysisSchema> | null>(
      null,
    );
  const [query, setQuery] = useState(''),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [error, setError] = useState('');
  const validDates =
    (!from || z.iso.date().safeParse(from).success) &&
    (!to || z.iso.date().safeParse(to).success) &&
    (!from || !to || from <= to);
  const cohorts =
    data?.cohorts
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
          c.label.toLowerCase().includes(query.toLowerCase()),
      ) ?? [];
  useEffect(() => {
    const ticket = requestProfile(guard);
    if (!ticket) return;
    void nativeApi(
      '/v1/health/intelligence',
      undefined,
      ticket.context,
      ticket.signal,
    )
      .then((raw) => {
        const result = HealthAnalysisSchema.parse(raw);
        guard.publish(ticket, () => setData(result));
      })
      .catch(() =>
        guard.publish(ticket, () => {
          setData(null);
          setError(
            'Health evidence unavailable. Return to My Health and refresh.',
          );
        }),
      );
  }, [guard, revision]);
  return (
    <View style={{ gap: 14 }}>
      <Comparison reports={reports} />
      <Text style={{ fontSize: 23 }}>Verified evidence and trends</Text>
      {!!error && <Text accessibilityRole="alert">{error}</Text>}
      <Field
        accessibilityLabel="Search biomarkers"
        placeholder="Search verified biomarkers"
        value={query}
        onChangeText={setQuery}
      />
      <Field
        accessibilityLabel="Observation date from"
        placeholder="From YYYY-MM-DD"
        value={from}
        onChangeText={setFrom}
      />
      <Field
        accessibilityLabel="Observation date to"
        placeholder="To YYYY-MM-DD"
        value={to}
        onChangeText={setTo}
      />
      {!validDates && (
        <Text accessibilityRole="alert">
          Use valid YYYY-MM-DD dates with the end on or after the start.
        </Text>
      )}
      {!data && !error && (
        <Text accessibilityLiveRegion="polite">Loading health evidence…</Text>
      )}
      {data && !cohorts.length && !error && (
        <Text>
          No comparable trend is available. Missing context is excluded.
        </Text>
      )}
      {validDates &&
        cohorts.map((c, i) => (
          <View key={i} style={{ gap: 12 }}>
            <Text style={{ fontSize: 20 }}>
              {c.label} · {c.unit}
            </Text>
            {c.observations.length > 1 && <Trend rows={c.observations} />}
            {c.observations.map((o) => (
              <Pressable
                key={o.id}
                accessibilityRole="button"
                onPress={() =>
                  router.push({
                    pathname: '/report',
                    params: { id: o.reportId },
                  })
                }
              >
                <Text>
                  {o.date}: {o.value} {o.unit} · source page {o.pageNumber},
                  revision {o.revision}
                </Text>
              </Pressable>
            ))}
          </View>
        ))}
      {data?.exclusions.map((e) => (
        <Pressable
          key={e.observation.id}
          onPress={() =>
            router.push({
              pathname: '/report',
              params: { id: e.observation.reportId },
            })
          }
        >
          <Text>
            {e.observation.name}: {e.observation.value} {e.observation.unit}.
            Excluded: {e.reason}. View source.
          </Text>
        </Pressable>
      ))}
      <Text>No averaging, conversion or unreviewed organ score is active.</Text>
      <Text style={{ fontSize: 23 }}>Organ evidence map</Text>
      {data?.organs.map((organ) => (
        <Text key={organ.name}>
          {organ.name}: not assessed. {organ.reason}
        </Text>
      ))}
    </View>
  );
}
function Trend({
  rows,
}: {
  rows: z.infer<typeof ObservationEvidenceSchema>[];
}) {
  const numbers = rows.map((row) => Number(row.amount));
  const low = Math.min(...numbers),
    high = Math.max(...numbers);
  const points = numbers
    .map(
      (n, i) =>
        `${10 + (i * 280) / (numbers.length - 1)},${90 - (high === low ? 40 : ((n - low) * 80) / (high - low))}`,
    )
    .join(' ');
  return (
    <View
      accessible
      accessibilityLabel="Approximate trend chart. Exact dates, values and sources follow below."
    >
      <Svg width="100%" height={110} viewBox="0 0 300 110">
        <Polyline
          points={points}
          fill="none"
          stroke={theme.color.teal}
          strokeWidth={3}
        />
      </Svg>
    </View>
  );
}
function Comparison({ reports }: { reports: Ingestion[] }) {
  const { guard } = useSession(),
    [left, setLeft] = useState(''),
    [right, setRight] = useState(''),
    [message, setMessage] = useState(''),
    [exclusions, setExclusions] = useState<
      {
        observation: z.infer<typeof ObservationEvidenceSchema>;
        reason: string;
      }[]
    >([]),
    [pairs, setPairs] = useState<
      {
        left: z.infer<typeof ObservationEvidenceSchema>;
        right: z.infer<typeof ObservationEvidenceSchema>;
      }[]
    >([]);
  async function compare() {
    const ticket = requestProfile(guard);
    if (!ticket) return;
    try {
      const data = await nativeApi(
          '/v1/health/comparisons',
          { context: ticket.context, left, right },
          ticket.context,
          ticket.signal,
        ),
        rows = z
          .array(
            z.object({
              left: ObservationEvidenceSchema,
              right: ObservationEvidenceSchema,
            }),
          )
          .parse(data.pairs);
      guard.publish(ticket, () => {
        setPairs(rows);
        setExclusions(
          z
            .array(
              z.object({
                observation: ObservationEvidenceSchema,
                reason: z.string(),
              }),
            )
            .parse(data.exclusions),
        );
        setMessage(
          rows.length
            ? 'Results remain distinct; no averaging is applied.'
            : 'No comparable pairs. Missing or incompatible context is excluded.',
        );
      });
    } catch {
      guard.publish(ticket, () =>
        setMessage('Comparison unavailable. Refresh the selected profile.'),
      );
    }
  }
  return (
    <View style={{ gap: 12 }}>
      <Text style={{ fontSize: 23 }}>Compare reports</Text>
      <Text>Select first, then second verified report.</Text>
      {reports
        .filter((r) => r.state === 'verified')
        .map((r) => (
          <Pressable
            key={r.id}
            accessibilityLabel={`Select comparison report ${r.fileName}`}
            style={{ minHeight: 48, justifyContent: 'center' }}
            onPress={() => {
              setPairs([]);
              setExclusions([]);
              if (!left || right) {
                setLeft(r.id);
                setRight('');
              } else setRight(r.id);
            }}
          >
            <Text>
              {left === r.id ? 'First: ' : right === r.id ? 'Second: ' : ''}
              {r.fileName}
            </Text>
          </Pressable>
        ))}
      <Pressable
        disabled={!left || !right || left === right}
        onPress={() => void compare()}
      >
        <Text>Compare verified results</Text>
      </Pressable>
      {!!message && <Text accessibilityRole="alert">{message}</Text>}
      {exclusions.map((excluded) => (
        <Pressable
          key={excluded.observation.id}
          onPress={() =>
            router.push({
              pathname: '/report',
              params: { id: excluded.observation.reportId },
            })
          }
        >
          <Text>
            {excluded.observation.name}: excluded. {excluded.reason}. View
            source page {excluded.observation.pageNumber}.
          </Text>
        </Pressable>
      ))}
      {pairs.map((pair) => (
        <View key={`${pair.left.id}:${pair.right.id}`}>
          {[pair.left, pair.right].map((o) => (
            <Pressable
              key={o.id}
              onPress={() =>
                router.push({ pathname: '/report', params: { id: o.reportId } })
              }
            >
              <Text>
                {o.name} · {o.date}: {o.value} {o.unit} · source page{' '}
                {o.pageNumber}, revision {o.revision}
              </Text>
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}
