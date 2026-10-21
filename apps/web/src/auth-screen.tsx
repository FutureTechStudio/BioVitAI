'use client';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { api, friendlyError } from './api';
import { BioFlowBackground, Brand } from './design-system';

type Mode = 'signin' | 'signup' | 'forgot' | 'reset' | 'verify';
const titles: Record<Mode, string> = {
  signin: 'Welcome back.',
  signup: 'A healthier start.',
  forgot: 'Reset your password.',
  reset: 'Choose a new password.',
  verify: 'Check your email.',
};
export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [token, setToken] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
    const params = new URLSearchParams(window.location.search);
    const resetToken = params.get('token');
    if (resetToken) {
      setMode('reset');
      setToken(resetToken);
      window.history.replaceState(null, '', '/auth');
    } else if (params.has('error'))
      setError('This link is invalid or has expired. Request a new email.');
  }, []);
  function change(next: Mode) {
    setMode(next);
    setMessage('');
    setError('');
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    const fields = new FormData(event.currentTarget);
    const email = String(fields.get('email') ?? '').trim();
    const password = String(fields.get('password') ?? '');
    const callbackURL = `${window.location.origin}/auth`;
    try {
      if (mode === 'signin') {
        await api('/api/auth/sign-in/email', { email, password });
        window.location.assign('/dashboard');
      } else if (mode === 'signup') {
        await api('/api/auth/sign-up/email', {
          email,
          password,
          name: String(fields.get('name')),
          callbackURL,
        });
        setMode('verify');
        setMessage(
          'If your account can be created, a verification link will be sent. Verify it, then sign in.',
        );
      } else if (mode === 'forgot') {
        await api('/api/auth/request-password-reset', {
          email,
          redirectTo: callbackURL,
        });
        setMessage(
          'If an account exists for this email, a password reset link will be sent.',
        );
      } else if (mode === 'verify') {
        await api('/api/auth/send-verification-email', { email, callbackURL });
        setMessage(
          'If verification is available for this email, a new link will be sent.',
        );
      } else {
        if (!token) throw new Error('MISSING_TOKEN');
        await api('/api/auth/reset-password', { token, newPassword: password });
        setToken('');
        setMode('signin');
        setMessage('Password updated. Sign in with your new password.');
      }
    } catch (cause) {
      setError(friendlyError(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-layout">
      <BioFlowBackground />
      <section className="auth-story">
        <Link href="/" aria-label="BiovitAI home">
          <Brand />
        </Link>
        <div>
          <p className="eyebrow">YOUR HEALTH, CONNECTED</p>
          <h1>
            A little clarity.
            <br />A healthier everyday.
          </h1>
          <p>
            One thoughtful space to understand your health and look after the
            people you care about.
          </p>
        </div>
        <p className="pilot-label">LOCAL PILOT · SYNTHETIC DATA ONLY</p>
      </section>
      <section className="auth-form">
        <div className="form-card">
          <p className="eyebrow">WELCOME TO BIOVITAI</p>
          <h2>{titles[mode]}</h2>
          <p className="muted">
            {mode === 'signin'
              ? 'Your family’s health, all in one place.'
              : 'Use your own account to manage family profiles.'}
          </p>
          <form onSubmit={submit} key={mode}>
            {mode === 'signup' && (
              <label>
                Your name
                <input
                  name="name"
                  autoComplete="name"
                  required
                  maxLength={100}
                />
              </label>
            )}
            {mode !== 'reset' && (
              <label>
                Email address
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                />
              </label>
            )}
            {['signin', 'signup', 'reset'].includes(mode) && (
              <label>
                Password
                <input
                  name="password"
                  aria-label="Password"
                  aria-describedby="password-hint"
                  type="password"
                  autoComplete={
                    mode === 'signin' ? 'current-password' : 'new-password'
                  }
                  minLength={12}
                  maxLength={128}
                  required
                />
                <small id="password-hint">Use 12 or more characters.</small>
              </label>
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
            <button className="primary full" disabled={!ready || busy}>
              {busy
                ? 'Please wait…'
                : {
                    signin: 'Sign in →',
                    signup: 'Create account →',
                    forgot: 'Send reset link',
                    reset: 'Save password',
                    verify: 'Resend verification link',
                  }[mode]}
            </button>
          </form>
          <div className="auth-actions">
            {mode === 'signin' ? (
              <>
                <button disabled={!ready} onClick={() => change('forgot')}>
                  Forgot password?
                </button>
                <button disabled={!ready} onClick={() => change('signup')}>
                  Create an account
                </button>
                <button disabled={!ready} onClick={() => change('verify')}>
                  Resend verification
                </button>
              </>
            ) : (
              <button disabled={!ready} onClick={() => change('signin')}>
                Back to sign in
              </button>
            )}
          </div>
          <p className="local-note">
            Pilot email delivery is captured privately on this computer. No
            email is sent externally.
          </p>
        </div>
      </section>
    </main>
  );
}
