import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { profileAction, switchProfile } from './ui.mjs';

test('avatar actions and profile-bound chat resume, new chat, history and new sign-in', async ({
  page,
  baseURL,
}) => {
  test.setTimeout(180000);
  const request = page.context().request,
    headers = { origin: baseURL };
  const email = `assistant-${randomUUID()}@example.test`,
    password = `Synthetic-${randomUUID()}!`;
  expect(
    (
      await request.post('/api/auth/sign-up/email', {
        headers,
        data: { email, password, name: 'Synthetic account' },
      })
    ).status(),
  ).toBe(200);
  let verification;
  const folder = path.resolve(
    process.env.BIOVITAI_TEST_MAILBOX ?? '.local/auth-mailbox',
  );
  for (const file of await fs.readdir(folder)) {
    if (!file.endsWith('.json')) continue;
    const mail = JSON.parse(await fs.readFile(path.join(folder, file), 'utf8'));
    if (mail.recipient === email && mail.kind === 'verification')
      verification = mail.url;
  }
  expect(verification).toBeTruthy();
  await request.get(verification, { maxRedirects: 0 });
  async function signIn() {
    expect(
      (
        await request.post('/api/auth/sign-in/email', {
          headers,
          data: { email, password },
        })
      ).status(),
    ).toBe(200);
  }
  await signIn();
  const profiles = [];
  for (const [displayName, kind] of [
    ['Session Self', 'self'],
    ['Session Family', 'family'],
  ]) {
    const profile = (
      await (
        await request.post('/v1/profiles', {
          headers,
          data: { displayName, kind },
        })
      ).json()
    ).profile;
    profiles.push(profile);
    expect(
      (
        await request.post(`/v1/profiles/${profile.id}/consents`, {
          headers,
          data: {
            purpose: 'health_ai',
            noticeVersion: 'pilot-v1',
            granted: true,
          },
        })
      ).ok(),
    ).toBe(true);
  }
  async function selectInitial() {
    expect(
      (
        await request.post('/v1/profile-context', {
          headers,
          data: { profileId: profiles[0].id, expectedRevision: 0 },
        })
      ).status(),
    ).toBe(200);
  }
  await selectInitial();
  await page.goto('/dashboard');
  const avatar = page.getByRole('button', { name: /^Profile menu,/ });
  await expect(avatar).toContainText('Session Self');
  await expect(page.locator('main .context-strip')).toHaveCount(0);
  await expect(
    page
      .locator('aside.sidebar')
      .getByRole('button', { name: 'Health assistant', exact: true }),
  ).toHaveCount(0);
  await avatar.focus();
  await page.keyboard.press('ArrowDown');
  await expect(
    page.getByRole('menuitem', { name: 'My Profile', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(
    page.getByRole('menuitem', { name: 'Switch Profile', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(avatar).toBeFocused();
  await profileAction(page, 'My Profile');
  await expect(
    page.getByRole('dialog', { name: 'My Profile', exact: true }),
  ).toContainText(email);
  await page.getByRole('button', { name: 'Close panel', exact: true }).click();
  const fab = page.getByRole('button', {
    name: 'Health assistant',
    exact: true,
  });
  const dialog = page.getByRole('dialog', {
    name: 'Health assistant',
    exact: true,
  });
  const ids = [];
  page.on('request', (r) => {
    if (
      new URL(r.url()).pathname === '/v1/health/messages' &&
      r.method() === 'POST'
    )
      ids.push(r.postDataJSON().conversationId);
  });
  async function ask(question) {
    await dialog.getByRole('textbox', { name: /Ask about/ }).fill(question);
    await dialog.getByRole('button', { name: 'Ask AI', exact: true }).click();
    await expect(dialog.getByText(question, { exact: true })).toBeVisible();
    await expect(
      dialog
        .getByText('AI unavailable: no verified evidence', { exact: true })
        .last(),
    ).toBeVisible();
  }
  await fab.click();
  await ask('SYNTHETIC current session one');
  await page
    .getByRole('button', { name: 'Close assistant', exact: true })
    .click();
  await fab.click();
  await expect(
    dialog.getByText('SYNTHETIC current session one', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Close assistant', exact: true })
    .click();
  await page.getByRole('link', { name: 'Labs & Reports', exact: true }).click();
  await expect(page.getByLabel('Report file')).toBeVisible();
  await fab.click();
  await expect(
    dialog.getByText('SYNTHETIC current session one', { exact: true }),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'New chat', exact: true }).click();
  await expect(
    dialog.getByText('SYNTHETIC current session one', { exact: true }),
  ).toHaveCount(0);
  await ask('SYNTHETIC second chat');
  expect(ids).toHaveLength(2);
  expect(ids[1]).not.toBe(ids[0]);
  await dialog
    .getByRole('button', { name: 'Full screen chat', exact: true })
    .click();
  const history = page.getByRole('complementary', {
    name: 'Conversation history',
  });
  await expect(history).toBeVisible();
  await history
    .getByRole('button', { name: /^Conversation/ })
    .first()
    .click();
  await expect(
    dialog.getByText('SYNTHETIC current session one', { exact: true }),
  ).toBeVisible();
  await dialog
    .getByRole('button', { name: 'Exit full screen', exact: true })
    .click();
  await expect(history).toHaveCount(0);
  await dialog
    .getByRole('button', { name: 'Close assistant', exact: true })
    .click();
  await profileAction(page, 'My Profile');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Welcome back.' }),
  ).toBeVisible();
  await signIn();
  await selectInitial();
  await page.goto('/dashboard');
  await fab.click();
  await expect(
    dialog.getByRole('heading', { name: 'Make sense of your health story.' }),
  ).toBeVisible();
  await expect(
    dialog.getByText('SYNTHETIC current session one', { exact: true }),
  ).toHaveCount(0);
  await ask('SYNTHETIC new sign-in');
  expect(ids[2]).not.toBe(ids[0]);
  expect(ids[2]).not.toBe(ids[1]);
  // Delay retrieval while changing profiles: no private messages may survive the boundary.
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.route('**/v1/health/messages', async (route) => {
    await gate;
    await route
      .fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'PROVIDER_UNAVAILABLE' } }),
      })
      .catch(() => {});
  });
  await dialog
    .getByRole('textbox', { name: /Ask about/ })
    .fill('SYNTHETIC pending private question');
  await dialog.getByRole('button', { name: 'Ask AI', exact: true }).click();
  await switchProfile(page, profiles[1].id);
  await expect(page.getByLabel('Current profile')).toContainText(
    'Session Family',
  );
  await expect(dialog).toHaveCount(0);
  release();
  await fab.click();
  await expect(
    dialog.getByRole('textbox', { name: /Session Family/ }),
  ).toBeVisible();
  await expect(dialog).not.toContainText('SYNTHETIC new sign-in');
  await expect(dialog).not.toContainText('SYNTHETIC pending private question');
});
