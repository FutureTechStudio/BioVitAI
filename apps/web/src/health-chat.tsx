'use client';
import { useEffect, useState, useRef } from 'react';
import { z } from 'zod';
import { ExplanationSchema } from '../../../shared/contracts/src/conversations';
import { ObservationEvidenceSchema } from '../../../shared/contracts/src/intelligence';
import type { createProfileView } from '../../../shared/profile-context/src/index';
import type { PublicProfile } from '../../../shared/contracts/src/web';
import { api, reportRequest, friendlyError, ApiError } from './api';
import { Icon } from './design-system';
const Message = z.object({
  question: z.string(),
  answer: ExplanationSchema.nullable(),
  code: z.string().nullable(),
});
export function HealthChat({
  guard,
  profile,
  conversationId,
  onConversation,
  expanded = false,
}: {
  guard: ReturnType<typeof createProfileView>;
  profile: PublicProfile;
  conversationId: string;
  onConversation: (id: string) => void;
  expanded?: boolean;
}) {
  const id = conversationId;
  const [conversations, setConversations] = useState<
      { id: string; createdAt: string }[]
    >([]),
    [messages, setMessages] = useState<z.infer<typeof Message>[]>([]),
    [question, setQuestion] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [needsConsent, setNeedsConsent] = useState(false),
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
      publish(() => {
        setConversations(list.conversations);
        setNeedsConsent(false);
      });
      if (selected && list.conversations.some((c) => c.id === selected)) {
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
        setConversations([]);
        const consentRequired =
          cause instanceof ApiError && cause.code === 'CONSENT_REQUIRED';
        setNeedsConsent(consentRequired);
        setError(
          consentRequired
            ? 'Choose whether to allow optional AI processing below before asking a question.'
            : friendlyError(cause),
        );
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
        setSources([]);
        setNeedsConsent(!granted);
        if (!granted) setConversations([]);
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
        const consentRequired =
          cause instanceof ApiError && cause.code === 'CONSENT_REQUIRED';
        setNeedsConsent(consentRequired);
        setError(
          consentRequired
            ? 'Choose whether to allow optional AI processing below before asking a question.'
            : friendlyError(cause),
        );
      });
    } finally {
      guard.publish(ticket, () => setBusy(false));
    }
  }
  return (
    <div className={`chat-layout ${expanded ? 'chat-expanded' : ''}`}>
      {expanded && (
        <aside className="chat-history" aria-label="Conversation history">
          <p className="eyebrow">Your conversations</p>
          <h3>History</h3>
          <p className="muted">Only {profile.displayName}’s conversations.</p>
          {!conversations.length && (
            <p>
              {needsConsent
                ? 'Conversation history requires AI consent for this profile.'
                : 'Saved conversations appear here when available.'}
            </p>
          )}
          {conversations.map((c) => (
            <button
              key={c.id}
              disabled={busy}
              aria-current={c.id === id ? 'true' : undefined}
              onClick={() => onConversation(c.id)}
            >
              <Icon name="chat" size={17} />
              <span>
                {c.id === id ? 'Current chat' : 'Conversation'}
                <small>
                  {new Date(c.createdAt).toLocaleString('en', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </small>
              </span>
            </button>
          ))}
        </aside>
      )}
      <div className="chat-main">
        <div className="chat-toolbar">
          <span className="badge badge-ai">Evidence-led conversations</span>
          <button
            disabled={busy}
            onClick={() => onConversation(crypto.randomUUID())}
          >
            <Icon name="plus" size={16} />
            New chat
          </button>
        </div>
        <div className="chat-feed">
          <details className="chat-privacy" open={needsConsent || undefined}>
            <summary>Privacy & AI consent</summary>
            <p>
              Optional AI explanations use verified results with OpenAI. You
              control whether this profile’s evidence is processed. You can
              withdraw consent at any time.
            </p>
            <div className="chat-consent">
              <button disabled={busy} onClick={() => void consent(true)}>
                Allow AI processing for this profile
              </button>
              <button disabled={busy} onClick={() => void consent(false)}>
                Withdraw AI consent
              </button>
            </div>
          </details>
          {error && (
            <p className="chat-notice" role="status">
              {error}
            </p>
          )}
          {!messages.length && (
            <div className="chat-welcome">
              <span className="assistant-emblem">
                <Icon name="spark" size={28} />
              </span>
              <h3>Make sense of your health story.</h3>
              <p>
                Explore verified results, compare changes and follow every
                explanation back to its source.
              </p>
              <div className="chat-prompts">
                {[
                  'Help me understand my verified results.',
                  'Which results can I compare over time?',
                ].map((prompt) => (
                  <button key={prompt} onClick={() => setQuestion(prompt)}>
                    {prompt}
                    <Icon name="chevron" size={15} />
                  </button>
                ))}
              </div>
            </div>
          )}
          <div role="log" aria-live="polite" aria-label="Current conversation">
            {messages.map((m, index) => (
              <article key={index}>
                <h3>You</h3>
                <p>{m.question}</p>
                {m.code && (
                  <p>
                    AI unavailable: {m.code.replaceAll('_', ' ').toLowerCase()}
                  </p>
                )}
                {m.answer?.cards.map((card, j) => (
                  <section key={j}>
                    <h4>
                      {card.kind === 'summary'
                        ? 'Evidence summary'
                        : 'Limitation'}
                    </h4>
                    <p>{card.text}</p>
                    <ul>
                      {card.citations.map((c) => {
                        const source = sources.find(
                          (s) =>
                            s.id === c.observationId &&
                            s.revision === c.revision,
                        );
                        return (
                          <li key={c.observationId}>
                            {source ? (
                              <a
                                href={`/reports?report=${source.reportId}`}
                                aria-label={`Source for ${source.name}, page ${source.pageNumber}`}
                              >
                                {source.name} · page {source.pageNumber} ·
                                revision {c.revision}
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
        </div>
        <form
          className="chat-composer"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <label className="chat-input-label">
            <span className="sr-only">
              Ask about {profile.displayName}’s verified evidence
            </span>
            <textarea
              placeholder="Ask about your verified evidence…"
              rows={2}
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
          <small>
            AI explanations can be unavailable. Your verified reports remain
            accessible.
          </small>
        </form>
      </div>
    </div>
  );
}
