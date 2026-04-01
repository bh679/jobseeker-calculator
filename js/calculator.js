/**
 * JobSeeker Payment Calculator — Pure Calculation Functions
 *
 * All functions take the rates data object as their first parameter.
 * No DOM access, no side effects — purely testable.
 */

/**
 * Get the base fortnightly rate for a given situation category.
 * @param {object} data - The jobseeker-rates.json data
 * @param {string} categoryId - One of: single, single_children, single_55_plus, partnered
 * @returns {number} Fortnightly payment rate (includes Energy Supplement)
 */
function getBaseRate(data, categoryId) {
  const category = data.categories.find(c => c.id === categoryId);
  if (!category) {
    throw new Error(`Unknown category: ${categoryId}`);
  }
  return category.fortnightlyRate;
}

/**
 * Calculate the reduction to payment based on personal income.
 * Uses a two-tier taper: 50c/$1 from $150-$256, then 60c/$1 above $256.
 *
 * @param {object} data - The jobseeker-rates.json data
 * @param {number} income - Personal fortnightly income
 * @returns {number} Amount to reduce from base rate
 */
function calcIncomeReduction(data, income) {
  const { freeArea, taperBands } = data.incomeTest;

  if (income <= freeArea) {
    return 0;
  }

  let reduction = 0;

  for (const band of taperBands) {
    const bandStart = band.from;
    const bandEnd = band.to; // null means no upper limit

    if (income <= bandStart) break;

    const applicableIncome = bandEnd !== null
      ? Math.min(income, bandEnd) - bandStart
      : income - bandStart;

    reduction += applicableIncome * band.rate;
  }

  return Math.round(reduction * 100) / 100;
}

/**
 * Calculate the reduction to payment based on partner's income.
 * Applies a flat taper rate above the partner income free area.
 *
 * @param {object} data - The jobseeker-rates.json data
 * @param {number} partnerIncome - Partner's fortnightly income
 * @returns {number} Amount to reduce from base rate
 */
function calcPartnerReduction(data, partnerIncome) {
  const { freeArea, taperRate } = data.partnerIncomeTest;

  if (partnerIncome <= freeArea) {
    return 0;
  }

  const reduction = (partnerIncome - freeArea) * taperRate;
  return Math.round(reduction * 100) / 100;
}

/**
 * Check whether the person passes the asset test.
 * JobSeeker uses a hard cut-off — no taper.
 *
 * @param {object} data - The jobseeker-rates.json data
 * @param {number} assets - Total assessable assets (excluding principal home)
 * @param {boolean} isPartnered - Whether the person is partnered
 * @param {boolean} isHomeowner - Whether the person owns their home
 * @returns {{ passes: boolean, threshold: number }} Asset test result
 */
function checkAssetTest(data, assets, isPartnered, isHomeowner) {
  const key = (isPartnered ? 'couple' : 'single')
    + '_'
    + (isHomeowner ? 'homeowner' : 'non_homeowner');

  const threshold = data.assetTest.thresholds[key];

  return {
    passes: assets <= threshold,
    threshold: threshold
  };
}

/**
 * Calculate the estimated fortnightly JobSeeker Payment.
 *
 * @param {object} data - The jobseeker-rates.json data
 * @param {object} inputs - User inputs
 * @param {string} inputs.category - Payment category ID
 * @param {number} inputs.income - Personal fortnightly income
 * @param {number} inputs.partnerIncome - Partner's fortnightly income (0 if not partnered)
 * @param {number} inputs.assets - Total assessable assets
 * @param {boolean} inputs.isHomeowner - Whether the person owns their home
 * @returns {object} Calculation result with breakdown
 */
function calculatePayment(data, inputs) {
  const { category, income, partnerIncome, assets, isHomeowner } = inputs;
  const isPartnered = category === 'partnered';

  // 1. Get base rate
  const baseRate = getBaseRate(data, category);

  // 2. Check asset test (hard cut-off)
  const assetResult = checkAssetTest(data, assets, isPartnered, isHomeowner);
  if (!assetResult.passes) {
    return {
      baseRate,
      incomeReduction: 0,
      partnerReduction: 0,
      assetTest: assetResult,
      fortnightlyPayment: 0,
      annualPayment: 0,
      reason: 'Assets exceed the threshold — payment is $0'
    };
  }

  // 3. Calculate personal income reduction
  const incomeReduction = calcIncomeReduction(data, income);

  // 4. Calculate partner income reduction (only for partnered)
  const partnerReduction = isPartnered
    ? calcPartnerReduction(data, partnerIncome)
    : 0;

  // 5. Payment after personal income test
  const afterPersonalTest = Math.max(0, baseRate - incomeReduction);

  // 6. Payment after partner income test
  const afterPartnerTest = isPartnered
    ? Math.max(0, baseRate - partnerReduction)
    : afterPersonalTest;

  // 7. Final payment is the lower of the two tests
  const fortnightlyPayment = Math.round(
    Math.min(afterPersonalTest, afterPartnerTest) * 100
  ) / 100;

  const annualPayment = Math.round(fortnightlyPayment * 26 * 100) / 100;

  return {
    baseRate,
    incomeReduction,
    partnerReduction,
    assetTest: assetResult,
    afterPersonalTest,
    afterPartnerTest,
    fortnightlyPayment,
    annualPayment,
    reason: fortnightlyPayment === 0
      ? 'Income reduces payment to $0'
      : null
  };
}
