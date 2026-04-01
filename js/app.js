/**
 * JobSeeker Calculator — DOM Interaction & App Logic
 *
 * Loads rate data from JSON, binds form events, and renders results.
 */

let ratesData = null;

/**
 * Load the rates JSON data.
 */
async function loadRates() {
  const response = await fetch('./data/jobseeker-rates.json');
  if (!response.ok) {
    throw new Error('Failed to load payment rates data');
  }
  return response.json();
}

/**
 * Show or hide the partner income field based on category selection.
 */
function updateFormVisibility() {
  const category = document.getElementById('category').value;
  const partnerGroup = document.getElementById('partner-income-group');
  const partnerInput = document.getElementById('partner-income');

  if (category === 'partnered') {
    partnerGroup.classList.remove('hidden');
  } else {
    partnerGroup.classList.add('hidden');
    partnerInput.value = '0';
  }
}

/**
 * Read form inputs and return a structured object.
 */
function getFormInputs() {
  return {
    category: document.getElementById('category').value,
    income: parseFloat(document.getElementById('income').value) || 0,
    partnerIncome: parseFloat(document.getElementById('partner-income').value) || 0,
    assets: parseFloat(document.getElementById('assets').value) || 0,
    isHomeowner: document.getElementById('homeowner').value === 'yes'
  };
}

/**
 * Format a number as Australian currency.
 */
function formatCurrency(amount) {
  return '$' + amount.toLocaleString('en-AU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Render the calculation results.
 */
function renderResults(result) {
  const resultsSection = document.getElementById('results');
  const noResults = document.getElementById('no-results');
  const resultsContent = document.getElementById('results-content');

  noResults.classList.add('hidden');
  resultsContent.classList.remove('hidden');

  // Main payment amounts
  document.getElementById('result-fortnightly').textContent = formatCurrency(result.fortnightlyPayment);
  document.getElementById('result-annual').textContent = formatCurrency(result.annualPayment);

  // Breakdown
  document.getElementById('result-base-rate').textContent = formatCurrency(result.baseRate);
  document.getElementById('result-income-reduction').textContent =
    result.incomeReduction > 0
      ? '-' + formatCurrency(result.incomeReduction)
      : formatCurrency(0);

  // Partner reduction row
  const partnerRow = document.getElementById('partner-reduction-row');
  if (result.partnerReduction > 0) {
    partnerRow.classList.remove('hidden');
    document.getElementById('result-partner-reduction').textContent =
      '-' + formatCurrency(result.partnerReduction);
  } else {
    partnerRow.classList.add('hidden');
  }

  // Asset test
  const assetStatus = document.getElementById('result-asset-test');
  if (result.assetTest.passes) {
    assetStatus.textContent = 'Pass (under ' + formatCurrency(result.assetTest.threshold) + ')';
    assetStatus.className = 'value pass';
  } else {
    assetStatus.textContent = 'Fail (over ' + formatCurrency(result.assetTest.threshold) + ')';
    assetStatus.className = 'value fail';
  }

  // Reason message
  const reasonEl = document.getElementById('result-reason');
  if (result.reason) {
    reasonEl.textContent = result.reason;
    reasonEl.classList.remove('hidden');
  } else {
    reasonEl.classList.add('hidden');
  }

  resultsSection.classList.add('visible');
}

/**
 * Handle form submission — calculate and display results.
 */
function handleCalculate(e) {
  if (e) e.preventDefault();

  if (!ratesData) {
    console.error('Rates data not loaded');
    return;
  }

  const inputs = getFormInputs();
  const result = calculatePayment(ratesData, inputs);
  renderResults(result);
}

/**
 * Populate the disclaimer with effective date info from the data.
 */
function renderDisclaimer(data) {
  const effectiveEl = document.getElementById('effective-date');
  const nextEl = document.getElementById('next-indexation');

  if (effectiveEl) {
    effectiveEl.textContent = new Date(data.effectiveDate).toLocaleDateString('en-AU', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  }
  if (nextEl) {
    nextEl.textContent = new Date(data.nextIndexationDate).toLocaleDateString('en-AU', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  }
}

/**
 * Initialise the app.
 */
async function init() {
  try {
    ratesData = await loadRates();
    renderDisclaimer(ratesData);

    // Bind events
    document.getElementById('category').addEventListener('change', updateFormVisibility);
    document.getElementById('calculator-form').addEventListener('submit', handleCalculate);

    // Set initial form state
    updateFormVisibility();

  } catch (error) {
    console.error('Failed to initialise calculator:', error);
    document.getElementById('no-results').textContent =
      'Error: Could not load payment rates. Please refresh the page.';
  }
}

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', init);
