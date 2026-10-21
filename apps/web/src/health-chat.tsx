'use client';
import { useEffect, useState, useRef } from 'react';
import { z } from 'zod';
import { ExplanationSchema } from '../../../shared/contracts/src/conversations';
import { ObservationEvidenceSchema } from '../../../shared/contracts/src/intelligence';
import type { createProfileView } from '../../../shared/profile-context/src/index';
import type { PublicProfile } from '../../../shared/contracts/src/web';
import { api, reportRequest, friendlyError, ApiError } from './api';
const Message = z.object({
  question: z.string(),
  answer: ExplanationSchema.nullable(),
  code: z.string().nullable(),
});
export function HealthChat({
  guard,
  profile,
}: {
  guard: ReturnType<typeof createProfileView>;
  profile: PublicProfile;
}) {
  const [id, setId] = useState(() => crypto.randomUUID()),
    [conversations, setConversations] = useState<
      { id: string; createdAt: string }[]
    >([]),
    [messages, setMessages] = useState<z.infer<typeof Message>[]>([]),
    [question, setQuestion] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [sources, setSources] = useState<
      z.infer<typeof ObservationEvidenceSchema>[]
    >([]);
  const loadRevision = useRef(0);
  async function load(selected?: string) {
    const revision = ++loadRevision.current;
    const ticket = guard.request();
    const publish = (work: () => void) => {
      if (revision === loadRevision.current) guard.publish(ticket, work);
    };
    try {
      const list = z
        .object({
          conversations: z.array(
            z.object({ id: z.uuid(), createdAt: z.string() }),
          ),
        })
        .parse(
          await reportRequest('/v1/health/conversations', ticket.context, {
            signal: ticket.signal,
          }),
        );
      publish(() => setConversations(list.conversations));
      if (selected) {
        const data = z
          .object({ messages: z.array(Message) })
          .parse(
            await reportRequest(
              '/v1/health/conversations/' + selected,
              ticket.context,
              { signal: ticket.signal },
            ),
          );
        publish(() => {
          setMessages(data.messages);
          setId(selected);
        });
      }
      const evidence = z
        .object({ observations: z.array(ObservationEvidenceSchema) })
        .parse(
          await reportRequest('/v1/health/observations', ticket.context, {
            signal: ticket.signal,
          }),
        );
      publish(() => setSources(evidence.observations));
    } catch (cause) {
      publish(() => {
        setMessages([]);
        setSources([]);
        setError(friendlyError(cause));
      });
      if (
        revision === loadRevision.current &&
        cause instanceof ApiError &&
        [401, 403, 404].includes(cause.status) &&
        cause.code !== 'CONSENT_REQUIRED'
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
    const ticket = guard.request();
    try {
      await api(
        `/v1/profiles/${ticket.context.profileId}/consents`,
        { purpose: 'health_ai', noticeVersion: 'pilot-v1', granted },
        ticket.signal,
      );
      guard.publish(ticket, () => {
        setMessages([]);
        setError(
          granted
            ? 'AI processing consent recorded. Only verified results are sent when you ask.'
            : 'AI consent withdrawn.',
        );
      });
      if (granted) await load();
    } catch (cause) {
      guard.publish(ticket, () => setError(friendlyError(cause)));
    }
  }
  async function send() {
    loadRevision.current++;
    const ticket = guard.request();
    setBusy(true);
    setError('');
    try {
      const data = z
        .object({
          answer: ExplanationSchema.nullable(),
          code: z.string().nullable(),
        })
        .parse(
          await reportRequest('/v1/health/messages', ticket.context, {
            body: {
              context: ticket.context,
              conversationId: id,
              requestKey: crypto.randomUUID(),
              question,
            },
            signal: ticket.signal,
          }),
        );
      guard.publish(ticket, () => {
        setMessages((old) => [...old, { question, ...data }]);
        setQuestion('');
      });
      await load();
    } catch (cause) {
      guard.publish(ticket, () => {
        setMessages([]);
        setSources([]);
        setError(friendlyError(cause));
      });
    } finally {
      guard.publish(ticket, () => setBusy(false));
    }
  }
  return (
    <>
      <p>
        Optional AI explanations use verified results with OpenAI. Credentials,
        model and pricing must be configured locally. Consent can be withdrawn
        at any time.
      </p>
      <div className="chat-consent">
        <button onClick={() => void consent(true)}>
          Allow AI processing for this profile
        </button>
        <button onClick={() => void consent(false)}>Withdraw AI consent</button>
      </div>
      <label>
        Conversation
        <select
          value={id}
          disabled={busy}
          onChange={(e) => {
            loadRevision.current++;
            setMessages([]);
            setId(e.target.value);
          }}
        >
          <option value={id}>Current conversation</option>
          {conversations
            .filter((c) => c.id !== id)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.createdAt}
              </option>
            ))}
        </select>
      </label>
      <button
        disabled={busy}
        onClick={() => {
          loadRevision.current++;
          setId(crypto.randomUUID());
          setMessages([]);
        }}
      >
        New conversation
      </button>
      {error && <p role="status">{error}</p>}
      <div role="log" aria-live="polite">
        {messages.map((m, index) => (
          <article key={index}>
            <h3>You</h3>
            <p>{m.question}</p>
            {m.code && (
              <p>AI unavailable: {m.code.replaceAll('_', ' ').toLowerCase()}</p>
            )}
            {m.answer?.cards.map((card, j) => (
              <section key={j}>
                <h4>
                  {card.kind === 'summary' ? 'Evidence summary' : 'Limitation'}
                </h4>
                <p>{card.text}</p>
                <ul>
                  {card.citations.map((c) => {
                    const source = sources.find(
                      (s) =>
                        s.id === c.observationId && s.revision === c.revision,
                    );
                    return (
                      <li key={c.observationId}>
                        {source ? (
                          <a
                            href={`/health?report=${source.reportId}`}
                            aria-label={`Source for ${source.name}, page ${source.pageNumber}`}
                          >
                            {source.name} · page {source.pageNumber} · revision{' '}
                            {c.revision}
                          </a>
                        ) : (
                          'Evidence changed. Reload this conversation.'
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </article>
        ))}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <label>
          Ask about {profile.displayName}’s verified evidence
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            required
            maxLength={2000}
            disabled={busy}
          />
        </label>
        <button className="primary" disabled={busy}>
          {busy ? 'Checking evidence…' : 'Ask AI'}
        </button>
      </form>
    </>
  );
}
