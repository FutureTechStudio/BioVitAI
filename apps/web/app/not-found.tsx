import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="auth-form">
      <section className="card empty">
        <h1>This page isn’t available.</h1>
        <p>Return to your dashboard to continue.</p>
        <Link className="primary" href="/dashboard">
          Open Dashboard
        </Link>
      </section>
    </main>
  );
}
