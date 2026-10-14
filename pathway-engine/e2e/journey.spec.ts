import { expect, test } from '@playwright/test';
import { answerSkillTask, choose, partB, shot } from './fixtures';

/** Full learner happy flow on the real screens: Learner A from the specification's worked example. */
test('learner goes from welcome to an accepted plan, and it survives a refresh', async ({ page }, info) => {
  const tag = info.project.name;
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.clock.install();

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Find the right course for you' })).toBeVisible();
  await shot(page, `${tag}-01-welcome`);
  await page.getByRole('button', { name: 'Start' }).click();

  await page.getByLabel('What is your full name?').fill('Asha Kumari');
  await shot(page, `${tag}-02-name`);
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('Day').selectOption('1');
  await page.getByLabel('Month').selectOption('5');
  await page.getByLabel('Year').selectOption('2007');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByText('Store my answers so I can continue later and get my plan').click();
  await page.getByText('Score my answers to build my course plan').click();
  await page.getByText('Share my results with my mentor and institution').click();
  await shot(page, `${tag}-03-consent`);
  await page.getByRole('button', { name: 'Agree and continue' }).click();

  // Part A: About you
  await expect(page.getByText('Question 1 of 12')).toBeVisible();
  await choose(page, 'Woman');
  await page.getByLabel('State or union territory').selectOption('Bihar');
  await page.getByLabel('District or city').fill('Patna');
  await shot(page, `${tag}-04-about-location`);
  await page.getByRole('button', { name: 'Next' }).click();
  await choose(page, 'English');
  await choose(page, 'At a college');
  await choose(page, 'Undergraduate year 2');
  await shot(page, `${tag}-05-about-choice`);
  await choose(page, 'About 1 year');
  await choose(page, 'B.Com');
  await page.getByRole('checkbox', { name: 'None of these' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await choose(page, 'None');
  await choose(page, 'My own smartphone, and a laptop or computer lab');
  await choose(page, 'Reliable most of the time');
  await choose(page, '3 to 5 hours');

  // Part B: Learning profile, with realistic time per statement
  await expect(page.getByRole('heading', { name: 'There are no right or wrong answers' })).toBeVisible();
  await shot(page, `${tag}-06-profile-intro`);
  await page.getByRole('button', { name: 'Begin' }).click();
  for (let i = 0; i < partB.length; i++) {
    const statement = page.locator('#statement');
    await expect(statement).toBeVisible();
    const text = (await statement.textContent())!.trim();
    const answer = partB.find((p) => p.text === text)!;
    await page.clock.fastForward(25_000);
    if (i === 3) await shot(page, `${tag}-07-statement`);
    if (i === 5) {
      // Going back shows the earlier answer; tapping it again returns to where we were
      await page.getByRole('button', { name: 'Go back' }).click();
      const checked = page.getByRole('radio', { checked: true });
      await expect(checked).toHaveCount(1);
      await checked.click();
      await expect(page.locator('#statement')).toHaveText(text);
    }
    await page.getByRole('radio', { name: answer.label, exact: true }).click();
    await page.waitForTimeout(250);
  }

  // Part C: AI check (fail level 1) then Communication (fail band 3, pass band 2)
  await expect(page.getByRole('heading', { name: 'Short tasks. Do your best.' })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Begin' }).click();
  await page.clock.fastForward(60_000);
  await shot(page, `${tag}-08-ai-task`);
  await answerSkillTask(page, (t) => t.startsWith('An AI assistant confidently'));
  await page.clock.fastForward(60_000);
  await answerSkillTask(page, () => false);
  await expect(page.getByRole('heading', { name: 'Now, a few communication tasks' })).toBeVisible();
  await page.getByRole('button', { name: 'Begin' }).click();
  const band3 = ['Listen to the update', 'Which handover note is clearest?', 'Choose the best word: "Please ___ the shift'];
  for (let i = 0; i < 6; i++) {
    await page.clock.fastForward(60_000);
    if (i === 0) await shot(page, `${tag}-09-listening`);
    await answerSkillTask(page, (t) => band3.some((b) => t.startsWith(b)));
  }

  // Part D: Goals
  await expect(page.getByRole('heading', { name: 'Which kinds of work interest you?' })).toBeVisible();
  await page.getByRole('button', { name: /Finance, Accounts & Banking/ }).click();
  await shot(page, `${tag}-10-goals`);
  await page.getByRole('button', { name: 'Next' }).click();
  await choose(page, 'Get a job in 1 to 2 years');
  await choose(page, 'In 1 to 2 years');
  await choose(page, 'Within my state');
  await page.getByLabel('Anything else you would like your mentor to know?').fill('I can study in the evenings.');
  await page.getByRole('button', { name: 'Finish' }).click();

  // L10: one tie-breaker (Goal Horizon is borderline for Learner A)
  await expect(page.getByRole('heading', { name: 'A year from now, what matters more to you?' })).toBeVisible();
  await shot(page, `${tag}-11-quick`);
  await page.getByRole('radio', { name: 'Being better qualified' }).click();

  // Results: four short screens
  await expect(page.getByRole('heading', { name: 'The Climber' })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('radio', { name: 'Yes' }).click();
  await shot(page, `${tag}-12-type`);
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('heading', { name: 'Finance, Accounts & Banking' })).toBeVisible();
  await shot(page, `${tag}-13-interests`);
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Numerical accuracy checking')).toBeVisible();
  await shot(page, `${tag}-14-gaps`);
  await page.getByRole('button', { name: 'Next' }).click();
  const terms = page.locator('article.term');
  await expect(terms).toHaveCount(2);
  await expect(terms.nth(0)).toContainText('Supervisory Communication Skills');
  await expect(terms.nth(1)).toContainText('AI First Steps: Use It and Check It');
  await expect(page.getByText('What you will be able to do after 12 months')).toBeVisible();
  await shot(page, `${tag}-15-plan`);

  // Length toggle reruns the pathway
  await page.getByRole('radio', { name: /6 months/ }).click();
  await expect(terms).toHaveCount(1);
  await page.getByRole('radio', { name: /12 months/ }).click();
  await expect(terms).toHaveCount(2);

  // Course detail and back
  await terms.nth(0).getByRole('link', { name: 'Course details' }).click();
  await expect(page.getByRole('heading', { name: 'Supervisory Communication Skills' })).toBeVisible();
  await shot(page, `${tag}-16-course`);
  await page.getByRole('button', { name: 'Go back' }).click();
  await expect(terms).toHaveCount(2);

  await page.getByRole('button', { name: 'Start this plan' }).click();
  await expect(page.getByRole('heading', { name: 'Your 12-month plan' })).toBeVisible();
  await shot(page, `${tag}-17-dashboard`);

  // Persistence: a refresh lands on the same plan
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your 12-month plan' })).toBeVisible();
  await page.getByRole('link', { name: 'Skills' }).click();
  await expect(page.getByText('After 12 months, you are likely to be able to')).toBeVisible();
  await shot(page, `${tag}-18-skills-tab`);
  await page.getByRole('link', { name: 'You' }).click();
  await expect(page.getByRole('button', { name: 'Delete my data' })).toBeVisible();
  await shot(page, `${tag}-19-you-tab`);

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
    for (const banned of ['guaranteed', 'placement', 'job-ready', 'certified', 'salary']) expect(body, `${path} contains ${banned}`).not.toContain(banned);
  }
  expect(errors).toEqual([]);
});
