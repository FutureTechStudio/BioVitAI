'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { z } from 'zod';
import {
  CurrentAccountSchema,
  ProfileContextSchema,
  ProfileListSchema,
  PublicProfileSchema,
} from '../../../shared/contracts/src/web';
import type {
  PublicProfile,
  PublicProfileContext,
} from '../../../shared/contracts/src/web';
import { createProfileView } from '../../../shared/profile-context/src/index';
import { api, ApiError, friendlyError } from './api';
import { ReportCenter } from './report-center';
import { HealthChat } from './health-chat';

type Tab = 'health' | 'wellness' | 'community';
const navigation: { id: Tab; title: string; symbol: string }[] = [
  { id: 'health', title: 'My Health', symbol: '♡' },
  { id: 'wellness', title: 'My Wellness', symbol: '✳' },
  { id: 'community', title: 'Community & Trends', symbol: '◎' },
];
export function Shell({
  tab,
  communityEnabled = true,
}: {
  tab: Tab;
  communityEnabled?: boolean;
}) {
  const [account, setAccount] = useState<{ id: string; email: string } | null>(
    null,
  );
  const [profiles, setProfiles] = useState<PublicProfile[]>([]);
  const [context, setContext] = useState<PublicProfileContext>({
    profile: null,
    revision: 0,
  });
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [managerOpen, setManagerOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [guard] = useState(() =>
    createProfileView(() => {
      setContext({ profile: null, revision: 0 });
      setManagerOpen(false);
      setAssistantOpen(false);
    }),
  );
  const refresh = useCallback(async () => {
    const attempt = guard.beginSelection();
    setBusy(true);
    setError('');
    try {
      const me = CurrentAccountSchema.parse(await api('/v1/me'));
      const list = ProfileListSchema.parse(await api('/v1/profiles'));
      const selected = ProfileContextSchema.parse(
        await api('/v1/profile-context'),
      );
      if (
        guard.applySelection(
          attempt,
          selected.profile
            ? { profileId: selected.profile.id, revision: selected.revision }
            : null,
        )
      ) {
        setAccount(me.actor);
        setProfiles(list.profiles);
        setContext(selected);
        setBusy(false);
      }
    } catch (cause) {
      if (guard.applySelection(attempt, null)) {
        setBusy(false);
        setAccount(null);
        setProfiles([]);
        setError(friendlyError(cause));
        if (cause instanceof ApiError && cause.status === 401)
          window.location.replace('/auth');
      }
    }
  }, [guard]);
  useEffect(() => {
    void refresh();
    const visibility = () => {
      if (document.visibilityState === 'hidden') {
        guard.clear();
        setBusy(true);
      } else void refresh();
    };
    const focus = () => {
      void refresh();
    };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('focus', focus);
    window.addEventListener('pageshow', focus);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('focus', focus);
      window.removeEventListener('pageshow', focus);
      guard.clear();
    };
  }, [guard, refresh]);
  async function select(profileId: string) {
    const expectedRevision = context.revision;
    const attempt = guard.beginSelection();
    setBusy(true);
    setError('');
    try {
      const selected = ProfileContextSchema.parse(
        await api('/v1/profile-context', { profileId, expectedRevision }),
      );
      if (
        guard.applySelection(
          attempt,
          selected.profile
            ? { profileId: selected.profile.id, revision: selected.revision }
            : null,
        )
      ) {
        setContext(selected);
        setBusy(false);
      }
    } catch (cause) {
      if (guard.applySelection(attempt, null)) {
        setBusy(false);
        setError(friendlyError(cause));
      }
    }
  }
  async function signOut() {
    guard.clear();
    setBusy(true);
    setAccount(null);
    setProfiles([]);
    try {
      await api('/api/auth/sign-out', {});
      window.location.replace('/auth');
    } catch (cause) {
      setError(friendlyError(cause));
      setBusy(false);
    }
  }
  const profile = context.profile;
  return (
    <div className="app-layout">
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <aside className="sidebar">
        <Link className="brand" href="/health">
          bio<span>vit</span>ai<span className="brand-dot">✳</span>
        </Link>
        <p className="nav-caption">YOUR EVERYDAY HEALTH SPACE</p>
        <nav aria-label="Main navigation">
          {navigation.map((item) => (
            <Link
              key={item.id}
              href={`/${item.id}`}
              className={`nav-item ${tab === item.id ? 'active' : ''}`}
              aria-current={tab === item.id ? 'page' : undefined}
            >
              <span aria-hidden="true">{item.symbol}</span>
              {item.title}
            </Link>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="leaf">✳</span>
          <strong>Care starts with clarity.</strong>
          <p>Small steps. A bigger picture.</p>
        </div>
        <div className="sidebar-footer">
          <span className="status-dot" /> Local pilot <span>EN</span>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span className="breadcrumb">
            Your space <span>/</span>{' '}
            {navigation.find((item) => item.id === tab)?.title}
          </span>
          <div className="top-actions">
            <label className="profile-picker">
              <span>Viewing profile</span>
              <select
                aria-label="Viewing profile"
                value={profile?.id ?? ''}
                disabled={busy || !account}
                onChange={(event) => void select(event.target.value)}
              >
                <option value="" disabled>
                  {busy ? 'Loading…' : 'Select a profile'}
                </option>
                {profiles.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.displayName} ·{' '}
                    {item.kind === 'self' ? 'Me' : 'Family'}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="quiet"
              onClick={() => void signOut()}
              disabled={busy || !account}
            >
              Sign out
            </button>
          </div>
        </header>
        <main id="main" className="main-content">
          <div className="pilot-banner">
            <span className="status-dot" /> Development pilot{' '}
            <span>Synthetic data only</span>
          </div>
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {tab === 'community'
                  ? 'LEARN & CONNECT'
                  : 'A LITTLE MORE CLARITY, EVERY DAY'}
              </p>
              <h1>
                {tab === 'health'
                  ? 'Your health, in view.'
                  : tab === 'wellness'
                    ? 'Make room for feeling well.'
                    : 'A wider perspective.'}
              </h1>
              <p>
                {tab === 'health'
                  ? 'A thoughtful home for your reports and health story.'
                  : tab === 'wellness'
                    ? 'Build a picture of the habits that matter to you.'
                    : 'Discover perspectives on health and everyday wellbeing.'}
              </p>
            </div>
            <button
              className="secondary"
              onClick={() => setManagerOpen((value) => !value)}
              disabled={busy || !account}
            >
              ＋ Manage profiles
            </button>
          </div>
          {error && (
            <div className="notice error" role="alert">
              {error}{' '}
              <button onClick={() => void refresh()}>Refresh selection</button>
            </div>
          )}
          {busy ? (
            <section className="card empty" role="status">
              <span className="empty-symbol">◌</span>
              <h2>Opening your space…</h2>
              <p>Checking your account and selected profile.</p>
            </section>
          ) : (
            <>
              {managerOpen && account && (
                <ProfileManager
                  profiles={profiles}
                  accountId={account.id}
                  selected={profile}
                  guard={guard}
                  onCreated={async () => {
                    await refresh();
                    setManagerOpen(true);
                  }}
                />
              )}
              <section className="context-strip" aria-label="Current profile">
                <div className="avatar">
                  {profile?.displayName.charAt(0).toUpperCase() ?? '＋'}
                </div>
                <div>
                  <strong>
                    {profile?.displayName ?? 'Choose who you’re caring for'}
                  </strong>
                  <p>
                    {profile
                      ? `${profile.kind === 'self' ? 'Your profile' : 'Family profile'} · All private views use this selection`
                      : 'Add your own profile or a family member. An email is optional for family profiles.'}
                  </p>
                </div>
                <span className="badge">
                  {profile ? 'Profile selected' : 'Selection needed'}
                </span>
              </section>
              {!profile ? (
                <section className="card empty">
                  <span className="empty-symbol">♡</span>
                  <h2>Every health story starts somewhere.</h2>
                  <p>Choose a profile above, or create one to get started.</p>
                  <button
                    className="primary"
                    onClick={() => setManagerOpen(true)}
                    disabled={!account}
                  >
                    Add a profile →
                  </button>
                </section>
              ) : (
                <ProfileContent
                  key={`${profile.id}:${context.revision}:${tab}`}
                  profile={profile}
                  tab={tab}
                  communityEnabled={communityEnabled}
                  guard={guard}
                />
              )}
              <section className="next-step">
                <div>
                  <p className="eyebrow">YOUR FAMILY, ONE PLACE</p>
                  <h2>A space for everyone you care about.</h2>
                  <p>
                    Create family profiles today. Add a contact email later,
                    whenever you’re ready.
                  </p>
                </div>
                <button
                  className="text-button"
                  disabled={!account}
                  onClick={() => setManagerOpen(true)}
                >
                  Manage family →
                </button>
              </section>
            </>
          )}
          <footer className="page-footer">
            <span>BiovitAI · Health with a human perspective.</span>
            <span>Local development · English</span>
          </footer>
        </main>
        <button
          className="assistant-launch"
          disabled={!profile || busy}
          onClick={() => setAssistantOpen((value) => !value)}
          aria-expanded={assistantOpen}
        >
          ✳ Health assistant
        </button>
        {assistantOpen && profile && (
          <section className="assistant-panel" aria-label="Health assistant">
            <button className="quiet" onClick={() => setAssistantOpen(false)}>
              Close ×
            </button>
            <h2>Here for {profile.displayName}</h2>
            <HealthChat
              key={`${profile.id}:${context.revision}`}
              guard={guard}
              profile={profile}
            />
          </section>
        )}
      </div>
    </div>
  );
}

function ProfileContent({
  profile,
  tab,
  communityEnabled,
  guard,
}: {
  profile: PublicProfile;
  tab: Tab;
  communityEnabled: boolean;
  guard: ReturnType<typeof createProfileView>;
}) {
  const health = tab === 'health';
  if (health) return <ReportCenter profile={profile} guard={guard} />;
  return (
    <>
      <div className="section-title">
        <h2>
          {health
            ? 'Your health overview'
            : tab === 'wellness'
              ? 'Your wellness space'
              : 'Community & Trends'}
        </h2>
        <span className="muted">
          {tab === 'community'
            ? 'Read-only pilot'
            : `For ${profile.displayName}`}
        </span>
      </div>
      <div className="overview-grid">
        <section className="card empty overview-main">
          <span className="empty-symbol">
            {health ? '▤' : tab === 'wellness' ? '✳' : '◎'}
          </span>
          <span className="badge">
            {tab === 'community' && !communityEnabled
              ? 'Feature paused'
              : 'Coming to the pilot'}
          </span>
          <h2>
            {health
              ? 'Your reports will live here.'
              : tab === 'wellness'
                ? 'Your next chapter in wellbeing.'
                : !communityEnabled
                  ? 'Community is currently paused.'
                  : 'Fresh perspectives are on their way.'}
          </h2>
          <p>
            {health
              ? 'Report upload and extraction are the next stage. Once connected, this space will help you follow your health over time.'
              : tab === 'wellness'
                ? 'Goals, habits and wellness plans will appear here when those services are available.'
                : !communityEnabled
                  ? 'You can continue using My Health and My Wellness.'
                  : 'There are no published posts or trends yet. This pilot is read-only.'}
          </p>
          <span className="unavailable">
            {health
              ? 'Report upload is not available yet'
              : tab === 'wellness'
                ? 'Wellness tracking is not available yet'
                : 'Publishing is not available in this pilot'}
          </span>
        </section>
        <section className="card insight-card">
          <p className="eyebrow">
            {health ? 'THE BIGGER PICTURE' : 'BUILT AROUND YOU'}
          </p>
          <h2>
            {health
              ? 'A story, beyond a single result.'
              : 'One person. One clear context.'}
          </h2>
          <p>
            {health
              ? 'As reports become available, you’ll be able to explore them together. There are no report-derived insights for this profile yet.'
              : `You’re currently viewing ${profile.displayName}. Use the profile picker to move between members of your family.`}
          </p>
          <div className="orb" aria-hidden="true">
            <span>✳</span>
          </div>
          <small>Understand. Reflect. Take the next step.</small>
        </section>
      </div>
    </>
  );
}

function ProfileManager({
  profiles,
  accountId,
  selected,
  guard,
  onCreated,
}: {
  profiles: PublicProfile[];
  accountId: string;
  selected: PublicProfile | null;
  guard: ReturnType<typeof createProfileView>;
  onCreated: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = event.currentTarget;
    const data = new FormData(form);
    const contactEmail = String(data.get('email') ?? '').trim();
    try {
      PublicProfileSchema.parse(
        z.object({ profile: PublicProfileSchema }).parse(
          await api('/v1/profiles', {
            displayName: data.get('displayName'),
            kind: data.get('kind'),
            ...(contactEmail ? { contactEmail } : {}),
          }),
        ).profile,
      );
      form.reset();
      await onCreated();
    } catch (cause) {
      setError(friendlyError(cause));
    } finally {
      setBusy(false);
    }
  }
  async function saveContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const ticket = guard.request();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api(
        `/v1/profiles/${ticket.context.profileId}/contact`,
        { email: String(data.get('contact') ?? '').trim() || null },
        ticket.signal,
      );
      guard.publish(ticket, () =>
        setMessage('Contact email saved. Account access has not changed.'),
      );
    } catch (cause) {
      guard.publish(ticket, () => setError(friendlyError(cause)));
    } finally {
      guard.publish(ticket, () => setBusy(false));
    }
  }
  return (
    <section className="card profile-manager">
      <h2>Your family profiles</h2>
      <p className="muted">
        You stay signed in as the manager. A contact email does not grant
        account access.
      </p>
      <form className="profile-form" onSubmit={create}>
        <label>
          Profile name
          <input name="displayName" required maxLength={100} />
        </label>
        <label>
          Profile type
          <select
            name="kind"
            defaultValue={
              profiles.some(
                (item) => item.kind === 'self' && item.ownerId === accountId,
              )
                ? 'family'
                : 'self'
            }
          >
            <option value="self">My own profile</option>
            <option value="family">Family member</option>
          </select>
        </label>
        <label>
          Contact email (optional)
          <input name="email" type="email" maxLength={254} />
        </label>
        <button className="primary" disabled={busy}>
          Add profile
        </button>
      </form>
      {selected?.ownerId === accountId && (
        <form className="contact-form" onSubmit={saveContact} key={selected.id}>
          <label>
            New contact email for {selected.displayName}
            <input
              name="contact"
              type="email"
              maxLength={254}
              placeholder="Leave blank to remove contact email"
            />
          </label>
          <button className="secondary" disabled={busy}>
            Save contact email
          </button>
        </form>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
