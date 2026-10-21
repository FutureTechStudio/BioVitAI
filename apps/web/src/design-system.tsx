'use client';
import { useEffect, useId, useRef } from 'react';
import type { ReactNode, HTMLAttributes } from 'react';
import { iconPaths } from '../../../shared/design-tokens/src/index';
export function Icon({ name, size = 22 }: { name: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={iconPaths[name] ?? iconPaths.health} />
    </svg>
  );
}
export function Brand() {
  return (
    <span className="brand">
      <svg width="34" height="44" viewBox="0 0 34 44" aria-hidden="true">
        <path
          d="M27 1C34 20 9 21 8 42 0 30 0 18 14 12c6-3 9-5 13-11Z"
          fill="var(--bf-aqua)"
        />
        <path
          d="M6 40C7 25 23 21 27 11 28 26 17 32 6 40Z"
          fill="var(--bf-teal)"
        />
      </svg>
      <span>
        Biovit<span className="brand-ai">AI</span>
      </span>
    </span>
  );
}
export function BioFlowBackground() {
  return (
    <svg
      className="bio-background"
      viewBox="0 0 1400 1000"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <g fill="none" stroke="var(--bf-teal)" strokeWidth="1">
        <path d="M-60 800Q150 300 450-80Q490 260 100 650ZM-30 780 430-50M30 650 45 400M110 515l120-30M230 325l20-180M1290-60Q980 250 1510 570Q1500 120 1290-60ZM1300-50l180 550M1350 100l-100 45M1390 240l90-20" />
        <circle cx="1100" cy="850" r="150" />
        <circle cx="1100" cy="850" r="190" />
        <path d="m1050 70 60 35 60-35 60 35m-120 0v70m60-105v-60" />
      </g>
    </svg>
  );
}
export function BioCard({
  children,
  className = '',
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <section {...props} className={`card ${className}`}>
      {children}
    </section>
  );
}
export function StatusBadge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'error' | 'info';
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
export function EmptyState({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name="wellness" size={30} />
      </span>
      <h3>{title}</h3>
      <div className="muted">{children}</div>
    </div>
  );
}
export function LoadingSkeleton() {
  return (
    <div
      className="skeleton"
      role="status"
      aria-label="Loading health evidence"
    >
      <h2>Opening your space…</h2>
      <span />
      <span />
      <span />
    </div>
  );
}
export function SideDrawer({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    id = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, []);
  return (
    <dialog
      className="bio-drawer"
      ref={ref}
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="drawer-content">
        <header>
          <h2 id={id}>{title}</h2>
          <button
            className="icon-button"
            aria-label="Close panel"
            onClick={onClose}
            autoFocus
          >
            <Icon name="close" />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
