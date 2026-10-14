import { expect, test } from '@playwright/test';
import { answerSkillTask, choose, fitTracker, partB, shot } from './fixtures';

/** Full learner happy flow on the real screens: Learner A from the specification's worked example. */
test('learner goes from welcome to an accepted plan, and it survives a refresh', async ({ page }, info) => {
  const tag = info.project.name;
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.clock.install();
  // Every learner screen must fit a phone screen without scrolling (product requirement).
  const fit = fitTracker(page, tag === 'mobile');

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Find the right course for you' })).toBeVisible();
  await shot(page, `${tag}-01-welcome`);
  await fit.check('welcome');
  await page.getByRole('button', { name: 'Start' }).click();

  await page.getByLabel('What is your full name?').fill('Asha Kumari');
  await shot(page, `${tag}-02-name`);
  await fit.check('name');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('Day').selectOption('1');
  await page.getByLabel('Month').selectOption('5');
  await page.getByLabel('Year').selectOption('2007');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByText('Store my answers so I can continue later and get my plan').click();
  await page.getByText('Score my answers to build my course plan').click();
  await page.getByText('Share my results with my mentor and institution').click();
  await shot(page, `${tag}-03-consent`);
  await fit.check('consent');
  await page.getByRole('button', { name: 'Agree and continue' }).click();

  // Part A: About you
  await expect(page.getByText('Question 1 of 12')).toBeVisible();
  await fit.check('about A3');
  await choose(page, 'Woman');
  await fit.check('about A4');
  await page.getByLabel('State or union territory').selectOption('Bihar');
  await page.getByLabel('District or city').fill('Patna');
  await shot(page, `${tag}-04-about-location`);
  await page.getByRole('button', { name: 'Next' }).click();
  await choose(page, 'English');
  await choose(page, 'At a college');
  await fit.check('about A7 education');
  await choose(page, 'Undergraduate year 2');
  await shot(page, `${tag}-05-about-choice`);
  await choose(page, 'About 1 year');
  await fit.check('about A9 field');
  await choose(page, 'B.Com');
  await fit.check('about A10 certificates');
  await page.getByRole('checkbox', { name: 'None of these' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await choose(page, 'None');
  await choose(page, 'My own smartphone, and a laptop or computer lab');
  await choose(page, 'Reliable most of the time');
  await choose(page, '3 to 5 hours');

  // Part B: Learning profile, with realistic time per statement
  await expect(page.getByRole('heading', { name: 'There are no right or wrong answers' })).toBeVisible();
  await shot(page, `${tag}-06-profile-intro`);
  await fit.check('profile intro');
  await page.getByRole('button', { name: 'Begin' }).click();
  for (let i = 0; i < partB.length; i++) {
    const statement = page.locator('#statement');
    await expect(statement).toBeVisible();
    const text = (await statement.textContent())!.trim();
    const answer = partB.find((p) => p.text === text)!;
    await page.clock.fastForward(25_000);
    if (i === 3) await shot(page, `${tag}-07-statement`);
    if (i % 7 === 0) await fit.check(`statement ${i + 1}`);
    if (i === 5) {
      // Going back shows the earlier answer; tapping it again returns to where we were
      await page.getByRole('button', { name: 'Go back' }).click();
      const checked = page.locator('main').getByRole('radio', { checked: true });
      await expect(checked).toHaveCount(1);
      await checked.click();
      await expect(page.locator('#statement')).toHaveText(text);
    }
    await page.locator('main').getByRole('radio', { name: answer.label, exact: true }).click();
    await page.waitForTimeout(250);
  }

  // Part C: AI check (fail level 1) then Communication (fail band 3, pass band 2)
  await expect(page.getByRole('heading', { name: 'Short tasks. Do your best.' })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Begin' }).click();
  await page.clock.fastForward(60_000);
  await shot(page, `${tag}-08-ai-task`);
  await fit.check('ai task 1');
  await answerSkillTask(page, (t) => t.startsWith('An AI assistant confidently'));
  await page.clock.fastForward(60_000);
  await answerSkillTask(page, () => false);
  await expect(page.getByRole('heading', { name: 'Now, a few communication tasks' })).toBeVisible();
  await page.getByRole('button', { name: 'Begin' }).click();
  const band3 = ['Listen to the update', 'Which handover note is clearest?', 'Choose the best word: "Please ___ the shift'];
  for (let i = 0; i < 6; i++) {
    await page.clock.fastForward(60_000);
    if (i === 0) await shot(page, `${tag}-09-listening`);
    await fit.check(`communication task ${i + 1}`);
    await answerSkillTask(page, (t) => band3.some((b) => t.startsWith(b)));
  }

  // Part D: Goals
  await expect(page.getByRole('heading', { name: 'Which kinds of work interest you?' })).toBeVisible();
  await page.getByRole('button', { name: /Finance, Accounts & Banking/ }).click();
  await shot(page, `${tag}-10-goals`);
  await fit.check('goals cards');
  await page.getByRole('button', { name: 'Next' }).click();
  await fit.check('goals D2');
  await choose(page, 'Get a job in 1 to 2 years');
  await choose(page, 'In 1 to 2 years');
  await choose(page, 'Within my state');
  await fit.check('goals note');
  await page.getByLabel('Anything else you would like your mentor to know?').fill('I can study in the evenings.');
  await page.getByRole('button', { name: 'Finish' }).click();

  // L10: one tie-breaker (Goal Horizon is borderline for Learner A)
  await expect(page.getByRole('heading', { name: 'A year from now, what matters more to you?' })).toBeVisible();
  await shot(page, `${tag}-11-quick`);
  await fit.check('quick question');
  await page.locator('main').getByRole('radio', { name: 'Being better qualified' }).click();

  // Results: four short screens
  await expect(page.getByRole('heading', { name: 'The Climber' })).toBeVisible({ timeout: 20_000 });
  await page.locator('main').getByRole('radio', { name: 'Yes' }).click();
  await shot(page, `${tag}-12-type`);
  await fit.check('result: learner type');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Finance, Accounts & Banking').first()).toBeVisible();
  await shot(page, `${tag}-13-interests`);
  await fit.check('result: interests');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Numerical accuracy checking')).toBeVisible();
  await shot(page, `${tag}-14-gaps`);
  await fit.check('result: skills to build');
  await page.getByRole('button', { name: 'Next' }).click();
  const terms = page.locator('.term-mini');
  await expect(terms).toHaveCount(2);
  await expect(terms.nth(0)).toContainText('Supervisory Communication Skills');
  await expect(terms.nth(1)).toContainText('AI First Steps: Use It and Check It');
  await expect(page.getByText('What you will be able to do after 12 months')).toBeVisible();
  await shot(page, `${tag}-15-plan`);
  await fit.check('result: plan');

  // Length toggle reruns the pathway
  await page.locator('main').getByRole('radio', { name: /6 months/ }).click();
  await expect(terms).toHaveCount(1);
  await page.locator('main').getByRole('radio', { name: /12 months/ }).click();
  await expect(terms).toHaveCount(2);

  // Skills gained and how they help, in a bottom sheet
  await page.getByText('What you will be able to do after 12 months').click();
  await expect(page.getByRole('dialog')).toContainText('Used in Finance, Accounts & Banking');
  await page.waitForTimeout(400);
  await shot(page, `${tag}-15b-skills-sheet`);
  await page.getByRole('button', { name: 'Close' }).click();

  // Term details sheet, then course detail and back
  await terms.nth(0).click();
  await expect(page.getByRole('dialog')).toContainText('you are likely to be able to');
  await page.waitForTimeout(400);
  await shot(page, `${tag}-15c-term-sheet`);
  await page.getByRole('dialog').getByRole('link', { name: 'Course details' }).click();
  await expect(page.getByRole('heading', { name: 'Supervisory Communication Skills' })).toBeVisible();
  await shot(page, `${tag}-16-course`);
  await fit.check('course detail');
  await page.getByRole('tab', { name: 'Skills' }).click();
  await fit.check('course detail: skills tab');
  await page.getByRole('button', { name: 'Go back' }).click();
  await expect(terms).toHaveCount(2);

  await page.getByRole('button', { name: 'Start this plan' }).click();
  await expect(page.getByRole('heading', { name: 'Your 12-month plan' })).toBeVisible();
  await page.waitForTimeout(4200); // let the confirmation toast go
  await shot(page, `${tag}-17-dashboard`);
  await fit.check('home: plan');

  // Persistence: a refresh lands on the same plan
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your 12-month plan' })).toBeVisible();
  await page.getByRole('link', { name: 'Skills' }).click();
  await expect(page.getByRole('heading', { name: 'What your plan builds' })).toBeVisible();
  await shot(page, `${tag}-18-skills-tab`);
  await fit.check('home: skills');
  await page.locator('main').getByRole('radio', { name: 'You need' }).click();
  await fit.check('home: skills you need');
  await page.getByRole('link', { name: 'You' }).click();
  await expect(page.getByRole('button', { name: /Delete my data/ })).toBeVisible();
  await shot(page, `${tag}-19-you-tab`);
  await fit.check('home: you');

  // Hindi: the switch translates screen text and content, and screens still fit
  await page.getByRole('radio', { name: 'हिंदी' }).first().click();
  await expect(page.getByText('पर्वतारोही')).toBeVisible();
  await page.getByRole('link', { name: 'योजना', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'आपकी 12 महीने की योजना' })).toBeVisible();
  await expect(page.locator('.term-mini').first()).toContainText('सुपरवाइज़री संचार कौशल');
  await shot(page, `${tag}-20-home-hindi`);
  await fit.check('home: plan (Hindi)');
  await page.goto('/results/plan');
  await expect(page.getByText('12 महीनों के बाद आप क्या कर पाएँगे')).toBeVisible();
  await shot(page, `${tag}-21-plan-hindi`);
  await fit.check('result: plan (Hindi)');
  await page.locator('.term-mini').first().click();
  await expect(page.getByRole('dialog')).toContainText('आप शायद');
  await page.getByRole('button', { name: 'बंद करें' }).click();
  await page.getByRole('radio', { name: 'EN' }).first().click();
  await expect(page.getByText('What you will be able to do after 12 months')).toBeVisible();

  // Welcome offers to continue, and the assessment cannot be reopened
  await page.goto('/journey/skills');
  await expect(page).toHaveURL(/\/app$/);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Open my plan' })).toBeVisible();

  // No learner-facing text breaks a wording rule (FR-19)
  for (const path of ['/app', '/app/skills', '/app/you', '/results/plan']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const body = (await page.locator('body').innerText()).toLowerCase();
    for (const banned of ['guaranteed', 'placement', 'job-ready', 'certified', 'salary', 'गारंटी', 'प्लेसमेंट', 'प्रमाणित', 'वेतन']) expect(body, `${path} contains ${banned}`).not.toContain(banned);
  }
  expect(errors).toEqual([]);
  expect(fit.misses, `Screens that need scrolling on a phone:\n${fit.misses.join('\n')}`).toEqual([]);
});
