import { Action as Pressable } from '../../action';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View, StyleSheet } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { z } from 'zod';
import { IngestionSchema } from '../../../../../shared/contracts/src/reports';
import { useSession } from '../../session';
import { nativeApi, uploadReport, NativeRequestError } from '../../api';
import { Evidence } from '../../evidence';
export default function Health() {
  const session = useSession();
  return session.context.profile ? (
    <Reports
      key={`${session.context.profile.id}:${session.context.revision}`}
    />
  ) : (
    <Text style={{ padding: 25 }}>
      Select a profile to view health evidence.
    </Text>
  );
}
function Reports() {
  const { guard, context, externalPicker } = useSession(),
    [reports, setReports] = useState<z.infer<typeof IngestionSchema>[]>([]),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  async function load() {
    const ticket = guard.request();
    try {
      const data = await nativeApi(
        '/v1/health/reports',
        undefined,
        ticket.context,
        ticket.signal,
      );
      guard.publish(ticket, () =>
        setReports(z.array(IngestionSchema).parse(data.reports)),
      );
    } catch (error) {
      if (
        error instanceof NativeRequestError &&
        [401, 403, 404].includes(error.status)
      )
        guard.clear();
      guard.publish(ticket, () =>
        setMessage('Reports unavailable. Refresh to retry.'),
      );
    }
  }
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 4000);
    return () => clearInterval(timer);
  }, []);
  async function upload() {
    setBusy(true);
    const ticket = guard.request();
    try {
      const picked = await externalPicker(() =>
        DocumentPicker.getDocumentAsync({
          type: [
            'application/pdf',
            'image/png',
            'image/jpeg',
            'image/tiff',
            'image/webp',
          ],
          copyToCacheDirectory: true,
        }),
      );
      if (picked.canceled) return;
      const file = picked.assets[0];
      if (!file || !file.size || file.size > 20 * 1024 * 1024)
        throw new Error('Choose a report up to 20 MiB.');
      await uploadReport(
        file.uri,
        file.name,
        randomUUID(),
        ticket.context,
        ticket.signal,
      );
      guard.publish(ticket, () =>
        setMessage(
          'Uploaded. Scanning and extraction must finish before verification.',
        ),
      );
      await load();
    } catch (error) {
      guard.publish(ticket, () =>
        setMessage(
          error instanceof Error ? error.message : 'Upload unavailable',
        ),
      );
    } finally {
      guard.publish(ticket, () => setBusy(false));
    }
  }
  return (
    <ScrollView contentContainerStyle={s.page}>
      <Text style={s.title}>Health evidence</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/chat')}
      >
        <Text>✳ Health assistant</Text>
      </Pressable>
      <Text>Reports for {context.profile?.displayName}</Text>
      <Text style={s.note}>
        Only verified results become health evidence. No organ scores or
        clinical conversions are active.
      </Text>
      <Pressable
        accessibilityRole="button"
        style={s.button}
        disabled={busy}
        onPress={() => void upload()}
      >
        <Text style={s.white}>{busy ? 'Uploading…' : 'Upload report'}</Text>
      </Pressable>
      <Text>PDF or image · 20 MiB · up to 50 pages</Text>
      {!!message && <Text accessibilityRole="alert">{message}</Text>}
      <Pressable style={s.button} onPress={() => void load()}>
        <Text style={s.white}>Refresh</Text>
      </Pressable>
      {!reports.length && <Text>Your reports will live here.</Text>}
      {reports.map((report) => (
        <Pressable
          accessibilityRole="button"
          style={s.card}
          accessibilityLabel={`Open report ${report.fileName}`}
          key={report.id}
          onPress={() =>
            router.push({ pathname: '/report', params: { id: report.id } })
          }
        >
          <Text style={s.name}>{report.fileName}</Text>
          <Text>
            {report.state} · {report.stage} · revision {report.revision}
          </Text>
          {report.errorCode && <Text>{report.errorCode}</Text>}
        </Pressable>
      ))}
      <Evidence
        key={reports.map((r) => `${r.id}:${r.revision}`).join(',')}
        reports={reports}
        revision={reports.map((r) => `${r.id}:${r.revision}`).join(',')}
      />
      <View style={s.card}>
        <Text style={s.name}>Organ evidence</Text>
        {['Heart', 'Liver', 'Kidneys', 'Thyroid', 'Metabolic'].map((name) => (
          <Text key={name}>
            {name}: not assessed — reviewed interpretation rules are not active.
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}
const s = StyleSheet.create({
  page: { padding: 22, gap: 16, backgroundColor: '#f7f8f3' },
  title: { fontSize: 30, color: '#254e3e' },
  name: { fontSize: 18, fontWeight: '600', color: '#254e3e' },
  note: { color: '#61715d', lineHeight: 22 },
  button: { padding: 15, backgroundColor: '#27614e', borderRadius: 8 },
  white: { color: 'white', fontSize: 16 },
  card: {
    padding: 18,
    borderWidth: 1,
    borderColor: '#d8e2d2',
    backgroundColor: 'white',
    borderRadius: 10,
    gap: 8,
  },
});
