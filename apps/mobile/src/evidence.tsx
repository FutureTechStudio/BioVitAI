import { Action as Pressable } from './action';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Polyline, Path, Circle } from 'react-native-svg';
import { router } from 'expo-router';
import { z } from 'zod';
import { HealthAnalysisSchema } from '../../../shared/contracts/src/intelligence';
import { ObservationEvidenceSchema } from '../../../shared/contracts/src/intelligence';
import type { Ingestion } from '../../../shared/contracts/src/reports';
import { nativeApi } from './api';
import { useSession } from './session';
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
  useEffect(() => {
    const ticket = guard.request();
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
      .catch(() => guard.publish(ticket, () => setData(null)));
  }, [guard, revision]);
  return (
    <View style={{ gap: 14 }}>
      <Comparison reports={reports} />
      <Text style={{ fontSize: 23 }}>Verified evidence and trends</Text>
      {!data?.cohorts.length && (
        <Text>
          No comparable trend is available. Missing context is excluded.
        </Text>
      )}
      {data?.cohorts.map((c, i) => (
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
                router.push({ pathname: '/report', params: { id: o.reportId } })
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
      <View
        accessible
        accessibilityLabel="Evidence coverage diagram. Heart, liver, kidneys, thyroid and metabolic health are not assessed."
      >
        <Svg width={160} height={300} viewBox="0 0 160 300">
          <Circle
            cx={80}
            cy={25}
            r={19}
            fill="#eef2eb"
            stroke="#52645c"
            strokeWidth={2}
          />
          <Path
            d="M68 45v13L43 70 22 145l13 5 22-61-4 77 9 120h16l2-102 2 102h16l9-120-4-77 22 61 13-5-21-75-25-12V45"
            fill="#eef2eb"
            stroke="#52645c"
            strokeWidth={2}
          />
          {[
            [80, 65],
            [88, 93],
            [72, 122],
            [65, 150],
            [95, 150],
          ].map(([x, y], i) => (
            <Circle key={i} cx={x} cy={y} r={6} fill="#52645c" />
          ))}
        </Svg>
      </View>
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
          stroke="#27614e"
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
    const ticket = guard.request();
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
            style={{ minHeight: 44, justifyContent: 'center' }}
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
