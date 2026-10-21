export async function profileAction(page, action) {
  await page.getByRole('button', { name: /^Profile menu,/ }).click();
  await page.getByRole('menuitem', { name: action, exact: true }).click();
}
export async function switchProfile(page, choice) {
  await profileAction(page, 'Switch Profile');
  await page
    .getByRole('combobox', { name: 'Viewing profile', exact: true })
    .selectOption(choice);
}
export async function syntheticSignup(request, options) {
  let response = await request.post('/api/auth/sign-up/email', options);
  if (response.status() === 429) {
    // Keep the real pilot protection enabled. This serial gate creates six accounts.
    const seconds = Number(response.headers()['retry-after']);
    const wait =
      Number.isFinite(seconds) && seconds > 0 ? Math.min(60, seconds) : 60;
    await new Promise((resolve) => setTimeout(resolve, wait * 1000 + 250));
    response = await request.post('/api/auth/sign-up/email', options);
  }
  return response;
}
