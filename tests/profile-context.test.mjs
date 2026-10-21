import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { createProfileView } from '../dist/shared/profile-context/src/index.js';

test('switch clears every registered profile view and aborts previous requests immediately', () => {
  const screen = {
    reports: ['synthetic'],
    chat: ['synthetic'],
    trend: 'synthetic',
    wellness: 'synthetic',
  };
  const view = createProfileView(() => {
    screen.reports = [];
    screen.chat = [];
    screen.trend = null;
    screen.wellness = null;
  });
  view.applySelection(view.beginSelection(), {
    profileId: randomUUID(),
    revision: 1,
  });
  const old = view.request();
  screen.reports = ['synthetic previous report'];
  screen.chat = ['synthetic previous conversation'];
  screen.trend = 'synthetic previous trend';
  screen.wellness = 'synthetic previous plan';
  view.beginSelection();
  assert.deepEqual(screen, {
    reports: [],
    chat: [],
    trend: null,
    wellness: null,
  });
  assert.equal(old.signal.aborted, true);
  assert.throws(() => view.request(), /PROFILE_SELECTION_REQUIRED/);
  let commits = 0;
  assert.equal(
    view.publish(old, () => {
      commits++;
    }),
    false,
  );
  assert.equal(commits, 0);
});

test('late selection responses and data cannot restore an earlier profile', () => {
  const view = createProfileView(() => {});
  const first = view.beginSelection();
  const second = view.beginSelection();
  const current = { profileId: randomUUID(), revision: 2 };
  assert.equal(view.applySelection(second, current), true);
  assert.equal(
    view.applySelection(first, { profileId: randomUUID(), revision: 1 }),
    false,
  );
  const request = view.request();
  assert.deepEqual(request.context, current);
  let value;
  assert.equal(
    view.publish(request, () => {
      value = 'current';
    }),
    true,
  );
  assert.equal(value, 'current');
});

test('switching away and back cannot reuse an older request even for the same profile', () => {
  const view = createProfileView(() => {});
  const id = randomUUID();
  view.applySelection(view.beginSelection(), { profileId: id, revision: 1 });
  const old = view.request();
  view.applySelection(view.beginSelection(), {
    profileId: randomUUID(),
    revision: 2,
  });
  view.applySelection(view.beginSelection(), { profileId: id, revision: 3 });
  assert.equal(
    view.publish(old, () => assert.fail('stale data')),
    false,
  );
  assert.equal(
    view.publish(view.request(), () => {}),
    true,
  );
});

test('permission loss and failed selection keep the view empty; request references are immutable', () => {
  const view = createProfileView(() => {});
  view.applySelection(view.beginSelection(), {
    profileId: randomUUID(),
    revision: 1,
  });
  const old = view.request();
  assert.throws(() => {
    old.context.profileId = randomUUID();
  }, TypeError);
  const selection = view.beginSelection();
  assert.equal(view.applySelection(selection, null), true);
  assert.throws(() => view.request(), /PROFILE_SELECTION_REQUIRED/);
  assert.equal(
    view.publish(old, () => assert.fail('revoked data')),
    false,
  );
});
