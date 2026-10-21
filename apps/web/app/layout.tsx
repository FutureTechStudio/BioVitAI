import type { Metadata } from 'next';
import './style.css';
export const metadata: Metadata = {
  title: 'BiovitAI · Your health, connected',
  description: 'A private place for your family’s health and wellness.',
};
export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
