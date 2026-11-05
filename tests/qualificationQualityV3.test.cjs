const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '../n8n/qualification-v3', name), 'utf8');

test('hourly rate is not compared with project minimum', () => {
 const s = read('attach-intent-classification.js');
 assert.match(s, /const isHourlyBudget/);
 assert.match(s, /!isHourlyBudget &&/);
 assert.match(s, /hourly_rate_review_required/);
 assert.match(s, /budget_review_required: budgetReviewRequired/);
});
test('fixed-price, language and verified service gates remain', () => {
 const s = read('attach-intent-classification.js');
 for (const marker of ['commercialPass = false', 'scopeBudgetPass = false', 'eligibilityPass', 'serviceEvidenceVerified', 'budget_far_below_service_minimum']) assert.ok(s.includes(marker));
});
test('unverified hourly totals are capped at review in preliminary scoring', () => {
 const s = read('preliminary-opportunity-score.js');
 assert.match(s, /budget_review_required === true/);
 assert.match(s, /recommendedAction = 'review'/);
});
test('warning is persisted and final scoring cannot promote unverified totals', () => {
 assert.match(read('prepare-database-record.js'), /budget_review: \{/);
 assert.match(read('calculate-final-score.js'), /budget_review\?\.required === true/);
});
