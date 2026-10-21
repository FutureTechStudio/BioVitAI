'use client';
export default function ErrorScreen({ reset }: { reset: () => void }) {
  return (
    <main className="auth-form">
      <section className="card empty" role="alert">
        <h1>Your space couldn’t open.</h1>
        <p>Try again. No private evidence is displayed in this error.</p>
        <button className="primary" onClick={reset}>
          Try again
        </button>
      </section>
    </main>
  );
}
