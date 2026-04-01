# Design Rules — JobSeeker Calculator

This document defines how payment data is sourced, verified, and maintained for the JobSeeker Calculator. All contributors (human and AI) must follow these rules when updating rates or calculation logic.

---

## 1. Data Architecture

All payment rates, thresholds, and rules live in **`data/jobseeker-rates.json`** — the single source of truth. The calculator JavaScript reads from this file and never hardcodes any values.

| File | Purpose |
|---|---|
| `data/trusted-sources.json` | Allowlist of authorised reference domains |
| `data/jobseeker-rates.json` | Payment rates, income/asset test rules, and references |
| `DESIGN_RULES.md` | This file — data governance and verification process |

---

## 2. Trusted Sources

Only URLs from domains listed in `data/trusted-sources.json` may appear as references in `jobseeker-rates.json`.

### Primary Sources (authoritative)

| Domain | Use for |
|---|---|
| `servicesaustralia.gov.au` | Payment rules, eligibility, income/asset test details |
| `dss.gov.au` | Official indexed payment rates (published March 20 and September 20) |
| `legislation.gov.au` | Legal definitions of payment rules |
| `centrelink.gov.au` | Online services and legacy content |

### Secondary Sources (supporting)

| Domain | Use for |
|---|---|
| `humanservices.gov.au` | Archived content from before Services Australia rebrand |

### Not Permitted as References

Third-party sites (FairWorkMate, BenefitsMate, OzSparkHub, Reddit, etc.) may be used during research to cross-reference data, but **must not** appear in the `references` array of `jobseeker-rates.json`. Every data point must trace back to an official government source.

### Adding a New Trusted Source

To add a new domain to `trusted-sources.json`:
1. It must be an Australian government domain (`.gov.au`)
2. It must publish primary source data (not aggregated/scraped from other sites)
3. Add it with type `primary` or `secondary` and a clear description
4. Update this document's trusted sources table

---

## 3. Verification Process

### Before Any Data Update

1. **Check the effective date** — rates change on March 20 and September 20 each year
2. **Find the official DSS publication** at `dss.gov.au` for the relevant indexation period
3. **Cross-reference** with Services Australia payment pages
4. **If sources disagree**: DSS indexed rates take priority over all other sources

### For Each Data Point

Every number in `jobseeker-rates.json` must have:
- A `referenceIds` array linking to entries in the `references` section
- Each reference must have a URL on a domain from `trusted-sources.json`
- Each reference must include `accessedDate` (when the page was last checked)

### Verification Checklist

- [ ] All `referenceIds` in categories/tests resolve to entries in `references[]`
- [ ] All reference URLs are on domains in `trusted-sources.json`
- [ ] `effectiveDate` matches the current indexation period
- [ ] `nextIndexationDate` is set correctly
- [ ] Rates include Energy Supplement (as shown on Services Australia)
- [ ] Income test taper rates match Services Australia documentation
- [ ] Asset test thresholds match for all situations (single/couple, homeowner/non-homeowner)

---

## 4. Indexation Schedule

Centrelink payment rates are indexed twice per year:

| Date | Period |
|---|---|
| **March 20** | Effective March 20 to September 19 |
| **September 20** | Effective September 20 to March 19 |

### Update Process

After each indexation date:
1. Wait for DSS to publish the new rates PDF
2. Update all values in `jobseeker-rates.json`
3. Update `effectiveDate` and `nextIndexationDate`
4. Update `accessedDate` on all references
5. Bump the `dataVersion`
6. Run the verification checklist above
7. Commit with message: `feat: update rates for [Month Year] indexation`

---

## 5. Calculation Rules

### Income Test (Personal)

```
if income <= freeArea:
    reduction = 0
elif income <= taperBands[0].to:
    reduction = (income - freeArea) * taperBands[0].rate
else:
    reduction = (taperBands[0].to - freeArea) * taperBands[0].rate
               + (income - taperBands[0].to) * taperBands[1].rate

payment = max(0, baseRate - reduction)
```

### Partner Income Test

```
if partnerIncome <= partnerFreeArea:
    partnerReduction = 0
else:
    partnerReduction = (partnerIncome - partnerFreeArea) * partnerTaperRate

payment = max(0, baseRate - partnerReduction)
```

### Combined Result

The recipient receives the **lower** of:
- Payment after personal income test
- Payment after partner income test

### Asset Test

The asset test is a **hard cut-off** — if total assessable assets exceed the threshold, payment is $0. There is no taper/gradual reduction.

The principal home (the home you live in) is excluded from the asset test.

---

## 6. Known Limitations (MVP)

The following are **out of scope** for the initial release and should be noted to users:

| Feature | Status | Notes |
|---|---|---|
| Working Credits | Out of scope | Allows banking of income credits up to $3,500 |
| Liquid Assets Waiting Period (LAWP) | Out of scope | May delay start of payments |
| Rent Assistance | Out of scope | Additional supplement for renters |
| Pharmaceutical Allowance | Out of scope | Small additional supplement |
| Telephone Allowance | Out of scope | Quarterly supplement |
| Youth Allowance (under 22) | Out of scope | Different payment with different rules |
| Age Pension age recipients | Out of scope | Different payment pathway |
| Disability Support Pension | Out of scope | Different payment entirely |

---

## 7. Disclaimer Requirements

The calculator page must display:
- The effective date of the rates being used
- A clear disclaimer that this is an estimate, not an official Centrelink assessment
- A link to Services Australia for official information
- The next indexation date so users know when rates will change
