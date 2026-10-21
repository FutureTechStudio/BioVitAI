import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { profileAction } from './ui.mjs';

test('BioFlow routes, modal focus, responsive layouts and unavailable states', async ({
  page,
  baseURL,
}) => {
  test.setTimeout(180000);
  const request = page.context().request,
    headers = { origin: baseURL };
  const email = `bioflow-${randomUUID()}@example.test`,
    password = `Synthetic-${randomUUID()}!`;
  expect(
    (
      await request.post('/api/auth/sign-up/email', {
        headers,
        data: { email, password, name: 'BioFlow Synthetic' },
      })
    ).status(),
  ).toBe(200);
  const mailbox = path.resolve(
    process.env.BIOVITAI_TEST_MAILBOX ?? '.local/auth-mailbox',
  );
  let link;
  for (const file of await fs.readdir(mailbox)) {
    if (!file.endsWith('.json')) continue;
    const mail = JSON.parse(
      await fs.readFile(path.join(mailbox, file), 'utf8'),
    );
    if (mail.recipient === email && mail.kind === 'verification')
      link = mail.url;
  }
  expect(link).toBeTruthy();
  await request.get(link, { maxRedirects: 0 });
  expect(
    (
      await request.post('/api/auth/sign-in/email', {
        headers,
        data: { email, password },
      })
    ).status(),
  ).toBe(200);
  const profile = (
    await (
      await request.post('/v1/profiles', {
        headers,
        data: { displayName: 'BioFlow Synthetic Subject', kind: 'family' },
      })
    ).json()
  ).profile;
  expect(
    (
      await request.post('/v1/profile-context', {
        headers,
        data: { profileId: profile.id, expectedRevision: 0 },
      })
    ).status(),
  ).toBe(200);
  const folder = process.env.BIOVITAI_TEST_SCREENSHOTS ?? '.local';
  await fs.mkdir(folder, { recursive: true });
  for (const route of [
    '/',
    '/dashboard',
    '/health',
    '/insights',
    '/reports',
    '/wellness',
    '/community',
  ]) {
    await page.goto(route);
    await expect(page.getByLabel('Current profile')).toContainText(
      profile.displayName,
    );
    await expect(
      page.getByRole('status', { name: 'Loading health evidence' }),
    ).toHaveCount(0);
    if (['/', '/dashboard', '/health'].includes(route))
      await expect(
        page.getByRole('heading', { name: 'Your body insights' }),
      ).toBeVisible();
    const audit = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(
      audit.violations.map((v) => ({
        id: v.id,
        targets: v.nodes.map((n) => n.target),
      })),
      route,
    ).toEqual([]);
  }
  await page.goto('/dashboard');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.nav-item').first()).toHaveCSS(
    'transition-duration',
    '0s',
  );
  await expect(
    page.getByRole('heading', { name: 'Your body insights' }),
  ).toBeVisible();
  const trigger = page.getByRole('button', { name: /^Profile menu,/ });
  await expect(
    page.locator('main').getByRole('button', { name: /Manage profiles/i }),
  ).toHaveCount(0);
  await profileAction(page, 'Manage Profiles');
  await expect(page.getByRole('dialog')).toContainText('Your family profiles');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page
    .locator('.utility-nav')
    .getByRole('button', { name: 'Notifications', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toContainText(
    'Notifications are not available yet',
  );
  await page.keyboard.press('Escape');
  await page
    .locator('.utility-nav')
    .getByRole('button', { name: 'Help & Support', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toContainText('Start with a source');
  await page.keyboard.press('Escape');
  await page
    .getByRole('button', { name: 'Health assistant', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toContainText(
    'Make sense of your health story.',
  );
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('dialog', { name: 'Health assistant' }),
  ).toHaveCount(0);
  await page.getByLabel('From', { exact: true }).fill('2026-10-21');
  await page.getByLabel('To', { exact: true }).fill('2026-10-01');
  await expect(
    page.getByRole('alert').filter({ hasText: 'end date' }),
  ).toContainText('end date');
  await page.getByLabel('From', { exact: true }).fill('');
  await page.getByLabel('To', { exact: true }).fill('');
  for (const width of [1448, 1024, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
      `overflow at ${width}`,
    ).toBe(true);
    await page.screenshot({
      path: path.join(folder, `bioflow-empty-${width}.png`),
      fullPage: true,
    });
  }
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(
    page
      .getByRole('dialog')
      .getByRole('link', { name: 'My Wellness', exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 390, height: 900 });
  await page.evaluate(() => {
    document.documentElement.dir = 'rtl';
    document.documentElement.style.fontSize = '200%';
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
    'RTL and 200% text overflow',
  ).toBe(true);
  await page.screenshot({
    path: path.join(folder, 'bioflow-rtl-large-text.png'),
    fullPage: true,
  });
  await page.evaluate(() => {
    document.documentElement.dir = 'ltr';
    document.documentElement.style.fontSize = '';
  });
  await page.route('**/v1/health/intelligence', (r) =>
    r.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'EVIDENCE_UNAVAILABLE' } }),
    }),
  );
  await page.goto('/dashboard');
  await expect(
    page.getByRole('heading', { name: 'Health evidence unavailable' }),
  ).toBeVisible();
  await page.unroute('**/v1/health/intelligence');
  await page.getByRole('button', { name: 'Retry loading evidence' }).click();
  await expect(
    page.getByRole('heading', { name: 'Your body insights' }),
  ).toBeVisible();
  await page.route('**/v1/health/reports', (r) =>
    r.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'PROFILE_NOT_FOUND' } }),
    }),
  );
  await page.goto('/dashboard');
  await expect(page.getByLabel('Current profile')).toContainText('Choose who');
  await expect(
    page.getByRole('heading', { name: 'Your body insights' }),
  ).toHaveCount(0);
  await page.unroute('**/v1/health/reports');
  await page.goto('/auth');
  await expect(
    page.getByRole('heading', { name: 'Welcome back.' }),
  ).toBeVisible();
  // Check the public 404 independently of the departing private view's redirects.
  const publicPage = await page.context().newPage();
  await publicPage.goto('/not-a-biovitai-page');
  await expect(
    publicPage.getByRole('heading', { name: 'This page isn’t available.' }),
  ).toBeVisible();
  await publicPage.close();
});
