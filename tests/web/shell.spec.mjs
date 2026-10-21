import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { Buffer } from 'node:buffer';
import { AxeBuilder } from '@axe-core/playwright';

// Synthetic local-only acceptance test. Private links are never logged or traced.
async function mailFor(email, kind) {
  const folder = path.resolve(
    process.env.BIOVITAI_TEST_MAILBOX ?? '.local/auth-mailbox',
  );
  const messages = [];
  for (const name of await fs.readdir(folder)) {
    if (!name.endsWith('.json')) continue;
    const item = JSON.parse(await fs.readFile(path.join(folder, name), 'utf8'));
    if (item.recipient === email && item.kind === kind) messages.push(item);
  }
  if (!messages.length) throw new Error('Expected private local email capture');
  return messages.at(-1);
}
test('real local upload, source verification, comparison and unconfigured AI journey', async ({
  page,
  baseURL,
}) => {
  test.skip(
    process.env.BIOVITAI_REPORT_REHEARSAL !== '1',
    'Requires explicitly provisioned local scanner and OCR tools',
  );
  test.setTimeout(240000);
  const email = `reports-${randomUUID()}@example.test`,
    password = `Pilot-${randomUUID()}!`,
    headers = { origin: baseURL },
    request = page.context().request;
  expect(
    (
      await request.post('/api/auth/sign-up/email', {
        headers,
        data: {
          email,
          password,
          name: 'Synthetic report pilot',
          callbackURL: baseURL + '/auth',
        },
      })
    ).status(),
  ).toBe(200);
  const mail = await mailFor(email, 'verification');
  await request.get(mail.url, { maxRedirects: 0 });
  expect(
    (
      await request.post('/api/auth/sign-in/email', {
        headers,
        data: { email, password },
      })
    ).status(),
  ).toBe(200);
  const created = await (
    await request.post('/v1/profiles', {
      headers,
      data: { displayName: 'Synthetic Subject', kind: 'family' },
    })
  ).json();
  await request.post('/v1/profile-context', {
    headers,
    data: { profileId: created.profile.id, expectedRevision: 0 },
  });
  await page.goto('/health');
  for (const [index, amount] of ['15.50', '20.50'].entries()) {
    const date = `2026-10-${20 + index}`,
      lines = [
        'Patient: Synthetic Subject',
        'Specimen: serum',
        'Method: synthetic',
        'Concept system: synthetic',
        'Concept code: SYN-1',
        'Observed date: ' + date,
        'Synthetic Marker ' + amount + ' mg/L',
      ];
    const buffer = await sharp(
      Buffer.from(
        '<svg width="1400" height="650"><rect width="1400" height="650" fill="white"/>' +
          lines
            .map(
              (line, i) =>
                `<text x="40" y="${65 + i * 75}" font-family="Arial" font-size="34">${line}</text>`,
            )
            .join('') +
          '</svg>',
      ),
    )
      .png()
      .toBuffer();
    const name = `synthetic-${index}.png`;
    await page
      .getByLabel('Report file')
      .setInputFiles({ name, mimeType: 'image/png', buffer });
    await page
      .getByRole('button', { name: 'Upload report', exact: true })
      .click();
    const row = page.getByRole('button', {
      name: new RegExp(`${name}.*review needed`),
    });
    await expect(row).toBeVisible({ timeout: 90000 });
    await row.click();
    await expect(
      page.getByRole('img', { name: /Original report source page/ }),
    ).toBeVisible();
    await page
      .getByLabel(/I checked the source and confirm this report belongs/)
      .check();
    await page
      .getByLabel('Review reason', { exact: true })
      .fill('Confirmed synthetic source identity');
    await page
      .getByRole('button', { name: 'Confirm report identity', exact: true })
      .click();
    const form = page
      .locator('.candidate-review')
      .filter({ has: page.getByLabel('Test name') })
      .first();
    await expect(form.getByLabel('Value', { exact: true })).toHaveValue(amount);
    await form
      .getByLabel('Verification or correction reason')
      .fill('Verified all source fields in synthetic report');
    await form
      .getByText('Verified comparison context (optional)', { exact: true })
      .click();
    await form
      .getByLabel('I checked the entered context against this source region')
      .check();
    await form.getByLabel('Concept coding system').fill('synthetic');
    await form.getByLabel('Verified concept code').fill('SYN-1');
    await form.getByLabel('Specimen', { exact: true }).fill('serum');
    await form.getByLabel('Laboratory method').fill('synthetic');
    await form.getByLabel('Observation date').fill(date);
    await form
      .getByRole('button', { name: 'Verify result', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: new RegExp(`${name}.*verified`) }),
    ).toBeVisible();
  }
  const comparison = page
    .getByRole('heading', { name: 'Compare reports', exact: true })
    .locator('..');
  await comparison
    .getByLabel('First report')
    .selectOption({ label: 'synthetic-0.png' });
  await comparison
    .getByLabel('Second report')
    .selectOption({ label: 'synthetic-1.png' });
  await comparison
    .getByRole('button', { name: 'Compare verified results' })
    .click();
  await expect(comparison.getByText(/15.50 mg\/L/)).toBeVisible();
  await expect(comparison.getByText(/20.50 mg\/L/)).toBeVisible();
  await expect(
    page.getByRole('img', { name: /Synthetic Marker trend/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: /Health assistant/ }).click();
  await page
    .getByRole('button', { name: 'Allow AI processing for this profile' })
    .click();
  await page
    .getByLabel(/Ask about Synthetic Subject/)
    .fill('Explain these verified results');
  await page.getByRole('button', { name: 'Ask AI', exact: true }).click();
  await expect(
    page.getByText('AI unavailable: provider not configured'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Withdraw AI consent' }).click();
  await page.getByLabel(/Ask about Synthetic Subject/).fill('Explain again');
  await page.getByRole('button', { name: 'Ask AI', exact: true }).click();
  await expect(
    page.getByText('This action is unavailable or your access has changed.'),
  ).toBeVisible();
  await page
    .getByRole('region', { name: 'Health assistant', exact: true })
    .getByRole('button', { name: 'Close ×' })
    .click();
  const audit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(
    audit.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      targets: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    document.documentElement.dir = 'rtl';
    document.documentElement.style.fontSize = '150%';
  });
  await expect(
    page.getByRole('img', { name: /Synthetic Marker trend/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await page
    .getByRole('link', { name: 'Skip to main content', exact: true })
    .focus();
  await page.keyboard.press('Tab');
  expect(
    await page.evaluate(() => document.activeElement !== document.body),
  ).toBe(true);
});
test('account screens, family profiles, context switching, tabs and password recovery', async ({
  page,
}) => {
  const email = `web-${randomUUID()}@example.test`;
  const password = `Pilot-${randomUUID()}!`;
  const replacement = `Reset-${randomUUID()}!`;
  const consoleErrors = [];
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  await page.goto('/health');
  await expect(
    page.getByRole('heading', { name: 'Welcome back.' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Create an account', exact: true })
    .click();
  await page.getByLabel('Your name').fill('Synthetic Pilot');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account →' }).click();
  await expect(
    page.getByRole('heading', { name: 'Check your email.' }),
  ).toBeVisible();
  const verification = await mailFor(email, 'verification');
  // Navigate the trusted loopback link without attaching its URL to test output.
  await page.goto(verification.url).catch(() => {
    throw new Error('Private local verification navigation failed');
  });
  await page.goto('/auth');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in →' }).click();
  await expect(
    page.getByRole('heading', { name: 'Your health, in view.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Add a profile →' }).click();
  await page.getByLabel('Profile name', { exact: true }).fill('Pilot Member A');
  await page.getByLabel('Profile type').selectOption('family');
  await page.getByRole('button', { name: 'Add profile', exact: true }).click();
  const picker = page.getByRole('combobox', { name: 'Viewing profile' });
  await expect(
    picker.getByRole('option', { name: 'Pilot Member A · Family' }),
  ).toBeAttached();
  await page.getByLabel('Profile name', { exact: true }).fill('Pilot Member B');
  await page.getByLabel('Profile type').selectOption('family');
  await page.getByRole('button', { name: 'Add profile', exact: true }).click();
  await expect(
    picker.getByRole('option', { name: 'Pilot Member B · Family' }),
  ).toBeAttached();
  await picker.selectOption({ label: 'Pilot Member A · Family' });
  await expect(page.getByLabel('Current profile')).toContainText(
    'Pilot Member A',
  );
  await page
    .getByRole('button', { name: 'Health assistant', exact: false })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Here for Pilot Member A' }),
  ).toBeVisible();
  let releaseSelection;
  const selectionGate = new Promise((resolve) => {
    releaseSelection = resolve;
  });
  await page.route('**/v1/profile-context', async (route) => {
    if (route.request().method() === 'POST') await selectionGate;
    await route.continue();
  });
  await picker.selectOption({ label: 'Pilot Member B · Family' });
  await expect(
    page.getByRole('heading', { name: 'Here for Pilot Member A' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Opening your space…' }),
  ).toBeVisible();
  releaseSelection();
  await expect(page.getByLabel('Current profile')).toContainText(
    'Pilot Member B',
  );
  await page.unroute('**/v1/profile-context');
  await page
    .getByRole('button', { name: 'Manage profiles', exact: false })
    .click();
  await page
    .getByLabel('New contact email for Pilot Member B')
    .fill('synthetic-member@example.test');
  await page.getByRole('button', { name: 'Save contact email' }).click();
  await expect(page.getByRole('status')).toContainText('Contact email saved');
  await page.getByRole('link', { name: 'My Wellness' }).click();
  await expect(
    page.getByRole('heading', { name: 'Make room for feeling well.' }),
  ).toBeVisible();
  await expect(page.getByLabel('Current profile')).toContainText(
    'Pilot Member B',
  );
  await page.getByRole('link', { name: 'Community & Trends' }).click();
  await expect(
    page.getByRole('heading', { name: 'A wider perspective.' }),
  ).toBeVisible();
  await expect(
    page.getByText('Read-only pilot', { exact: true }),
  ).toBeVisible();
  if (process.env.COMMUNITY_ENABLED === 'false') {
    await expect(
      page.getByRole('heading', { name: 'Community is currently paused.' }),
    ).toBeVisible();
  } else {
    await expect(
      page.getByRole('heading', {
        name: 'Fresh perspectives are on their way.',
      }),
    ).toBeVisible();
  }
  await page.goto('/health');
  await expect(page.getByLabel('Current profile')).toContainText(
    'Pilot Member B',
  );
  await page.screenshot({
    path: path.join(
      process.env.BIOVITAI_TEST_SCREENSHOTS ?? '.local',
      'web-desktop.png',
    ),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole('link', { name: 'My Health', exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: path.join(
      process.env.BIOVITAI_TEST_SCREENSHOTS ?? '.local',
      'web-mobile.png',
    ),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Welcome back.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Forgot password?' }).click();
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByRole('status')).toContainText('If an account exists');
  const reset = await mailFor(email, 'password-reset');
  await page.goto(reset.url).catch(() => {
    throw new Error('Private local reset navigation failed');
  });
  await expect(
    page.getByRole('heading', { name: 'Choose a new password.' }),
  ).toBeVisible();
  await page.getByLabel('Password', { exact: true }).fill(replacement);
  await page.getByRole('button', { name: 'Save password' }).click();
  await expect(page.getByRole('status')).toContainText('Password updated');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(replacement);
  await page.getByRole('button', { name: 'Sign in →' }).click();
  await expect(page.getByLabel('Current profile')).toContainText('Choose who');
  await expect(
    picker.getByRole('option', { name: 'Pilot Member B · Family' }),
  ).toBeAttached();
  expect(consoleErrors).toEqual([]);
});

test('separate browser sessions cannot select, read or mutate another account’s profile', async ({
  browser,
  baseURL,
}) => {
  const contexts = [];
  const headers = { origin: baseURL };
  async function account() {
    const context = await browser.newContext({ baseURL });
    contexts.push(context);
    const email = `boundary-${randomUUID()}@example.test`;
    const password = `Synthetic-${randomUUID()}!`;
    expect(
      (
        await context.request.post('/api/auth/sign-up/email', {
          headers,
          data: {
            email,
            password,
            name: 'Synthetic account',
            callbackURL: `${baseURL}/auth`,
          },
        })
      ).status(),
    ).toBe(200);
    const message = await mailFor(email, 'verification');
    const verification = await context.request
      .get(message.url, { maxRedirects: 0 })
      .catch(() => {
        throw new Error('Private verification request failed');
      });
    expect(verification.status()).toBe(302);
    expect(
      (
        await context.request.post('/api/auth/sign-in/email', {
          headers,
          data: { email, password },
        })
      ).status(),
    ).toBe(200);
    return context;
  }
  try {
    const owner = await account();
    const outsider = await account();
    const created = await owner.request.post('/v1/profiles', {
      headers,
      data: {
        displayName: 'Private owner subject',
        kind: 'family',
        contactEmail: 'private@example.test',
      },
    });
    expect(created.status()).toBe(201);
    const subject = (await created.json()).profile;
    const own = await outsider.request.post('/v1/profiles', {
      headers,
      data: { displayName: 'Outsider subject', kind: 'family' },
    });
    const ownSubject = (await own.json()).profile;
    for (const id of [subject.id, randomUUID()]) {
      const read = await outsider.request.get(`/v1/profiles/${id}`);
      expect(read.status()).toBe(404);
      expect(await read.json()).toEqual({
        error: { code: 'PROFILE_NOT_FOUND' },
      });
      const selection = await outsider.request.post('/v1/profile-context', {
        headers,
        data: { profileId: id, expectedRevision: 0 },
      });
      expect(selection.status()).toBe(404);
    }
    const write = await outsider.request.post(
      `/v1/profiles/${subject.id}/contact`,
      { headers, data: { email: 'changed@example.test' } },
    );
    expect(write.status()).toBe(404);
    expect(
      await (
        await owner.request.get(`/v1/profiles/${subject.id}/contact`)
      ).json(),
    ).toEqual({ email: 'private@example.test' });
    expect(
      (
        await outsider.request.post('/v1/profile-context', {
          headers,
          data: { profileId: ownSubject.id, expectedRevision: 0 },
        })
      ).status(),
    ).toBe(200);
    const page = await outsider.newPage();
    await page.goto(`/health?profileId=${subject.id}`);
    await expect(page.getByLabel('Current profile')).toContainText(
      'Outsider subject',
    );
    await expect(
      page
        .getByRole('combobox', { name: 'Viewing profile' })
        .getByRole('option', { name: 'Private owner subject · Family' }),
    ).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText(
      'Private owner subject',
    );
    // A rejected switch must clear the private screen and never silently fall back.
    await page.route('**/v1/profile-context', async (route) => {
      if (route.request().method() === 'POST')
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ error: { code: 'PROFILE_CONTEXT_CHANGED' } }),
        });
      else await route.continue();
    });
    await page
      .getByRole('combobox', { name: 'Viewing profile' })
      .selectOption(ownSubject.id);
    await expect(
      page.getByRole('alert').filter({ hasText: 'selected profile changed' }),
    ).toContainText('selected profile changed');
    await expect(page.getByLabel('Current profile')).toContainText(
      'Choose who',
    );
    await expect(
      page.getByRole('heading', { name: 'Your reports will live here.' }),
    ).toHaveCount(0);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
