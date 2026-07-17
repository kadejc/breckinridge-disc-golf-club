// @ts-check
const { test, expect } = require('@playwright/test');

const NAV_ITEMS = [
  'About', 'Resources', 'Stats', 'Gallery', 'Contact',
  'Events', 'Rules & Etiquette', 'News',
];

test('home page loads with no console errors', async ({ page }) => {
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  const response = await page.goto('/');
  expect(response.status()).toBe(200);
  await expect(page).toHaveTitle(/Breckinridge DGC/);
  expect(errors).toEqual([]);
});

test('every nav dropdown opens and every internal link resolves', async ({ page, request }) => {
  await page.goto('/');
  const toggle = page.locator('#navToggle');
  if (await toggle.isVisible()) await toggle.click(); // mobile: nav is hidden behind the hamburger
  const checked = new Set();
  for (const label of NAV_ITEMS) {
    const button = page.locator('.nav-link', { hasText: label });
    await button.click();
    const dropdown = page.locator('.nav-item.open .nav-dropdown');
    await expect(dropdown).toBeVisible();
    const hrefs = await dropdown.locator('a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      if (!href || href.startsWith('http') || checked.has(href)) continue;
      checked.add(href);
      const url = new URL(href, page.url());
      const res = await request.get(url.toString());
      expect(res.status(), `${label} -> ${href}`).toBe(200);
    }
    await button.click(); // close it again before opening the next one
  }
  expect(checked.size).toBeGreaterThanOrEqual(15); // one page per non-external dropdown item
});

test('stats dashboard tabs render and deep-link via hash', async ({ page }) => {
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

  await page.goto('/stats.html');
  await expect(page.locator('.tab.active')).toHaveText('Top Winners');

  await page.goto('/stats.html#playertable');
  await expect(page.locator('#panel-playertable')).toHaveClass(/active/);
  await expect(page.locator('.tab.active')).toHaveText('Player Table');

  // Past Results tab kept its data-tab="events" id even though the label changed.
  await page.goto('/stats.html#events');
  await expect(page.locator('#panel-events')).toHaveClass(/active/);
  await expect(page.locator('.tab.active')).toHaveText('Past Results');

  // Expanding an event groups its results by division (not by physical card/tee-time group).
  await page.locator('.event-block').first().click();
  const headings = page.locator('.event-block').first().locator('.event-detail h4');
  await expect(headings.first()).toBeVisible();
  const headingTexts = await headings.allTextContents();
  const known = ['MPO', 'MA1', 'MA3', 'MP40', 'FA3', 'Free'];
  for (const h of headingTexts) expect(known).toContain(h);

  await page.goto('/stats.html#courserecords');
  await expect(page.locator('#panel-courserecords')).toHaveClass(/active/);
  await expect(page.locator('#courseRecordsOut .card').first()).toBeVisible();

  expect(errors).toEqual([]);
});

test('course info page has 18 hole video buttons that open a modal player', async ({ page }) => {
  await page.goto('/about/course-info.html');
  const buttons = page.locator('.hole-video-btn');
  await expect(buttons).toHaveCount(18);

  const overlay = page.locator('#holeVideoOverlay');
  await expect(overlay).not.toHaveClass(/open/);
  await buttons.first().click();
  await expect(overlay).toHaveClass(/open/);
  await expect(overlay.locator('iframe')).toHaveAttribute('src', /youtube\.com\/embed\//);

  await page.locator('#holeVideoClose').click();
  await expect(overlay).not.toHaveClass(/open/);
  await expect(overlay.locator('iframe')).toHaveCount(0); // playback stopped, not just hidden
});

test('resources course map image loads', async ({ page, request }) => {
  await page.goto('/resources/course-map.html');
  const img = page.locator('img[alt*="course map" i]');
  const src = await img.getAttribute('src');
  const url = new URL(src, page.url());
  const res = await request.get(url.toString());
  expect(res.status()).toBe(200);
});

test.describe('mobile nav', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('hamburger toggles the nav menu', async ({ page }) => {
    await page.goto('/');
    const nav = page.locator('#mainNav');
    await expect(nav).not.toHaveClass(/open/);
    await page.locator('#navToggle').click();
    await expect(nav).toHaveClass(/open/);
  });
});
