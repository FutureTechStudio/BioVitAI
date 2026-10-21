import { BioText as Text, theme, BioCard } from '../design-system';
import { Action as Pressable, Field as TextInput } from '../action';
import { useEffect, useState, useRef } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { z } from 'zod';
import { ExplanationSchema } from '../../../../shared/contracts/src/conversations';
import { ObservationEvidenceSchema } from '../../../../shared/contracts/src/intelligence';
import { useSession, requestProfile } from '../session';
import { nativeApi, NativeRequestError } from '../api';
export default function Chat() {
  const session = useSession();
  return session.context.profile ? (
    <Conversation
      key={`${session.context.profile.id}:${session.context.revision}`}
    />
  ) : (
    <Text>Select a profile.</Text>
  );
}
const Message = z.object({
  question: z.string(),
  answer: ExplanationSchema.nullable(),
  code: z.string().nullable(),
});
function Conversation() {
  const { guard, context } = useSession(),
    [id, setId] = useState(randomUUID),
    [question, setQuestion] = useState(''),
    [messages, setMessages] = useState<z.infer<typeof Message>[]>([]),
    [history, setHistory] = useState<{ id: string; createdAt: string }[]>([]),
    [sources, setSources] = useState<
      z.infer<typeof ObservationEvidenceSchema>[]
    >([]),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const loadRevision = useRef(0);
  const feed = useRef<ScrollView>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (messages.length) feed.current?.scrollToEnd({ animated: true });
      else feed.current?.scrollTo({ y: 0, animated: false });
    }, 300);
    return () => clearTimeout(timer);
  }, [messages.length, id]);
  async function load(selected?: string) {
    const revision = ++loadRevision.current;
    const ticket = requestProfile(guard);
    if (!ticket) return;
    const publish = (work: () => void) => {
      if (revision === loadRevision.current) guard.publish(ticket, work);
    };
    try {
      const data = await nativeApi(
          '/v1/health/conversations',
          undefined,
          ticket.context,
          ticket.signal,
        ),
        evidence = await nativeApi(
          '/v1/health/observations',
          undefined,
          ticket.context,
          ticket.signal,
        );
      publish(() => {
        setHistory(
          z
            .array(z.object({ id: z.uuid(), createdAt: z.string() }))
            .parse(data.conversations),
        );
        setSources(
          z.array(ObservationEvidenceSchema).parse(evidence.observations),
        );
      });
      if (selected) {
        const data = await nativeApi(
          '/v1/health/conversations/' + selected,
          undefined,
          ticket.context,
          ticket.signal,
        );
        publish(() => {
          setId(selected);
          setMessages(z.array(Message).parse(data.messages));
        });
      }
    } catch (cause) {
      publish(() => {
        setMessages([]);
        setSources([]);
        setMessage(
          'AI access requires current permission and health AI consent.',
        );
      });
      if (
        revision === loadRevision.current &&
        cause instanceof NativeRequestError &&
        [401, 403, 404].includes(cause.status) &&
        cause.message !== 'CONSENT_REQUIRED'
      )
        guard.clear();
    }
  }
  useEffect(() => {
    if (!busy) void load(id);
    const timer = setInterval(() => {
      if (!busy) void load(id);
    }, 5000);
    return () => {
      clearInterval(timer);
      loadRevision.current++;
    };
  }, [id, busy]);
  async function consent(granted: boolean) {
    loadRevision.current++;
    const ticket = requestProfile(guard);
    if (!ticket) return;
    try {
      await nativeApi(
        `/v1/profiles/${ticket.context.profileId}/consents`,
        { purpose: 'health_ai', noticeVersion: 'pilot-v1', granted },
        ticket.context,
        ticket.signal,
      );
      guard.publish(ticket, () => {
        setMessages([]);
        setMessage(granted ? 'Consent recorded.' : 'Consent withdrawn.');
      });
      if (granted) await load();
    } catch {
      guard.publish(ticket, () =>
        setMessage('Only the profile owner can change consent.'),
      );
    }
  }
  async function send() {
    loadRevision.current++;
    const ticket = requestProfile(guard);
    if (!ticket) return;
    setBusy(true);
    try {
      const result = Message.omit({ question: true }).parse(
        await nativeApi(
          '/v1/health/messages',
          {
            context: ticket.context,
            conversationId: id,
            requestKey: randomUUID(),
            question,
          },
          ticket.context,
          ticket.signal,
        ),
      );
      guard.publish(ticket, () => {
        setMessages((old) => [...old, { question, ...result }]);
        setQuestion('');
      });
      await load();
    } catch {
      guard.publish(ticket, () => {
        setMessages([]);
        setSources([]);
        setMessage('AI unavailable. Check permission and consent.');
      });
    } finally {
      guard.publish(ticket, () => setBusy(false));
    }
  }
  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={feed}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 24, gap: 18 }}
      >
        <Text style={{ fontSize: 28 }}>
          Here for {context.profile?.displayName}
        </Text>
        <Text>
          Optional AI explanations send verified evidence to the configured
          OpenAI model. You can withdraw consent. No model or credentials means
          AI is unavailable.
        </Text>
        <Pressable onPress={() => void consent(true)}>
          <Text>Allow AI processing for this profile</Text>
        </Pressable>
        <Pressable onPress={() => void consent(false)}>
          <Text>Withdraw AI consent</Text>
        </Pressable>
        {!!message && <Text accessibilityRole="alert">{message}</Text>}
        <Pressable
          disabled={busy}
          onPress={() => {
            loadRevision.current++;
            setId(randomUUID());
            setMessages([]);
          }}
        >
          <Text>New conversation</Text>
        </Pressable>
        {history.map((c) => (
          <Pressable
            key={c.id}
            disabled={busy}
            onPress={() => {
              loadRevision.current++;
              setMessages([]);
              setId(c.id);
            }}
          >
            <Text>Conversation · {c.createdAt}</Text>
          </Pressable>
        ))}
        {messages.map((m, i) => (
          <BioCard key={i} style={{ gap: 10 }}>
            <Text>You: {m.question}</Text>
            {m.code && <Text>AI unavailable: {m.code}</Text>}
            {m.answer?.cards.map((card, j) => (
              <View key={j}>
                <Text>{card.text}</Text>
                {card.citations.map((c) => {
                  const source = sources.find(
                    (s) =>
                      s.id === c.observationId && s.revision === c.revision,
                  );
                  return source ? (
                    <Pressable
                      key={c.observationId}
                      onPress={() =>
                        router.push({
                          pathname: '/report',
                          params: { id: source.reportId },
                        })
                      }
                    >
                      <Text>
                        Source: {source.name} · page {source.pageNumber} ·
                        revision {c.revision}
                      </Text>
                    </Pressable>
                  ) : (
                    <Text key={c.observationId}>Evidence changed.</Text>
                  );
                })}
              </View>
            ))}
          </BioCard>
        ))}
      </ScrollView>
      <View
        style={{
          padding: 20,
          paddingBottom: 32,
          gap: 10,
          borderTopWidth: 1,
          borderColor: theme.color.border,
        }}
      >
        <TextInput
          accessibilityLabel="Ask about verified health evidence"
          placeholder="Ask about verified health evidence"
          multiline
          value={question}
          onChangeText={setQuestion}
          maxLength={2000}
          editable={!busy}
        />
        <Pressable
          style={{ minHeight: 48, justifyContent: 'center' }}
          disabled={busy || !question.trim()}
          onPress={() => void send()}
        >
          <Text>{busy ? 'Checking evidence…' : 'Ask AI'}</Text>
        </Pressable>
      </View>
    </View>
  );
}
