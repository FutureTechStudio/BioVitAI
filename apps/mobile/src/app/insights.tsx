import { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { z } from 'zod';
import { IngestionSchema } from '../../../../shared/contracts/src/reports';
import { useSession, requestProfile } from '../session';
import { nativeApi } from '../api';
import { Evidence } from '../evidence';
import { BioText as Text, theme } from '../design-system';
export default function InsightsScreen() {
  const { context } = useSession();
  return context.profile ? (
    <InsightsContent key={`${context.profile.id}:${context.revision}`} />
  ) : (
    <Text>Select a profile to view evidence.</Text>
  );
}
function InsightsContent() {
  const { guard } = useSession();
  const [reports, setReports] = useState<z.infer<typeof IngestionSchema>[]>([]),
    [error, setError] = useState('');
  useEffect(() => {
    const ticket = requestProfile(guard);
    if (!ticket) return;
    void nativeApi(
      '/v1/health/reports',
      undefined,
      ticket.context,
      ticket.signal,
    )
      .then((raw) =>
        guard.publish(ticket, () =>
          setReports(z.array(IngestionSchema).parse(raw.reports)),
        ),
      )
      .catch(() =>
        guard.publish(ticket, () =>
          setError('Insights unavailable. Return to My Health to refresh.'),
        ),
      );
  }, [guard]);
  return (
    <ScrollView
      contentContainerStyle={{
        padding: 20,
        gap: 16,
        backgroundColor: theme.color.canvas,
      }}
    >
      <Text
        accessibilityRole="header"
        style={{ fontSize: 28, lineHeight: 38, fontWeight: '700' }}
      >
        Insights
      </Text>
      {!!error && <Text accessibilityRole="alert">{error}</Text>}
      <Evidence
        reports={reports}
        revision={reports.map((r) => `${r.id}:${r.revision}`).join()}
      />
    </ScrollView>
  );
}
