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
import { HealthDashboard } from './health-dashboard';
import {
  BioFlowBackground,
  Brand,
  EmptyState,
  Icon,
  LoadingSkeleton,
  SideDrawer,
} from './design-system';

type Tab =
  'dashboard' | 'health' | 'insights' | 'reports' | 'wellness' | 'community';
const navigation: { id: Tab; title: string }[] = [
  { id: 'dashboard', title: 'Dashboard' },
  { id: 'health', title: 'My Health' },
  { id: 'insights', title: 'Insights' },
  { id: 'reports', title: 'Labs & Reports' },
  { id: 'wellness', title: 'My Wellness' },
  { id: 'community', title: 'Community & Trends' },
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
  const [utility, setUtility] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [draftSearch, setDraftSearch] = useState('');
  const [guard] = useState(() =>
    createProfileView(() => {
      setContext({ profile: null, revision: 0 });
      setManagerOpen(false);
      setAssistantOpen(false);
      setUtility('');
      setSearch('');
      setDraftSearch('');
      setMenuOpen(false);
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
    const focus = (event: Event) => {
      if (event.target === window) void refresh();
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
  const nav = (
    <nav aria-label="Main navigation">
      {navigation.map((item) => (
        <Link
          key={item.id}
          href={`/${item.id}`}
          className={`nav-item ${tab === item.id ? 'active' : ''}`}
          aria-current={tab === item.id ? 'page' : undefined}
          onClick={() => {
            setMenuOpen(false);
            setSearch('');
          }}
        >
          <Icon name={item.id} />
          {item.title}
        </Link>
      ))}
    </nav>
  );
  return (
    <div
      className="app-layout"
      onClickCapture={(event) => {
        const control = (event.target as Element).closest(
          '[data-drawer-trigger]',
        );
        if (control instanceof HTMLElement || control instanceof SVGElement)
          control.focus({ preventScroll: true });
      }}
    >
      <BioFlowBackground />
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <aside className="sidebar">
        <Link href="/dashboard" aria-label="BiovitAI home">
          <Brand />
        </Link>
        {nav}
        <div className="utility-nav">
          <button
            data-drawer-trigger
            className="nav-item"
            onClick={() => setUtility('Notifications')}
          >
            <Icon name="bell" />
            Notifications
          </button>
          <button
            data-drawer-trigger
            className="nav-item"
            disabled={busy || !account}
            onClick={() => setManagerOpen(true)}
          >
            <Icon name="settings" />
            Settings
          </button>
          <button
            data-drawer-trigger
            className="nav-item"
            onClick={() => setUtility('Help & Support')}
          >
            <Icon name="help" />
            Help & Support
          </button>
        </div>
        <div className="assistant-card">
          <span className="orb">
            <Icon name="spark" size={28} />
          </span>
          <strong>Your AI health partner</strong>
          <p>Explore verified evidence, explanations and sources.</p>
          <button
            data-drawer-trigger
            className="primary"
            disabled={!profile || busy}
            onClick={() => setAssistantOpen(true)}
            aria-expanded={assistantOpen}
          >
            <Icon name="spark" />
            Health assistant
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button
            data-drawer-trigger
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            onClick={() => setMenuOpen(true)}
          >
            <Icon name="menu" />
          </button>
          <form
            className="global-search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(draftSearch.trim());
            }}
          >
            <Icon name="search" size={20} />
            <input
              aria-label="Search reports and biomarkers"
              type="search"
              value={draftSearch}
              onChange={(e) => {
                setDraftSearch(e.target.value);
                if (!e.target.value) setSearch('');
              }}
              placeholder="Search reports, biomarkers, or explore your evidence…"
            />
            <button
              className="quiet"
              disabled={!profile || busy}
              aria-label="Search"
            >
              Search
            </button>
          </form>
          <div className="top-actions">
            <Link className="secondary top-upload" href="/reports#upload">
              <Icon name="upload" />
              <span>Upload report</span>
            </Link>
            <button
              data-drawer-trigger
              className="icon-button top-bell"
              aria-label="Notifications"
              onClick={() => setUtility('Notifications')}
            >
              <Icon name="bell" />
            </button>
            <label className="profile-picker">
              <span>Viewing profile</span>
              <select
                aria-label="Viewing profile"
                value={profile?.id ?? ''}
                disabled={busy || !account}
                onChange={(e) => void select(e.target.value)}
              >
                <option value="" disabled>
                  {busy ? 'Loading…' : 'Select a profile'}
                </option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayName} · {p.kind === 'self' ? 'Me' : 'Family'}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>
        <main id="main" className="main-content">
          <div className="pilot-banner">
            <span className="status-dot" />
            Local pilot · Synthetic data only<span>BiovitAI BioFlow</span>
          </div>
          {tab !== 'dashboard' && (
            <div className="page-heading">
              <div>
                <p className="eyebrow">Your health, connected</p>
                <h1>{navigation.find((n) => n.id === tab)?.title}</h1>
                <p>
                  {tab === 'wellness'
                    ? 'Make room for feeling well.'
                    : tab === 'community'
                      ? 'A wider perspective.'
                      : 'Evidence you can explore, with sources you can inspect.'}
                </p>
              </div>
            </div>
          )}
          {error && (
            <div className="notice error" role="alert">
              {error}
              <button onClick={() => void refresh()}>Refresh selection</button>
            </div>
          )}
          {busy ? (
            <LoadingSkeleton />
          ) : (
            <>
              <section className="context-strip" aria-label="Current profile">
                <div className="avatar">
                  {profile?.displayName.charAt(0).toUpperCase() ?? '+'}
                </div>
                <div>
                  <strong>
                    {profile?.displayName ?? 'Choose who you’re caring for'}
                  </strong>
                  <p>
                    {profile
                      ? `${profile.kind === 'self' ? 'Your profile' : 'Family profile'} · All private views use this selection`
                      : 'Create your profile or a family member. Family email is optional.'}
                  </p>
                </div>
                <button
                  data-drawer-trigger
                  className="quiet"
                  disabled={!account}
                  onClick={() => setManagerOpen(true)}
                >
                  Manage profiles
                </button>
              </section>
              {!profile ? (
                <section className="card empty">
                  <EmptyState title="Every health story starts somewhere.">
                    <p>Select a profile, or add yourself or a family member.</p>
                  </EmptyState>
                  <button
                    data-drawer-trigger
                    className="primary"
                    disabled={!account}
                    onClick={() => setManagerOpen(true)}
                  >
                    Add a profile →
                  </button>
                </section>
              ) : (
                <ProfileContent
                  key={`${profile.id}:${context.revision}:${tab}`}
                  profile={profile}
                  tab={tab}
                  guard={guard}
                  communityEnabled={communityEnabled}
                  search={search}
                />
              )}
            </>
          )}
        </main>
      </div>
      {menuOpen && (
        <SideDrawer title="Navigation" onClose={() => setMenuOpen(false)}>
          {nav}
          <button
            data-drawer-trigger
            onClick={() => {
              setMenuOpen(false);
              setManagerOpen(true);
            }}
          >
            Settings & profiles
          </button>
          <button
            data-drawer-trigger
            disabled={!profile || busy}
            onClick={() => {
              setMenuOpen(false);
              setAssistantOpen(true);
            }}
          >
            Health assistant
          </button>
          <button
            data-drawer-trigger
            onClick={() => {
              setMenuOpen(false);
              setUtility('Help & Support');
            }}
          >
            Help & Support
          </button>
          <button
            data-drawer-trigger
            onClick={() => {
              setMenuOpen(false);
              setUtility('Notifications');
            }}
          >
            Notifications
          </button>
        </SideDrawer>
      )}
      {managerOpen && account && (
        <SideDrawer
          title="Profiles & privacy"
          onClose={() => setManagerOpen(false)}
        >
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
          <p className="muted">
            AI processing consent is managed inside the Health assistant for the
            selected profile.
          </p>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => void signOut()}
          >
            Sign out
          </button>
        </SideDrawer>
      )}
      {assistantOpen && profile && (
        <SideDrawer
          title={`Here for ${profile.displayName}`}
          onClose={() => setAssistantOpen(false)}
        >
          <section className="assistant-panel" aria-label="Health assistant">
            <button className="quiet" onClick={() => setAssistantOpen(false)}>
              Close ×
            </button>
            <HealthChat
              key={`${profile.id}:${context.revision}`}
              guard={guard}
              profile={profile}
            />
          </section>
        </SideDrawer>
      )}
      {utility && (
        <SideDrawer title={utility} onClose={() => setUtility('')}>
          {utility === 'Notifications' ? (
            <EmptyState title="Notifications are not available yet">
              <p>
                Reminder delivery has not been enabled for this local pilot.
                Report processing status is available in Labs & Reports.
              </p>
            </EmptyState>
          ) : (
            <>
              <h3>Start with a source</h3>
              <p>
                Choose a profile, upload a synthetic report, confirm its
                identity and verify extracted values against the source. Explore
                comparable results in Insights.
              </p>
              <h3>Family profiles</h3>
              <p>
                A family member can be added without an email. Adding a contact
                email later does not grant account access.
              </p>
              <h3>AI and evidence</h3>
              <p>
                AI explanations require optional consent and a configured
                provider. Organ assessments and wellness tracking are not
                active.
              </p>
            </>
          )}
        </SideDrawer>
      )}
    </div>
  );
}
function ProfileContent({
  profile,
  tab,
  communityEnabled,
  guard,
  search,
}: {
  profile: PublicProfile;
  tab: Tab;
  communityEnabled: boolean;
  guard: ReturnType<typeof createProfileView>;
  search: string;
}) {
  if (tab === 'dashboard' || search)
    return <HealthDashboard profile={profile} guard={guard} search={search} />;
  if (['health', 'reports', 'insights'].includes(tab))
    return (
      <ReportCenter
        profile={profile}
        guard={guard}
        mode={
          tab === 'insights'
            ? 'insights'
            : tab === 'reports'
              ? 'reports'
              : 'all'
        }
      />
    );
  return (
    <div className="overview-grid">
      <section className="card empty">
        {tab === 'community' && <span className="badge">Read-only pilot</span>}
        <EmptyState
          title={
            tab === 'wellness'
              ? 'Your next chapter in wellbeing.'
              : !communityEnabled
                ? 'Community is currently paused.'
                : 'Fresh perspectives are on their way.'
          }
        >
          <p>
            {tab === 'wellness'
              ? 'Goals, habits and wellness plans will appear here when those services are available.'
              : !communityEnabled
                ? 'You can continue using My Health and My Wellness.'
                : 'There are no published posts or trends yet. This pilot is read-only.'}
          </p>
        </EmptyState>
        <span className="badge">
          {tab === 'community' && !communityEnabled
            ? 'Feature paused'
            : 'Coming to the pilot'}
        </span>
        <span className="unavailable">
          {tab === 'wellness'
            ? 'Wellness tracking is not available yet'
            : 'Publishing is not available in this pilot'}
        </span>
      </section>
      <section className="card insight-card">
        <p className="eyebrow">Built around you</p>
        <h2>One person. One clear context.</h2>
        <p>
          You’re currently viewing {profile.displayName}. Use the profile picker
          to move between members of your family.
        </p>
        <div className="orb" aria-hidden="true">
          <Icon name="spark" size={28} />
        </div>
      </section>
    </div>
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
