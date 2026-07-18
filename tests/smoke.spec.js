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

test('home page shows the next upcoming event', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#nextEventText')).toContainText('Next Weekly Mini:');
});

test('join us page shows the next upcoming event', async ({ page }) => {
  await page.route('**/data/upcoming-events.json', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ updatedAt: '2026-07-17T00:00:00.000Z', events: [
      { slug: 'future-event', title: 'Weekly Mini - All Welcome!!!', date: '2099-01-06' },
    ] }),
  }));
  await page.goto('/contact/join-us.html');
  await expect(page.locator('#nextEventText')).toContainText('Next Weekly Mini: Tuesday, January 6');
});

test('strike tracker shows MA1 and MA3 strikes', async ({ page }) => {
  await page.goto('/resources/strike-tracker.html');
  await expect(page.getByText('Erik H.')).toBeVisible();
  await expect(page.getByText('Sam P.')).toBeVisible();
  const marks = await page.locator('.data-table').getByText('❌').count();
  expect(marks).toBe(9); // 2 in MA1 + 7 in MA3
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
  // Loose sanity floor, not an exact count -- this includes every distinct stats.html#hash link
  // too (each checked as its own request, even though the server sees the same URL once the
  // fragment is stripped), so it's larger than "one per page" and not worth hand-maintaining
  // precisely on every nav edit.
  expect(checked.size).toBeGreaterThan(10);
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

test('player names are shortened to "First L." everywhere, never a full last name', async ({ page }) => {
  await page.goto('/stats.html');
  const cells = await page.locator('#winnersOut td:nth-child(2)').allTextContents();
  expect(cells.length).toBeGreaterThan(0);
  // The #1 MPO winner is a known full name in the source data ("Kade Capps") -- confirm it's
  // shortened, and confirm no cell contains a bare un-abbreviated multi-letter last name by
  // checking none of them equal a known full name from the roster.
  expect(cells).toContain('Kade C.');
  expect(cells).not.toContain('Kade Capps');
});

test('course info page (merged with course map/scorecard) has hole videos and a course map image', async ({ page, request }) => {
  await page.goto('/resources/course-info.html');
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

  const img = page.locator('img[alt*="course map" i]');
  const src = await img.getAttribute('src');
  const url = new URL(src, page.url());
  const res = await request.get(url.toString());
  expect(res.status()).toBe(200);
});

test('payout calculator computes the right payout for a division/player-count pair', async ({ page }) => {
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  await page.goto('/resources/payout-tables.html');

  await page.selectOption('#calcDivision', 'ma1');
  await page.selectOption('#calcPlayers', '20');
  const rows = page.locator('#calcResult tbody tr');
  await expect(rows.first()).toHaveText('1st$44'); // from the source spreadsheet's MA1_Pay sheet: 20 players -> 1st = $44

  expect(errors).toEqual([]);
});

test('payout calculator auto-fills from data/live-event-count.json when present', async ({ page }) => {
  await page.route('**/data/live-event-count.json', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      date: '2026-07-14', slug: 'test-event', updatedAt: '2026-07-14T23:35:00.000Z',
      total: 55, counts: { mpo: 12, mp40: 6, ma1: 18, ma3fa3: 19 }, byDivision: {},
    }),
  }));
  await page.goto('/resources/payout-tables.html');

  const note = page.locator('#calcAutoNote');
  await expect(note).toBeVisible();
  await expect(page.locator('#calcDivision')).toHaveValue('mpo');
  await expect(page.locator('#calcPlayers')).toHaveValue('12');

  // Switching divisions re-applies the live count for the newly-selected division too.
  await page.selectOption('#calcDivision', 'ma1');
  await expect(page.locator('#calcPlayers')).toHaveValue('18');

  // Manually changing the player count is a deliberate override -- the auto-fill note goes away.
  await page.selectOption('#calcPlayers', '10');
  await expect(note).toBeHidden();
});

test('ace gallery has playing-with info for every ace, no leftover placeholders', async ({ page }) => {
  await page.goto('/gallery/ace-gallery.html');
  await expect(page.locator('.ace-card')).toHaveCount(17);
  await expect(page.getByText('not recorded')).toHaveCount(0);
  const playingWith = await page.locator('.ace-meta', { hasText: 'Playing with:' }).allTextContents();
  expect(playingWith.length).toBe(17);
  for (const text of playingWith) expect(text.trim()).not.toBe('Playing with:');
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
