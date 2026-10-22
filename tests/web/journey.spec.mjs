import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { syntheticSignup, switchProfile } from './ui.mjs';

test('health story: reported context, conflict-safe corrections, history, digest and family reset', async ({
  page,
  baseURL,
}) => {
  test.setTimeout(180000);
  const request = page.context().request,
    headers = { origin: baseURL },
    email = `story-${randomUUID()}@example.test`,
    password = `Synthetic-${randomUUID()}!`;
  expect(
    (
      await syntheticSignup(request, {
        headers,
        data: { email, password, name: 'Synthetic story account' },
      })
    ).status(),
  ).toBe(200);
  const folder = path.resolve(
    process.env.BIOVITAI_TEST_MAILBOX ?? '.local/auth-mailbox',
  );
  let link;
  for (const name of await fs.readdir(folder)) {
    if (!name.endsWith('.json')) continue;
    const m = JSON.parse(await fs.readFile(path.join(folder, name), 'utf8'));
    if (m.recipient === email && m.kind === 'verification') link = m.url;
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
  const profiles = [];
  for (const [displayName, kind] of [
    ['Story Self', 'self'],
    ['Story Family', 'family'],
  ])
    profiles.push(
      (
        await (
          await request.post('/v1/profiles', {
            headers,
            data: { displayName, kind },
          })
        ).json()
      ).profile,
    );
  const selected = await (
      await request.post('/v1/profile-context', {
        headers,
        data: { profileId: profiles[0].id, expectedRevision: 0 },
      })
    ).json(),
    context = { profileId: profiles[0].id, revision: selected.revision };
  await page.goto('/health');
  const story = page.getByRole('region', {
      name: 'My health story',
      exact: true,
    }),
    cards = story.locator('.story-context-column');
  await expect(
    story.getByRole('button', { name: 'Add health context' }),
  ).toBeVisible();
  await story.getByRole('button', { name: 'Add health context' }).click();
  const dialog = page.getByRole('dialog');
  await dialog
    .getByRole('combobox', { name: 'Record type', exact: true })
    .selectOption('medication');
  await dialog
    .getByLabel('Record name', { exact: true })
    .fill('SYNTHETIC Medicine A');
  await dialog
    .getByRole('textbox', {
      name: 'Details as reported or recorded',
      exact: true,
    })
    .fill('Reported use only; no prescribed changes.');
  await dialog
    .getByLabel('Strength as reported (optional)', { exact: true })
    .fill('As reported');
  await dialog
    .getByLabel('Effective from (optional)', { exact: true })
    .fill('2024-03');
  await dialog.getByRole('checkbox', { name: /I confirm/ }).check();
  const audit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(audit.violations.map((v) => v.id)).toEqual([]);
  const saved = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === '/v1/health/journey/records' &&
      r.request().method() === 'POST',
  );
  await dialog
    .getByRole('button', { name: 'Save health context', exact: true })
    .click();
  const created = await (await saved).json();
  expect(created.revision).toBe(1);
  await expect(dialog).toHaveCount(0);
  const medicine = cards.locator('article').filter({
    has: page.getByRole('heading', {
      name: 'SYNTHETIC Medicine A',
      exact: true,
    }),
  });
  await expect(medicine).toContainText('2024-03 (approximate)');
  await expect(medicine).toContainText('Reported by the person');
  await expect(medicine).toContainText('Interaction checking is not available');
  await medicine
    .getByRole('button', { name: 'Correct record', exact: true })
    .click();
  await dialog
    .getByRole('textbox', {
      name: 'Details as reported or recorded',
      exact: true,
    })
    .fill('SYNTHETIC draft kept after concurrent correction');
  await dialog
    .getByLabel('Correction reason', { exact: true })
    .fill('Compared with updated reported context');
  await dialog.getByRole('checkbox', { name: /I confirm/ }).check();
  const current = await (
    await request.get('/v1/health/journey/records/' + created.recordId, {
      headers: {
        'x-profile-id': context.profileId,
        'x-context-revision': String(context.revision),
      },
    })
  ).json();
  const remote = await request.post('/v1/health/journey/records', {
    headers,
    data: {
      context,
      requestKey: randomUUID(),
      recordId: created.recordId,
      expectedRevision: 1,
      reason: 'Synthetic concurrent correction',
      confirmed: true,
      content: {
        ...current.versions[0].content,
        information: {
          ...current.versions[0].content.information,
          details: 'SYNTHETIC remotely saved revision',
        },
      },
    },
  });
  expect(remote.ok()).toBe(true);
  await dialog
    .getByRole('button', { name: 'Save corrected record', exact: true })
    .click();
  await expect(dialog.getByRole('alert')).toContainText(
    'record changed elsewhere',
  );
  await expect(
    dialog.getByRole('textbox', {
      name: 'Details as reported or recorded',
      exact: true,
    }),
  ).toHaveValue('SYNTHETIC draft kept after concurrent correction');
  await dialog
    .getByRole('button', { name: 'Inspect latest saved version', exact: true })
    .click();
  await expect(dialog).toContainText('SYNTHETIC remotely saved revision');
  await dialog
    .getByRole('button', {
      name: 'Use latest revision for this draft',
      exact: true,
    })
    .click();
  await dialog
    .getByRole('button', { name: 'Save corrected record', exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await medicine
    .getByRole('button', { name: 'View revision history', exact: true })
    .click();
  await expect(dialog).toContainText(
    'SYNTHETIC draft kept after concurrent correction',
  );
  await expect(dialog).toContainText('SYNTHETIC remotely saved revision');
  await expect(dialog).toContainText(
    'Reported use only; no prescribed changes.',
  );
  await page.getByRole('button', { name: 'Close panel', exact: true }).click();
  const careIds = [];
  for (const [label, details] of [
    ['SYNTHETIC Guidance A', 'Recorded guidance to clarify from source A'],
    ['SYNTHETIC Guidance B', 'Recorded guidance to clarify from source B'],
  ]) {
    await story.getByRole('button', { name: 'Add health context' }).click();
    await dialog
      .getByRole('combobox', { name: 'Record type', exact: true })
      .selectOption('care_guidance');
    await dialog.getByLabel('Record name', { exact: true }).fill(label);
    await dialog
      .getByRole('textbox', {
        name: 'Details as reported or recorded',
        exact: true,
      })
      .fill(details);
    if (careIds.length)
      await dialog
        .getByRole('checkbox', { name: 'SYNTHETIC Guidance A', exact: true })
        .check();
    await dialog.getByRole('checkbox', { name: /I confirm/ }).check();
    const result = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === '/v1/health/journey/records' &&
        r.request().method() === 'POST',
    );
    await dialog
      .getByRole('button', { name: 'Save health context', exact: true })
      .click();
    careIds.push((await (await result).json()).recordId);
    await expect(dialog).toHaveCount(0);
  }
  await expect(cards.getByText(/Possible conflict recorded/)).toBeVisible();
  await expect(
    story.getByRole('heading', { name: 'Date unknown', exact: true }),
  ).toBeVisible();
  for (const width of [1448, 1024, 390, 320]) {
    await page.setViewportSize({ width, height: 950 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
      'Story overflow ' + width,
    ).toBe(true);
  }
  await page.evaluate(() => {
    document.documentElement.dir = 'rtl';
    document.documentElement.style.fontSize = '200%';
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
    'RTL / large text story overflow',
  ).toBe(true);
  await page.evaluate(() => {
    document.documentElement.dir = 'ltr';
    document.documentElement.style.fontSize = '';
  });
  await page.setViewportSize({ width: 1448, height: 1000 });
  const pageAudit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(pageAudit.violations.map((v) => v.id)).toEqual([]);
  await page.goto('/dashboard');
  const digest = page.getByRole('region', {
    name: 'Health story digest',
    exact: true,
  });
  await digest
    .getByRole('button', { name: 'Set review point', exact: true })
    .click();
  await expect(digest).toContainText(
    'No record changes since your review point',
  );
  const backfill = await request.post('/v1/health/journey/records', {
    headers,
    data: {
      context,
      requestKey: randomUUID(),
      recordId: randomUUID(),
      expectedRevision: 0,
      reason: 'Synthetic historical context backfill',
      confirmed: true,
      content: {
        information: {
          kind: 'condition',
          assertion: 'concern',
          label: 'SYNTHETIC old concern',
          details: 'A historical concern entered today, not a new illness',
        },
        start: { precision: 'year', value: '2020' },
        end: { precision: 'unknown', value: null },
        state: 'historical',
        source: { kind: 'reported' },
        conflictsWith: [],
      },
    },
  });
  expect(backfill.ok()).toBe(true);
  await page.reload();
  await expect(digest).toContainText('SYNTHETIC old concern');
  await expect(digest).toContainText('historical evidence added or confirmed');
  await page.goto('/health');
  await story.getByRole('button', { name: 'Add health context' }).click();
  await dialog
    .getByLabel('Record name', { exact: true })
    .fill('SYNTHETIC private pending entry');
  await dialog
    .getByRole('textbox', {
      name: 'Details as reported or recorded',
      exact: true,
    })
    .fill('SYNTHETIC pending detail for self only');
  await dialog.getByRole('checkbox', { name: /I confirm/ }).check();
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.route('**/v1/health/journey/records', async (route) => {
    await gate;
    await route
      .fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ recordId: randomUUID(), revision: 1 }),
      })
      .catch(() => {});
  });
  await dialog
    .getByRole('button', { name: 'Save health context', exact: true })
    .click();
  await page.getByRole('button', { name: 'Close panel', exact: true }).click();
  await switchProfile(page, profiles[1].id);
  release();
  await expect(page.getByLabel('Current profile')).toContainText(
    'Story Family',
  );
  await expect(story).toContainText('0 context records');
  await expect(page.locator('main')).not.toContainText(
    'SYNTHETIC private pending entry',
  );
  await expect(page.locator('main')).not.toContainText('SYNTHETIC Medicine A');
  await expect(dialog).toHaveCount(0);
});
