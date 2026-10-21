'use client';
import { useEffect, useRef, useState } from 'react';
import type { createProfileView } from '../../../shared/profile-context/src/index';
import type { PublicProfile } from '../../../shared/contracts/src/web';
import { Icon } from './design-system';
import { HealthChat } from './health-chat';
export function AssistantWindow({
  guard,
  profile,
  conversationId,
  onConversation,
  onClose,
}: {
  guard: ReturnType<typeof createProfileView>;
  profile: PublicProfile;
  conversationId: string;
  onConversation: (id: string) => void;
  onClose: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const ref = useRef<HTMLDialogElement>(null),
    launcher = useRef<Element | null>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);
  useEffect(() => {
    launcher.current = document.activeElement;
    return () => {
      if (
        launcher.current instanceof HTMLElement &&
        launcher.current.isConnected
      )
        launcher.current.focus();
    };
  }, []);
  useEffect(() => {
    const dialog = ref.current!;
    if (expanded) dialog.showModal();
    else dialog.show();
    const escape = (e: KeyboardEvent) => {
      if (
        e.key === 'Escape' &&
        !expanded &&
        dialog.contains(document.activeElement)
      ) {
        e.preventDefault();
        close.current();
      }
    };
    document.addEventListener('keydown', escape);
    return () => {
      dialog.close();
      document.removeEventListener('keydown', escape);
    };
  }, [expanded]);
  return (
    <dialog
      ref={ref}
      className={`assistant-window ${expanded ? 'assistant-full' : 'assistant-compact'}`}
      aria-label="Health assistant"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header className="assistant-header">
        <span className="assistant-emblem">
          <Icon name="spark" />
        </span>
        <div>
          <h2>Health assistant</h2>
          <p>For {profile.displayName}</p>
        </div>
        <button
          className="icon-button"
          aria-label={expanded ? 'Exit full screen' : 'Full screen chat'}
          onClick={() => setExpanded(!expanded)}
        >
          <Icon name={expanded ? 'collapse' : 'expand'} size={19} />
        </button>
        <button
          autoFocus
          className="icon-button"
          aria-label="Close assistant"
          onClick={onClose}
        >
          <Icon name="close" size={19} />
        </button>
      </header>
      <HealthChat
        key={conversationId}
        profile={profile}
        guard={guard}
        conversationId={conversationId}
        onConversation={onConversation}
        expanded={expanded}
      />
    </dialog>
  );
}
