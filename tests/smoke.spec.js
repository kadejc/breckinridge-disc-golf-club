// @ts-check
const { test, expect } = require('@playwright/test');

const NAV_ITEMS = [
  'About', 'Resources', 'Stats', 'Gallery', 'Contact',
  'Events', 'Membership', 'Rules & Etiquette', 'News',
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
  expect(checked.size).toBeGreaterThanOrEqual(19); // one page per non-external dropdown item
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

  expect(errors).toEqual([]);
});

test('course info page embeds all 18 hole flyover videos', async ({ page }) => {
  await page.goto('/about/course-info.html');
  const iframes = page.locator('.video-embed iframe');
  await expect(iframes).toHaveCount(18);
  await expect(iframes.first()).toHaveAttribute('src', /youtube\.com\/embed\//);
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
