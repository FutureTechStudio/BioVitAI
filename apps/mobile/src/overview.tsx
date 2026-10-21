import { useEffect, useState } from 'react';
import { View, Modal } from 'react-native';
import Svg, { Circle, Path, Ellipse, Line } from 'react-native-svg';
import { router } from 'expo-router';
import { HealthAnalysisSchema } from '../../../shared/contracts/src/intelligence';
import type { Ingestion } from '../../../shared/contracts/src/reports';
import { bodyOutline } from '../../../shared/design-tokens/src/index';
import type { z } from 'zod';
import { nativeApi } from './api';
import { useSession, requestProfile } from './session';
import { BioCard, BioText as Text, NativeIcon, theme } from './design-system';
import { Action } from './action';
export function NativeOverview({ reports }: { reports: Ingestion[] }) {
  const { guard, context } = useSession();
  const [analysis, setAnalysis] = useState<z.infer<
      typeof HealthAnalysisSchema
    > | null>(null),
    [error, setError] = useState(''),
    [selected, setSelected] = useState<string | null>(null);
  const revision = reports.map((r) => `${r.id}:${r.revision}`).join();
  useEffect(() => {
    const ticket = requestProfile(guard);
    if (!ticket) return;
    setSelected(null);
    void nativeApi(
      '/v1/health/intelligence',
      undefined,
      ticket.context,
      ticket.signal,
    )
      .then((raw) => {
        const data = HealthAnalysisSchema.parse(raw);
        guard.publish(ticket, () => {
          setAnalysis(data);
          setError('');
        });
      })
      .catch(() =>
        guard.publish(ticket, () => {
          setAnalysis(null);
          setError('Health overview unavailable. Refresh to retry.');
        }),
      );
  }, [guard, revision]);
  const metrics = [
    ['Reports', reports.filter((r) => r.state !== 'cancelled').length],
    ['Verified reports', reports.filter((r) => r.state === 'verified').length],
    [
      'Needs review',
      reports.filter((r) => ['review_needed', 'quarantined'].includes(r.state))
        .length,
    ],
    ['Trend series', analysis?.cohorts.length ?? '—'],
  ];
  return (
    <View style={{ gap: 16 }}>
      <BioCard style={{ backgroundColor: theme.color.mint }}>
        <Text style={{ color: theme.color.teal }}>Your health, connected</Text>
        <Text
          accessibilityRole="header"
          style={{ fontSize: 30, lineHeight: 40, fontWeight: '700' }}
        >
          {context.profile?.displayName}
        </Text>
        <Text>Verified evidence, with sources you can explore.</Text>
      </BioCard>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {metrics.map(([name, value]) => (
          <BioCard key={name} style={{ width: '47%', padding: 14, gap: 4 }}>
            <Text style={{ color: theme.color.slate, fontSize: 12 }}>
              {name}
            </Text>
            <Text style={{ fontSize: 28, lineHeight: 38, fontWeight: '700' }}>
              {value}
            </Text>
          </BioCard>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Action
          accessibilityLabel="Labs & Reports"
          style={{ flex: 1 }}
          onPress={() => router.push('/reports')}
        >
          <Text>
            <NativeIcon name="reports" size={16} /> Labs & Reports
          </Text>
        </Action>
        <Action
          accessibilityLabel="Insights"
          style={{ flex: 1 }}
          onPress={() => router.push('/insights')}
        >
          <Text>
            <NativeIcon name="insights" size={16} /> Insights
          </Text>
        </Action>
      </View>
      {!!error && <Text accessibilityRole="alert">{error}</Text>}
      <BioCard>
        <Text
          accessibilityRole="header"
          style={{ fontSize: 21, lineHeight: 28, fontWeight: '700' }}
        >
          Your body insights
        </Text>
        <Text>Evidence coverage · Not assessed</Text>
        <View style={{ alignItems: 'center' }}>
          <Svg
            width={190}
            height={360}
            viewBox="0 0 240 480"
            accessibilityLabel="Neutral body evidence figure. Wellness goal progress is not yet available."
            accessible
          >
            <Ellipse
              cx={120}
              cy={250}
              rx={110}
              ry={195}
              fill={theme.color.mint}
            />
            <Circle
              cx={120}
              cy={38}
              r={25}
              fill={theme.color.body}
              stroke={theme.color.bodyEdge}
            />
            <Path
              d={bodyOutline}
              fill={theme.color.body}
              stroke={theme.color.bodyEdge}
            />
            {[
              [120, 118],
              [106, 162],
              [102, 185],
              [120, 93],
              [125, 205],
            ].map(([x, y], i) => (
              <ViewPoint key={i} x={x!} y={y!} />
            ))}
          </Svg>
          <Text style={{ fontWeight: '600' }}>Wellness goal progress</Text>
          <Text style={{ color: theme.color.slate }}>Not yet available</Text>
        </View>
        {analysis?.organs.map((o) => (
          <Action
            key={o.name}
            accessibilityLabel={`${o.name}: not assessed. Open evidence details`}
            onPress={() => setSelected(o.name)}
          >
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
            >
              <NativeIcon name={o.name === 'Heart' ? 'health' : 'wellness'} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '600' }}>{o.name}</Text>
                <Text style={{ fontSize: 12, color: theme.color.slate }}>
                  Not assessed · Interpretation pending
                </Text>
              </View>
              <NativeIcon name="chevron" size={18} />
            </View>
          </Action>
        ))}
        <Text style={{ fontSize: 12, color: theme.color.slate }}>
          This figure navigates evidence. No overall health percentage or organ
          score is calculated.
        </Text>
      </BioCard>
      <BioCard>
        <Text
          accessibilityRole="header"
          style={{ fontSize: 20, fontWeight: '600' }}
        >
          Your next steps
        </Text>
        <Text>
          Personalized wellness recommendations are not yet available.
        </Text>
        <Action onPress={() => router.push('/insights')}>
          <Text>Explore verified trends →</Text>
        </Action>
      </BioCard>
      <Modal
        visible={!!selected}
        transparent
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            padding: 24,
            backgroundColor: theme.color.overlay,
          }}
        >
          <BioCard accessibilityViewIsModal>
            <Text
              accessibilityRole="header"
              style={{ fontSize: 24, fontWeight: '700' }}
            >
              {selected} evidence
            </Text>
            <Text>Not assessed</Text>
            <Text>
              {analysis?.organs.find((o) => o.name === selected)?.reason}
            </Text>
            <Text>No reviewed organ interpretation is active.</Text>
            <Action onPress={() => setSelected(null)}>
              <Text>Close evidence details</Text>
            </Action>
          </BioCard>
        </View>
      </Modal>
    </View>
  );
}
function ViewPoint({ x, y }: { x: number; y: number }) {
  return (
    <>
      <Line x1={x} y1={y} x2={220} y2={y + 20} stroke={theme.color.bodyEdge} />
      <Circle
        cx={x}
        cy={y}
        r={7}
        fill={theme.color.neutral}
        stroke={theme.color.white}
        strokeWidth={2}
      />
    </>
  );
}
