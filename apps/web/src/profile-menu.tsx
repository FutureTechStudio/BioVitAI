'use client';
import { useEffect, useRef, useState } from 'react';
import { Icon } from './design-system';
export function ProfileMenu({
  name,
  disabled,
  onChoose,
}: {
  name: string;
  disabled: boolean;
  onChoose: (
    action: 'My Profile' | 'Switch Profile' | 'Manage Profiles',
  ) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    root.current
      ?.querySelector<HTMLButtonElement>('[role="menuitem"]')
      ?.focus();
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  return (
    <div
      className="profile-menu"
      ref={root}
      onBlur={(e) => {
        const menu = e.currentTarget;
        // WebKit may blur a menu button before delivering its pointer click.
        // Let that activation finish before deciding whether focus left the menu.
        requestAnimationFrame(() => {
          if (menu.isConnected && !menu.contains(document.activeElement))
            setOpen(false);
        });
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          setOpen(false);
          trigger.current?.focus();
        }
        if (open && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
          e.preventDefault();
          const items = [
            ...root.current!.querySelectorAll<HTMLButtonElement>(
              '[role="menuitem"]',
            ),
          ];
          const i = items.indexOf(document.activeElement as HTMLButtonElement);
          items[
            e.key === 'Home'
              ? 0
              : e.key === 'End'
                ? items.length - 1
                : (i + (e.key === 'ArrowUp' ? -1 : 1) + items.length) %
                  items.length
          ]?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        className="profile-avatar-button"
        aria-label={`Profile menu, ${name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span className="profile-avatar" aria-hidden="true">
          <Icon name="user" size={22} />
        </span>
        <span className="profile-button-name" aria-label="Current profile">
          {name}
        </span>
        <Icon name="chevron" size={14} />
      </button>
      {open && (
        <div
          className="profile-popover"
          role="menu"
          aria-label="Profile options"
        >
          <p className="menu-caption">Your space</p>
          {(['My Profile', 'Switch Profile', 'Manage Profiles'] as const).map(
            (action, i) => (
              <button
                key={action}
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  trigger.current?.focus();
                  onChoose(action);
                }}
              >
                <Icon name={['user', 'switch', 'community'][i]!} size={19} />
                {action}
                <Icon name="chevron" size={14} />
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
