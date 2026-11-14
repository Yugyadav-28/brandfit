import { safeSuggestion, SAFE_SUGGESTION_FALLBACK } from '../lib/review/safeSuggestion';

interface TestCase {
  name: string;
  input: string;
  expected: string;
}

const testCases: TestCase[] = [
  {
    name: 'Example 1: contains "best" (forbidden superlative)',
    input: 'This is the best platform for your team.',
    expected: SAFE_SUGGESTION_FALLBACK,
  },
  {
    name: 'Example 2: contains "#1" (forbidden claim)',
    input: 'Rated #1 by industry analysts.',
    expected: SAFE_SUGGESTION_FALLBACK,
  },
  {
    name: 'Example 3: contains "guaranteed" (forbidden promise)',
    input: 'Guaranteed performance improvements.',
    expected: SAFE_SUGGESTION_FALLBACK,
  },
  {
    name: 'Example 4: contains "100%" (forbidden statistic/claim)',
    input: 'Delivers 100% uptime for all services.',
    expected: SAFE_SUGGESTION_FALLBACK,
  },
  {
    name: 'Example 5: safe terminology replacement',
    input: 'clients',
    expected: 'clients',
  },
  {
    name: 'Example 6: safe rewrite without claims or superlatives',
    input: 'Consider scheduling a consultation with our advisory team.',
    expected: 'Consider scheduling a consultation with our advisory team.',
  },
];

let allPassed = true;

for (let i = 0; i < testCases.length; i++) {
  const { name, input, expected } = testCases[i];
  const actual = safeSuggestion(input);
  const passed = actual === expected;

  if (passed) {
    console.log(`[PASS] Example ${i + 1}: ${name}`);
  } else {
    console.error(`[FAIL] Example ${i + 1}: ${name}`);
    console.error(`  Expected: "${expected}"`);
    console.error(`  Actual:   "${actual}"`);
    allPassed = false;
  }
}

if (!allPassed) {
  process.exit(1);
}
