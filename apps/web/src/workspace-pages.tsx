'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { PublicProfile } from '../../../shared/contracts/src/web';
import type { createProfileView } from '../../../shared/profile-context/src/index';
import {
  BioCard,
  EmptyState,
  Icon,
  LoadingSkeleton,
  StatusBadge,
} from './design-system';
import { BodyInsights, useHealthSnapshot } from './health-dashboard';
import { ReportCenter } from './report-center';
function PageArtwork({ kind }: { kind: 'wellness' | 'community' | 'health' }) {
  return (
    <div className={`page-artwork artwork-${kind}`} aria-hidden="true">
      <span className="art-orbit orbit-one" />
      <span className="art-orbit orbit-two" />
      <span className="art-core">
        <Icon name={kind} size={66} />
      </span>
      <span className="art-satellite">
        <Icon name={kind === 'community' ? 'chat' : 'wellness'} size={23} />
      </span>
      <span className="art-satellite satellite-two">
        <Icon name={kind === 'health' ? 'reports' : 'spark'} size={23} />
      </span>
    </div>
  );
}
function JourneyLink({
  href,
  icon,
  title,
  children,
  tone,
}: {
  href: string;
  icon: string;
  title: string;
  children: string;
  tone: string;
}) {
  return (
    <Link href={href} className={`journey-link tone-${tone}`}>
      <span className="journey-icon">
        <Icon name={icon} size={25} />
      </span>
      <div>
        <h3>{title}</h3>
        <p>{children}</p>
      </div>
      <Icon name="chevron" size={18} />
    </Link>
  );
}
export function HealthHome({
  profile,
  guard,
}: {
  profile: PublicProfile;
  guard: ReturnType<typeof createProfileView>;
}) {
  const { snapshot, error, refresh } = useHealthSnapshot(guard);
  const [sourceLink, setSourceLink] = useState(false);
  useEffect(() => {
    setSourceLink(new URL(window.location.href).searchParams.has('report'));
  }, []);
  const active = snapshot?.reports.filter((r) => r.state !== 'cancelled') ?? [];
  const verified = active.filter((r) => r.state === 'verified').length;
  return (
    <>
      <section className="page-hero hero-health">
        <div>
          <p className="eyebrow">My Health · {profile.displayName}</p>
          <h1>Your health, in perspective.</h1>
          <p>
            A home for your evidence. Understand what’s been verified, what
            needs a closer look, and where every result came from.
          </p>
          <div className="hero-links">
            <Link className="primary" href="/reports">
              Explore your reports <Icon name="chevron" size={17} />
            </Link>
            <Link className="quiet" href="/insights">
              See your trends
            </Link>
          </div>
        </div>
        <PageArtwork kind="health" />
      </section>
      <div className="journey-grid">
        <JourneyLink
          href="/reports#upload"
          icon="upload"
          title="Build your health library"
          tone="teal"
        >
          Keep your original reports in one private place.
        </JourneyLink>
        <JourneyLink
          href="/insights"
          icon="insights"
          title="Explore the patterns"
          tone="blue"
        >
          Follow comparable results across verified dates.
        </JourneyLink>
        <JourneyLink
          href="/reports"
          icon="check"
          title="Stay close to the source"
          tone="amber"
        >
          Review extracted values before they become evidence.
        </JourneyLink>
      </div>
      {error ? (
        <BioCard>
          <h2>Health evidence unavailable</h2>
          <p role="alert">{error}</p>
          <button onClick={() => void refresh()}>Retry loading evidence</button>
        </BioCard>
      ) : !snapshot ? (
        <LoadingSkeleton />
      ) : (
        <div className="health-home-grid">
          <BodyInsights organs={snapshot.analysis.organs} />
          <div className="health-home-side">
            <BioCard className="evidence-summary">
              <span className="section-icon tone-blue">
                <Icon name="reports" />
              </span>
              <p className="eyebrow">The evidence you have</p>
              <h2>Your health record</h2>
              <dl className="record-numbers">
                <div>
                  <dt>Original reports</dt>
                  <dd>{active.length}</dd>
                </div>
                <div>
                  <dt>Verified observations</dt>
                  <dd>{snapshot.observations.length}</dd>
                </div>
                <div>
                  <dt>Comparable trend groups</dt>
                  <dd>{snapshot.analysis.cohorts.length}</dd>
                </div>
              </dl>
              <div className="verification-progress">
                <span>Report verification</span>
                <strong>
                  {verified} of {active.length}
                </strong>
                {!!active.length && (
                  <progress
                    aria-label="Report verification progress"
                    value={verified}
                    max={active.length}
                  >
                    {verified} of {active.length} reports verified
                  </progress>
                )}
              </div>
              <p className="muted">
                Verification progress describes your records, not your health.
              </p>
            </BioCard>
            <BioCard className="source-story">
              <span className="section-icon tone-coral">
                <Icon name="book" />
              </span>
              <h2>Every value has a story.</h2>
              <p>
                Open a result to see the original page, its verification
                revision and the context used for comparison.
              </p>
              <Link href="/insights">
                Explore your evidence <Icon name="chevron" size={16} />
              </Link>
            </BioCard>
          </div>
        </div>
      )}
      <details className="health-workbench" open={sourceLink || undefined}>
        <summary>
          <Icon name="reports" />
          Open report workbench
          <span>Upload, verification, corrections and comparisons</span>
        </summary>
        <ReportCenter profile={profile} guard={guard} mode="reports" />
      </details>
    </>
  );
}
export function WellnessPage() {
  return (
    <>
      <section className="page-hero hero-wellness">
        <div>
          <p className="eyebrow">A little space for everyday wellbeing</p>
          <h1>My Wellness</h1>
          <p>
            Small moments. A little more balance.
            <br />
            Your future home for goals, habits and personal wellbeing.
          </p>
          <StatusBadge>Wellness tracking is not available yet</StatusBadge>
        </div>
        <PageArtwork kind="wellness" />
      </section>
      <div className="wellness-layout">
        <BioCard className="wellness-feature">
          <span className="section-icon tone-coral">
            <Icon name="wellness" size={29} />
          </span>
          <p className="eyebrow">Room to grow</p>
          <h2>Your next chapter in wellbeing.</h2>
          <p>
            Personalized plans, goals and check-ins will appear here when those
            services are available. For now, you can explore the evidence you
            already have.
          </p>
          <Link className="secondary" href="/health">
            Explore My Health <Icon name="chevron" size={17} />
          </Link>
          <div className="wellness-rhythm" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        </BioCard>
        <div className="wellness-side">
          <JourneyLink
            href="/insights"
            icon="insights"
            title="Start with understanding"
            tone="blue"
          >
            See how your verified results connect over time.
          </JourneyLink>
          <JourneyLink
            href="/reports"
            icon="reports"
            title="Bring your records together"
            tone="teal"
          >
            Build a clearer picture from your original reports.
          </JourneyLink>
          <div className="wellness-note">
            <Icon name="wellness" size={34} />
            <h3>Your pace. Your perspective.</h3>
            <p>
              Wellness recommendations and progress scores will remain
              unavailable until they are supported.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
export function CommunityPage({ enabled }: { enabled: boolean }) {
  return (
    <>
      <section className="page-hero hero-community">
        <div>
          <p className="eyebrow">A space for shared understanding</p>
          <h1>Community & Trends</h1>
          <p>
            A wider perspective on health and everyday wellbeing.
            <br />
            Thoughtful stories and conversations, when this space opens.
          </p>
          <StatusBadge tone="info">Read-only pilot</StatusBadge>
          {!enabled && <StatusBadge tone="warning">Feature paused</StatusBadge>}
        </div>
        <PageArtwork kind="community" />
      </section>
      <div className="community-layout">
        <BioCard className="community-canvas">
          <div className="community-paper" aria-hidden="true">
            <Icon name="book" size={38} />
            <span />
            <span />
            <span />
          </div>
          <EmptyState
            title={
              !enabled
                ? 'Community is currently paused.'
                : 'Fresh perspectives are on their way.'
            }
          >
            <p>
              {enabled
                ? 'There are no published posts or trends yet. This pilot is read-only.'
                : 'You can continue using My Health and My Wellness.'}
            </p>
          </EmptyState>
          <span className="badge">
            Publishing is not available in this pilot
          </span>
        </BioCard>
        <div className="community-side">
          <BioCard>
            <span className="section-icon tone-violet">
              <Icon name="community" size={25} />
            </span>
            <h2>
              More understanding.
              <br />
              More connection.
            </h2>
            <p>
              Future community content belongs here. Your family’s health
              reports stay in your private health space.
            </p>
          </BioCard>
          <div className="community-explore">
            <p className="eyebrow">Explore your own story</p>
            <JourneyLink
              href="/health"
              icon="health"
              title="Your health space"
              tone="teal"
            >
              Return to the evidence that’s personal to you.
            </JourneyLink>
            <JourneyLink
              href="/wellness"
              icon="wellness"
              title="Make room for wellbeing"
              tone="coral"
            >
              See what’s available in My Wellness.
            </JourneyLink>
          </div>
        </div>
      </div>
    </>
  );
}
