import { ruleChecks } from '../lib/review/ruleChecks';
import type { RuleInput, TermInput } from '../lib/review/ruleChecks';

const sampleRules: RuleInput[] = [
  {
    code: 'C-1',
    category: 'claims',
    title: 'Avoid absolute or unsubstantiated claims',
  },
  {
    code: 'T-1',
    category: 'tone',
    title: 'Avoid shouting and excessive punctuation',
  },
];

const sampleTerms: TermInput[] = [
  { avoid: 'customers', preferred: 'clients' },
  { avoid: 'cheap', preferred: 'cost-effective' },
  { avoid: 'artificial intelligence', preferred: 'AI assistance' },
];

const testPosts = [
  {
    name: 'Post 1: Terminology and Preferred Language',
    text: 'We always treat our customers with respect, delivering cheap solutions powered by artificial intelligence.',
  },
  {
    name: 'Post 2: Absolute Claims and Overpromising',
    text: "We are the world's best analytics tool and our platform is #1 with 100% guaranteed success. It never fails!",
  },
  {
    name: 'Post 3: Shouting (ALL CAPS and Multiple Exclamation Marks)',
    text: 'JOIN NOW to experience this AMAZING offer before it expires!!!! Do not wait!!',
  },
];

console.log('=== Running BrandFit Rule Checks Test ===\n');

for (const post of testPosts) {
  console.log(`--- ${post.name} ---`);
  console.log(`Content: "${post.text}"\n`);

  const findings = ruleChecks(post.text, {
    rules: sampleRules,
    terms: sampleTerms,
  });

  if (findings.length === 0) {
    console.log('  No issues flagged.\n');
  } else {
    console.log(`  Flagged ${findings.length} finding(s):`);
    for (const f of findings) {
      console.log(`  • [${f.category.toUpperCase()}] Severity: ${f.severity} | Rule: ${f.rule_code} | Confidence: ${f.confidence}`);
      console.log(`    Quoted: "${f.quoted_text}"`);
      console.log(`    Explanation: ${f.explanation}`);
      console.log(`    Suggestion: "${f.suggestion}"`);
    }
    console.log('');
  }
}

console.log('=== Test Completed Successfully ===');
