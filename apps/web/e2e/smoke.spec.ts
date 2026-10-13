import { expect, test } from '@playwright/test';

test.describe('Orbit Explorer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('map')).toHaveAttribute('data-ready', 'true', {
      timeout: 30_000,
    });
  });

  test('renders the satellite catalogue and the map canvas', async ({ page }) => {
    await expect(
      page.getByRole('region', { name: /Satellites/ }).getByRole('checkbox'),
    ).toHaveCount(10);
    await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible();
  });

  test('time presets and satellite filters are reflected in the shareable URL', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'D2', exact: true }).click();
    await expect(page).toHaveURL(/from=2027-03-02T00%3A00%3A00Z&to=2027-03-03T00%3A00%3A00Z/);

    await page.getByRole('checkbox', { name: /YAM21/ }).uncheck();
    await expect(page).toHaveURL(/hide=YAM21/);
    await expect(page.getByText('9/10')).toBeVisible();
  });

  test('picking a ground target lists accesses and selecting one is shared in the URL', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Dubai' }).click();

    const rows = page.getByTestId('access-row');
    await expect(rows.first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('access-summary')).toContainText('passes');
    expect(await rows.count()).toBeGreaterThan(10);

    // chronological: first pass of the week is YAM20 around 06:57–07:00 UTC on day 1
    await expect(rows.first()).toContainText('YAM20');

    await rows.nth(1).click();
    await expect(page).toHaveURL(/pass=YAM\d+-\d+/);
    await expect(rows.nth(1)).toHaveAttribute('data-selected', 'true');
  });

  test('a shared link restores target, radius and filters', async ({ page }) => {
    await page.goto('/?lat=48.8566&lon=2.3522&r=800&hide=YAM20,YAM21');
    await expect(page.getByTestId('access-row').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('8/10')).toBeVisible();
    await expect(page.getByText('800 km')).toBeVisible();
  });
});
