# BrandFit Testing Guide

This document describes the test suites, verification scripts, automated evaluation harness, and security tests available in BrandFit.

---

## 1. Quick Test Commands

| Command | Description | Needs Database? | Needs AI? |
| :--- | :--- | :---: | :---: |
| `npm test` | Runs all offline unit and regression test suites (insights, media, color, team activity, safe suggestions) | No | No |
| `npm run test:media` | Tests file validation (PDF, DOCX, PNG, JPEG, WebP magic bytes) and document accessibility extraction | No | No |
| `npm run test:color` | Tests WCAG 2.1 contrast ratios, CIE76 deltaE color difference, relative luminance, and palette matching | No | No |
| `npm run test:insights` | Tests insights compute functions (broken rules, repeat mistakes, rejection rates, trend aggregation) | No | No |
| `npm run test:rls` | Validates multi-tenant isolation and Row Level Security policies across all PostgreSQL tables | Yes | No |
| `npm run eval` | Runs the automated review evaluation harness against benchmark golden test cases | Yes | Yes |

---

## 2. Test Suites Overview

### Unit & Offline Tests (`npm test`)

The primary test runner (`scripts/run-tests.js`) executes five standalone test suites in sequence without requiring live database or network access:

1. **Insights Computation (`scripts/test-insights.ts`)**:
   - `mostBrokenRules`: Aggregates and sorts first-version rule violations.
   - `repeatMistakeStats`: Verifies author repeat mistake counts, rates, and repeated rule codes.
   - `rejectionRates`: Confirms calculation of reviewer rejection percentages and the 40% "possibly unclear" threshold.
   - `trendByPeriod`: Tests day/week timeline grouping, zero-filling, and findings-per-submission averages.

2. **Media Validation & Document Extraction (`scripts/test-media.ts`)**:
   - Validates file signatures using real magic bytes (`%PDF-`, `PK\x03\x04`, `\x89PNG`, `\xFF\xD8\xFF`, `RIFF....WEBP`).
   - Verifies rejection of renamed files (e.g. text file renamed to `.png`).
   - Enforces the 4 MB file size ceiling.
   - Tests `extractDocument` with `unpdf` and `mammoth` for text extraction, heading detection (`h1`–`h6`), and alt text presence on embedded images.
   - Verifies `docChecks` rule generation for missing alt text (rule `A-1`), long unformatted text without headings (rule `A-4`), and unreadable documents.

3. **Color & Contrast Engine (`scripts/test-color.ts`)**:
   - `wcagContrast`: Verifies WCAG 2.1 contrast formulas (e.g. 21:1 for black on white, ~4.54:1 for #767676 on white).
   - `deltaE`: Tests CIE76 color difference calculations.
   - `relativeLuminance` & `rgbToLab`: Tests sRGB to CIE L*a*b* conversion and luminance calculation.
   - `nearestBrandColour`: Verifies nearest palette matching against brand colors.

4. **Team Activity Aggregation (`scripts/test-team-activity.ts`)**:
   - Tests employer dashboard team activity calculations.
   - Ensures only first-version findings count as author mistakes.
   - Verifies accepted, edited, and rejected counts per team member.
   - Verifies detection of repeated mistakes across two or more submissions.

5. **Safe Suggestion Sanitization (`scripts/test-safe-suggestion.ts`)**:
   - Tests replacement text sanitization to ensure AI suggestions do not introduce prohibited superlatives, unsubstantiated claims, or unapproved promises.

---

## 3. Database Security & RLS Tests (`npm run test:rls`)

`scripts/test-rls.ts` creates isolated temporary workspaces with test users (employer, reviewer, employee, non-member) and verifies that PostgreSQL Row Level Security policies enforce the following constraints:
- Members can only read data belonging to their own company (`company_id`).
- Non-members cannot read rules, facts, terms, colours, submissions, versions, or findings.
- Only employers can insert, update, or delete rules, facts, terms, and brand colours.
- Employees can only update their own drafts before sending for review.
- Reviewers and employers can update findings and mark review decisions.
- Audit log is strictly append-only; updates and deletions are rejected.

---

## 4. Evaluation Harness (`npm run eval`)

`scripts/eval.ts` runs automated benchmarks against golden datasets (`eval/golden.json` and `scripts/sample-posts.json`):
- Measures precision, recall, and F1 score of rule violation detection.
- Validates citation accuracy (every finding must cite a valid rule or fact code).
- Evaluates exact-quote extraction fidelity.
- Generates structured evaluation reports (`eval/results.json`).
