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
import { AssistantWindow } from './assistant-window';
import { ProfileMenu } from './profile-menu';
import { sessionConversation, clearConversationSession } from './chat-session';
import { HealthHome, WellnessPage, CommunityPage } from './workspace-pages';
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
  const [profilePanel, setProfilePanel] = useState('');
  const [sessionScope, setSessionScope] = useState('');
  const [chatId, setChatId] = useState('');
  const [utility, setUtility] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [draftSearch, setDraftSearch] = useState('');
  const [guard] = useState(() =>
    createProfileView(() => {
      setContext({ profile: null, revision: 0 });
      setManagerOpen(false);
      setAssistantOpen(false);
      setProfilePanel('');
      setChatId('');
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
      const auth = z
        .object({ session: z.object({ id: z.string().min(1) }) })
        .parse(await api('/api/auth/get-session'));
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
        setSessionScope(`${me.actor.id}:${auth.session.id}`);
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
    clearConversationSession(sessionScope);
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
  function openAssistant() {
    if (!profile || !sessionScope) return;
    setChatId(sessionConversation(sessionScope, profile.id));
    setAssistantOpen(true);
  }
  const nav = (
    <nav aria-label="Main navigation">
      {navigation.map((item) => (
        <Link
          key={item.id}
          href={`/${item.id}`}
          className={`nav-item nav-${item.id} ${tab === item.id ? 'active' : ''}`}
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
        <div className="sidebar-footnote">
          <span className="status-dot" />
          Your health, connected.<small>A private space for your family.</small>
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
            <ProfileMenu
              key={`${profile?.id ?? 'none'}:${context.revision}`}
              name={profile?.displayName ?? 'Choose who you’re caring for'}
              disabled={busy || !account}
              onChoose={(action) => {
                if (action === 'Manage Profiles') setManagerOpen(true);
                else setProfilePanel(action);
              }}
            />
          </div>
        </header>
        <main id="main" className={`main-content page-${tab}`}>
          <div className="pilot-banner">
            <span className="status-dot" />
            Local pilot · Synthetic data only<span>BiovitAI BioFlow</span>
          </div>
          {['reports', 'insights'].includes(tab) && (
            <div className={`page-heading page-hero hero-${tab}`}>
              <div>
                <p className="eyebrow">
                  {tab === 'reports'
                    ? 'Your personal health library'
                    : 'Patterns with provenance'}
                </p>
                <h1>{navigation.find((n) => n.id === tab)?.title}</h1>
                <p>
                  {tab === 'reports'
                    ? 'Every report, a clearer chapter. Upload, verify and keep the original close.'
                    : 'Connect the dots over time. Explore verified results and the evidence behind them.'}
                </p>
              </div>
              <div className="hero-art" aria-hidden="true">
                <Icon name={tab} size={76} />
                <span />
                <span />
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
            onSelect={async (id) => {
              await select(id);
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
      <button
        data-drawer-trigger
        className="assistant-fab"
        aria-label="Health assistant"
        aria-expanded={assistantOpen}
        disabled={!profile || busy || !sessionScope}
        onClick={openAssistant}
      >
        <Icon name="spark" size={27} />
        <span>Ask BiovitAI</span>
      </button>
      {assistantOpen && profile && chatId && (
        <AssistantWindow
          profile={profile}
          guard={guard}
          conversationId={chatId}
          onConversation={(id) =>
            setChatId(sessionConversation(sessionScope, profile.id, id))
          }
          onClose={() => setAssistantOpen(false)}
        />
      )}
      {profilePanel && account && (
        <SideDrawer title={profilePanel} onClose={() => setProfilePanel('')}>
          {profilePanel === 'Switch Profile' ? (
            <>
              <p className="muted">
                Choose whose reports and conversations you want to see.
              </p>
              <label>
                Viewing profile
                <select
                  aria-label="Viewing profile"
                  value={profile?.id ?? ''}
                  disabled={busy}
                  onChange={(e) => void select(e.target.value)}
                >
                  <option disabled value="">
                    Select a profile
                  </option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.displayName} · {p.kind === 'self' ? 'Me' : 'Family'}
                    </option>
                  ))}
                </select>
              </label>
              <div className="profile-switch-list">
                {profiles.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => void select(p.id)}
                    aria-pressed={p.id === profile?.id}
                  >
                    <span className="profile-avatar">
                      {p.displayName.charAt(0)}
                    </span>
                    <span>
                      <strong>{p.displayName}</strong>
                      <small>
                        {p.kind === 'self' ? 'Your profile' : 'Family profile'}
                      </small>
                    </span>
                    {p.id === profile?.id ? (
                      <Icon name="check" size={18} />
                    ) : (
                      <Icon name="chevron" size={18} />
                    )}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="profile-details-hero">
                <span className="profile-avatar">
                  <Icon name="user" size={30} />
                </span>
                <h3>
                  {profiles.find(
                    (p) => p.kind === 'self' && p.ownerId === account.id,
                  )?.displayName ?? 'Your account'}
                </h3>
                <p>{account.email}</p>
              </div>
              <p>
                Your sign-in account and the family profile you’re viewing are
                managed separately.
              </p>
              <button
                className="secondary"
                onClick={() => {
                  setProfilePanel('');
                  setManagerOpen(true);
                }}
              >
                Manage Profiles
              </button>
              <button onClick={() => void signOut()}>Sign out</button>
            </>
          )}
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
  if (tab === 'health') return <HealthHome profile={profile} guard={guard} />;
  if (tab === 'reports' || tab === 'insights')
    return <ReportCenter profile={profile} guard={guard} mode={tab} />;
  if (tab === 'wellness') return <WellnessPage />;
  return <CommunityPage enabled={communityEnabled} />;
}

function ProfileManager({
  profiles,
  accountId,
  selected,
  guard,
  onCreated,
  onSelect,
}: {
  profiles: PublicProfile[];
  accountId: string;
  selected: PublicProfile | null;
  guard: ReturnType<typeof createProfileView>;
  onCreated: () => Promise<void>;
  onSelect: (id: string) => Promise<void>;
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
      {!!profiles.length && (
        <div
          className="managed-profiles"
          role="list"
          aria-label="Managed profiles"
        >
          {profiles.map((p) => (
            <div role="listitem" key={p.id}>
              <button
                type="button"
                onClick={() => void onSelect(p.id)}
                aria-pressed={selected?.id === p.id}
              >
                <span className="profile-avatar">
                  {p.displayName.charAt(0)}
                </span>
                <span>
                  <strong>{p.displayName}</strong>
                  <small>
                    {p.kind === 'self' ? 'Your profile' : 'Family profile'}
                  </small>
                </span>
                <Icon
                  name={selected?.id === p.id ? 'check' : 'chevron'}
                  size={17}
                />
              </button>
            </div>
          ))}
        </div>
      )}
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
