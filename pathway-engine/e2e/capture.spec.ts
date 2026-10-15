/**
 * Captures every screen as a PNG for design review (for example to drop into Figma), sorted into category folders.
 * Runs only when CAPTURE_DIR is set:   CAPTURE_DIR=/path/to/out npx playwright test e2e/capture.spec.ts --project=mobile
 * Learner screens: phone (412 x 839 CSS px at 3x) in English and Hindi. Staff consoles: desktop (1440 wide) in English.
 * The app is driven through its real API to reach each state, then the screen is opened and photographed.
 */
import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { B_VALUES } from './fixtures';

const OUT = process.env.CAPTURE_DIR ?? '';
const items = JSON.parse(readFileSync(join(process.cwd(), 'seed/v1/assessment_items.json'), 'utf8'));
const key = (id: string) => items.part_c.find((i: { item_id: string }) => i.item_id === id).answer as string;
const wrong = (id: string) => items.part_c.find((i: { item_id: string }) => i.item_id === id).options.find((o: { value: string }) => o.value !== key(id)).value as string;

const PART_A: [string, Record<string, unknown>][] = [
  ['A3', { gender: 'woman' }], ['A4', { location: { state: 'Bihar', district: 'Patna' } }], ['A5', { learning_language: 'en' }],
  ['A6', { current_status: 'college' }], ['A7', { education_stage: 'ug_2' }], ['A8', { time_left: 'about_1' }], ['A9', { field_of_study: 'bcom' }],
  ['A10', { certificates: ['none'] }], ['A11', { work_experience: 'none' }], ['A12', { device: 'phone_and_laptop' }],
  ['A13', { internet: 'reliable' }], ['A14', { weekly_hours: '3_to_5' }],
];
const A_NAMES: Record<string, string> = { A3: 'gender', A4: 'location', A5: 'learning-language', A6: 'where-are-you-now', A7: 'education', A8: 'time-left', A9: 'field-of-study', A10: 'courses-already-done', A11: 'work-experience', A12: 'devices', A13: 'internet', A14: 'weekly-hours' };

test.skip(!OUT, 'Set CAPTURE_DIR to capture screens');
test.describe.configure({ mode: 'serial' });
test.setTimeout(600_000);

function client(request: APIRequestContext) {
  return async (method: string, path: string, data?: unknown, headers: Record<string, string> = {}) => {
    const r = await request.fetch(`/v1${path}`, { method, data, headers });
    if (!r.ok()) throw new Error(`${method} ${path}: ${r.status()} ${await r.text()}`);
    return r.json();
  };
}

async function phone(browser: Browser, lang: 'en' | 'hi') {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 839 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await ctx.addInitScript((l) => { try { localStorage.setItem('swift.lang', l); } catch { /* ignore */ } }, lang);
  return ctx.newPage();
}

function shooter(page: Page, root: string) {
  return async (category: string, name: string, opts: { fullPage?: boolean } = {}) => {
    const dir = join(root, category);
    mkdirSync(dir, { recursive: true });
    await page.waitForTimeout(500); // let enter and sheet animations finish
    await page.screenshot({ path: join(dir, `${name}.png`), fullPage: opts.fullPage ?? false });
  };
}

const primary = (page: Page) => page.locator('.actionbar .btn-primary');
const options = (page: Page) => page.locator('main [role=radio], main [role=checkbox]');

for (const lang of ['en', 'hi'] as const) {
  test(`learner screens (${lang})`, async ({ browser, request }, info) => {
    test.skip(info.project.name !== 'mobile', 'Learner screens are captured once, at phone size');
    const api = client(request);
    const page = await phone(browser, lang);
    const snap = shooter(page, join(OUT, lang === 'en' ? 'English' : 'Hindi'));

    // ---------- 01 Onboarding ----------
    await page.goto('/');
    await expect(primary(page)).toBeVisible();
    await snap('01 Onboarding', 'L01 Welcome');
    await primary(page).click();
    await snap('01 Onboarding', 'L02a Name');
    await page.locator('#name').fill('Asha Kumari');
    await primary(page).click();
    await page.locator('#dob-d').selectOption('1');
    await page.locator('#dob-m').selectOption('5');
    await page.locator('#dob-y').selectOption(String(new Date().getFullYear() - 12));
    await snap('01 Onboarding', 'L02b Date of birth');
    await primary(page).click();
    await snap('01 Onboarding', 'L02c Under-age stop');
    await page.locator('.appbar .icon-btn').first().click();
    await page.locator('#dob-y').selectOption(String(new Date().getFullYear() - 16));
    await primary(page).click();
    await snap('01 Onboarding', 'L02d Guardian question');
    await options(page).nth(0).click();
    await page.locator('#g-name').fill('Sunita Devi');
    await page.locator('#g-rel').selectOption('mother');
    await page.locator('main input[type=checkbox]').check();
    await snap('01 Onboarding', 'L02e Guardian consent form');
    await primary(page).click();
    await page.locator('main input[type=checkbox]').nth(0).check();
    await page.locator('main input[type=checkbox]').nth(1).check();
    await snap('01 Onboarding', 'L02f Consent');

    // Guardian consent given later (learner under 17 whose guardian was not present)
    const minor = await api('POST', '/learners', { name: 'Meena Kumari', dob: '2010-06-01', consents: { store_answers: true, take_assessment: true }, guardian: { present: false } });
    await page.evaluate((s) => localStorage.setItem('swift.pathway.session', JSON.stringify(s)), { learnerId: minor.learner_id, token: minor.token });
    await page.goto('/guardian');
    await expect(page.locator('#gn')).toBeVisible();
    await snap('06 Processing and consent', 'L10c Guardian consent later');

    // ---------- 02 About you ----------
    const me = await api('POST', '/learners', { name: 'Asha Kumari', dob: '2007-05-01', consents: { store_answers: true, take_assessment: true, share_with_mentor: true } });
    const H = { authorization: `Bearer ${me.token}` };
    const id = me.learner_id;
    await page.evaluate((s) => localStorage.setItem('swift.pathway.session', JSON.stringify(s)), { learnerId: id, token: me.token });
    for (const [n, [itemId, answers]] of PART_A.entries()) {
      await page.goto('/journey/about');
      await expect(page.locator(`#q-${itemId}`)).toBeVisible();
      await snap('02 About you', `L03-${String(n + 1).padStart(2, '0')} ${A_NAMES[itemId]}`);
      if (itemId === 'A11') {
        await options(page).nth(2).click(); // "1 to 2 years" shows the role question
        await snap('02 About you', `L03-${String(n + 1).padStart(2, '0')}b work-experience role`);
      }
      await api('PATCH', `/learners/${id}`, { item_id: itemId, answers, ms_taken: 20_000 }, H);
    }

    // ---------- 03 Learning profile ----------
    await page.goto('/journey/profile');
    await snap('03 Learning profile', 'L04 Intro');
    await primary(page).click();
    await snap('03 Learning profile', 'L05a Interest statement');
    const bIds = Object.keys(B_VALUES);
    const order = (await api('GET', '/assessment/items?part=B')).items.map((i: { item_id: string }) => i.item_id) as string[];
    await api('POST', `/learners/${id}/assessment/B/responses`, { item_id: order[0], value: B_VALUES[order[0]], ms_taken: 15_000 }, H);
    await page.goto('/journey/profile');
    await expect(page.locator('#statement')).toBeVisible();
    await snap('03 Learning profile', 'L05b Agreement statement');
    for (const itemId of bIds) await api('POST', `/learners/${id}/assessment/B/responses`, { item_id: itemId, value: B_VALUES[itemId], ms_taken: 15_000 }, H);
    await api('POST', `/learners/${id}/assessment/B`, {}, H);

    // ---------- 04 Skill check ----------
    await page.goto('/journey/skills');
    await snap('04 Skill check', 'L06 AI intro');
    await primary(page).click();
    await snap('04 Skill check', 'L07 AI task');
    const answer = (series: string, item_id: string, a: string) => api('POST', `/learners/${id}/skill-check/answers`, { series, item_id, answer: a, ms_taken: 40_000 }, H);
    await answer('ai', 'SC-AI-1a', wrong('SC-AI-1a'));
    await answer('ai', 'SC-AI-1b', key('SC-AI-1b'));
    await page.goto('/journey/skills/communication');
    await snap('04 Skill check', 'L08a Communication intro');
    await primary(page).click();
    await expect(page.locator('main .link-btn')).toBeVisible();
    await snap('04 Skill check', 'L08b Listening task');
    await page.locator('main .link-btn').click();
    await snap('04 Skill check', 'L08c Listening task, read instead');
    await answer('comm', 'SC-COM-3L', wrong('SC-COM-3L'));
    await page.goto('/journey/skills/communication');
    await snap('04 Skill check', 'L08d Reading task');
    await answer('comm', 'SC-COM-3R', wrong('SC-COM-3R'));
    await page.goto('/journey/skills/communication');
    await snap('04 Skill check', 'L08e Vocabulary task');
    await answer('comm', 'SC-COM-3V', wrong('SC-COM-3V'));
    for (const x of ['SC-COM-2L', 'SC-COM-2R', 'SC-COM-2V']) await answer('comm', x, key(x));

    // ---------- 05 Goals ----------
    await page.goto('/journey/goals');
    await expect(page.locator('.goal-card').first()).toBeVisible();
    await snap('05 Goals', 'L09a Kinds of work');
    await page.locator('.goal-card').nth(1).click();
    await page.locator('.goal-card').nth(10).click();
    await snap('05 Goals', 'L09b Two picked');
    await page.locator('.goal-card').nth(10).click();
    await primary(page).click();
    await snap('05 Goals', 'L09c Main goal');
    await options(page).nth(1).click();
    await snap('05 Goals', 'L09d Earning need');
    await options(page).nth(2).click();
    await snap('05 Goals', 'L09e Where to work');
    await options(page).nth(1).click();
    await page.locator('#note').fill(lang === 'hi' ? 'मैं शाम को पढ़ सकती हूँ।' : 'I can study in the evenings.');
    await snap('05 Goals', 'L09f Note for mentor');
    // Hold the plan request so the "building" screen can be photographed
    await page.route('**/v1/learners/*/pathway', async (route) => { await new Promise((r) => setTimeout(r, 2500)); await route.continue(); });
    await primary(page).click();

    // ---------- 06 Processing ----------
    await expect(page.locator('main [role=radio]').first()).toBeVisible();
    await snap('06 Processing and consent', 'L10a Quick question');
    await options(page).nth(1).click();
    await expect(page.locator('.spinner')).toBeVisible();
    await snap('06 Processing and consent', 'L10b Building the plan');
    await page.waitForURL(/\/results\/type/);
    await page.unroute('**/v1/learners/*/pathway');

    // ---------- 07 Results ----------
    await expect(page.locator('main h1').first()).toBeVisible();
    await snap('07 Results', 'L11 Learner type');
    await primary(page).click();
    await snap('07 Results', 'L12a Interests and directions');
    await page.locator('main .row-btn').first().click();
    await snap('07 Results', 'L12b Direction details sheet');
    await page.keyboard.press('Escape');
    await primary(page).click();
    await snap('07 Results', 'L13a Skills to build');
    await page.locator('main .row-btn').first().click();
    await snap('07 Results', 'L13b Skill details sheet');
    await page.keyboard.press('Escape');
    await primary(page).click();
    await expect(page.locator('.term-mini')).toHaveCount(2);
    await snap('07 Results', 'L14a Plan, 12 months');
    await page.locator('main .segmented [role=radio]').nth(0).click();
    await expect(page.locator('.term-mini')).toHaveCount(1);
    await snap('07 Results', 'L14b Plan, 6 months');
    await page.locator('main .segmented [role=radio]').nth(1).click();
    await expect(page.locator('.term-mini')).toHaveCount(2);
    await page.locator('.term-mini').first().click();
    await snap('07 Results', 'L14c Course reasons sheet');
    await page.keyboard.press('Escape');
    await page.locator('main .row-btn').nth(0).click();
    await snap('07 Results', 'L14d Skills gained sheet');
    await page.keyboard.press('Escape');
    await page.locator('main .row-btn').nth(1).click();
    await snap('07 Results', 'L14e Build elsewhere sheet');
    await page.keyboard.press('Escape');

    // ---------- 08 Course detail ----------
    await page.locator('.term-mini').first().click();
    await page.getByRole('dialog').locator('a.btn').click();
    await expect(page.locator('.subtabs')).toBeVisible();
    await snap('08 Course detail', 'L15a What you study');
    await page.locator('.subtabs button').nth(1).click();
    await snap('08 Course detail', 'L15b Skills');
    await page.locator('.subtabs button').nth(2).click();
    await snap('08 Course detail', 'L15c Before you start');
    await page.goBack();
    await expect(page.locator('.term-mini')).toHaveCount(2);

    // ---------- 09 Home ----------
    await primary(page).click();
    await page.waitForURL(/\/app$/);
    await page.waitForTimeout(4300); // confirmation toast
    await snap('09 Home', 'H01 Plan');
    await page.locator('.tabbar a').nth(1).click();
    await snap('09 Home', 'H02 Skills, you will build');
    await page.locator('main .segmented [role=radio]').nth(1).click();
    await snap('09 Home', 'H03 Skills, you need');
    await page.locator('main .segmented [role=radio]').nth(0).click();
    await page.locator('main .btn-ghost').click();
    await snap('09 Home', 'H04 All skills sheet');
    await page.keyboard.press('Escape');
    await page.locator('.tabbar a').nth(2).click();
    await snap('09 Home', 'H05 You');
    await page.locator('main .rows .row-btn').last().click();
    await snap('09 Home', 'H06 Delete data confirm');
    await page.keyboard.press('Escape');
    await page.locator('main .rows .row-btn').nth(-2).click();
    await snap('09 Home', 'H07 Sign out confirm');
    await page.keyboard.press('Escape');

    // Course platform events: course started, then not passed (plan re-planned with a banner)
    const P = { 'x-platform-key': 'platform-e2e' };
    await api('POST', `/learners/${id}/events`, { type: 'course_started', course_id: 'COM-3', date: '2026-11-02' }, P);
    await page.goto('/app');
    await snap('09 Home', 'H08 Course in progress');
    await api('POST', `/learners/${id}/events`, { type: 'course_failed', course_id: 'COM-3' }, P);
    await page.goto('/app');
    await snap('09 Home', 'L16 Plan updated banner');
    await page.close();
  });
}

test('staff consoles', async ({ browser }, info) => {
  test.skip(info.project.name !== 'mobile', 'Captured once');
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const snap = shooter(page, join(OUT, 'Staff consoles (desktop)'));
  await page.goto('/staff');
  await snap('10 Mentor', 'S01 Staff sign in');
  await page.getByLabel('Access code').fill('mentor-e2e');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Learners' })).toBeVisible();
  await snap('10 Mentor', 'M01 Learner list');
  await page.locator('tr.clickable').first().click();
  await expect(page.getByRole('heading', { name: 'Persona and axes' })).toBeVisible();
  await snap('10 Mentor', 'M02 Learner detail (every score)', { fullPage: true });
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.getByRole('radio', { name: 'Content admin' }).click();
  await page.getByLabel('Access code').fill('admin-e2e');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Pathway Engine admin' })).toBeVisible();
  await snap('11 Admin', 'AD01 Courses', { fullPage: true });
  await page.locator('tr', { hasText: 'BOT-1' }).getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Total hours').fill('44');
  await snap('11 Admin', 'AD01b Course onboarding template', { fullPage: true });
  await page.getByRole('button', { name: '1. Save draft' }).click();
  await page.getByRole('button', { name: '2. Validate' }).click();
  await expect(page.getByRole('heading', { name: 'Validation' })).toBeVisible();
  await snap('11 Admin', 'AD02 Validation results', { fullPage: true });
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('.toast')).toHaveCount(0, { timeout: 10_000 }); // keep the 'Draft saved' toast out of later shots
  await page.getByRole('tab', { name: 'Config versions' }).click();
  await snap('11 Admin', 'AD05 Config versions', { fullPage: true });
  await page.getByRole('tab', { name: 'Catalogue' }).click();
  await snap('11 Admin', 'AD03 Catalogue, skills');
  await page.getByRole('radio', { name: 'Goal areas' }).click();
  await snap('11 Admin', 'AD03b Catalogue, goal areas');
  await page.getByRole('radio', { name: 'Item bank' }).click();
  await snap('11 Admin', 'AD04 Item bank');
  await ctx.close();
});
