import { expect } from 'e2e';
import { test } from '@e2e-dev/mobile';

test('signed-out launch shows the welcome screen', async ({ app, screen }) => {
  await app.clearState();
  await app.open();
  await expect(screen.getByText('Your Neighbourhood, Connected.')).toBeVisible();
});
