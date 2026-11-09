import type { Finding } from '../types';

export interface RuleInput {
  code?: string;
  rule_code?: string;
  category?: string;
  title?: string;
  description?: string;
  [key: string]: unknown;
}

export interface TermInput {
  avoid?: string;
  avoid_text?: string;
  term?: string;
  preferred?: string;
  preferred_text?: string;
  replacement?: string;
  [key: string]: unknown;
}

export interface RuleChecksOptions {
  rules?: RuleInput[];
  terms?: TermInput[];
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function preserveCase(original: string, replacement: string): string {
  if (!original || !replacement) return replacement;
  if (original === original.toUpperCase() && original !== original.toLowerCase()) {
    return replacement.toUpperCase();
  }
  if (original[0] === original[0].toUpperCase() && original[0] !== original[0].toLowerCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

export function ruleChecks(
  text: string,
  { rules = [], terms = [] }: RuleChecksOptions = {},
): Finding[] {
  if (!text) {
    return [];
  }

  const findings: Finding[] = [];

  // 1. Terminology: find avoid text in content (case insensitive, whole word)
  for (const term of terms) {
    const avoidRaw = (term.avoid || term.term || term.avoid_text || '').trim();
    const preferred = (
      term.preferred ||
      term.replacement ||
      term.preferred_text ||
      ''
    ).trim();

    if (!avoidRaw) continue;

    const avoidPhrases = avoidRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    for (const avoid of avoidPhrases) {
      const escaped = escapeRegex(avoid);
      const leftBoundary = /^\w/.test(avoid) ? '\\b' : '(?:^|(?<=\\W))';
      const rightBoundary = /\w$/.test(avoid) ? '\\b' : '(?:$|(?=\\W))';
      const regex = new RegExp(`${leftBoundary}${escaped}${rightBoundary}`, 'gi');

      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        const quoted = match[0];
        // If the matched text is already identical to the preferred wording, skip
        if (preferred && quoted === preferred) {
          continue;
        }
        findings.push({
          category: 'terminology',
          severity: 'medium',
          quoted_text: quoted,
          explanation: preferred
            ? `Use preferred term "${preferred}" instead of "${quoted}".`
            : `Avoid using "${quoted}".`,
          rule_code: 'TERM',
          suggestion: preferred ? preserveCase(quoted, preferred) : '',
          confidence: 1,
          source: 'rule_check',
        });
      }
    }
  }

  // 2. Absolute claims: phrases best, world's best, number one, #1, guaranteed, 100%, never fails, miracle
  const claimsRule = rules.find(
    (r) => (r.category ?? '').toLowerCase() === 'claims',
  );
  const claimsRuleCode = claimsRule?.code || claimsRule?.rule_code || 'CLAIMS';

  const claimPatterns: Array<{ pattern: RegExp; suggestion: string }> = [
    { pattern: /\bworld['’]s\s+best\b/gi, suggestion: 'industry-leading' },
    { pattern: /\bnever\s+fails\b/gi, suggestion: 'is highly dependable' },
    { pattern: /\bnumber\s+one\b/gi, suggestion: 'leading' },
    { pattern: /(?:^|(?<=\W))#1\b/gi, suggestion: 'top-rated' },
    { pattern: /\b100%/gi, suggestion: 'consistently' },
    { pattern: /\bguaranteed\b/gi, suggestion: 'designed to provide' },
    { pattern: /\bmiracle\b/gi, suggestion: 'breakthrough' },
    { pattern: /\bbest\b/gi, suggestion: 'leading' },
  ];

  const claimSpans: Array<[number, number]> = [];

  for (const { pattern, suggestion } of claimPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;

      // Prevent smaller claim sub-phrases inside already-matched claims (e.g. 'best' within "world's best")
      const alreadyCovered = claimSpans.some(
        ([s, e]) => start >= s && end <= e,
      );
      if (alreadyCovered) {
        continue;
      }

      claimSpans.push([start, end]);
      const quoted = match[0];

      findings.push({
        category: 'claims',
        severity: 'high',
        quoted_text: quoted,
        explanation: `Avoid absolute claims like "${quoted}"; use softer, substantiated language.`,
        rule_code: claimsRuleCode,
        suggestion: preserveCase(quoted, suggestion),
        confidence: 0.9,
        source: 'rule_check',
      });
    }
  }

  // 3. Shouting: words of 4+ letters in ALL CAPS, or more than one exclamation mark
  const shoutingRule = rules.find(
    (r) =>
      (r.category ?? '').toLowerCase() === 'tone' &&
      ((r.title ?? '').toLowerCase().includes('shout') ||
        (r.description ?? '').toLowerCase().includes('shout')),
  );
  const shoutingRuleCode =
    shoutingRule?.code || shoutingRule?.rule_code || 'TONE';

  // Words of 4 or more letters in ALL CAPS
  const allCapsRegex = /\b[A-Z]{4,}\b/g;
  let capsMatch: RegExpExecArray | null;
  while ((capsMatch = allCapsRegex.exec(text)) !== null) {
    const quoted = capsMatch[0];
    const softer =
      quoted.charAt(0).toUpperCase() + quoted.slice(1).toLowerCase();

    findings.push({
      category: 'tone',
      severity: 'low',
      quoted_text: quoted,
      explanation: `Avoid shouting in ALL CAPS like "${quoted}"; use standard sentence capitalization.`,
      rule_code: shoutingRuleCode,
      suggestion: softer,
      confidence: 0.9,
      source: 'rule_check',
    });
  }

  // More than one exclamation mark
  const exclamationsRegex = /!(?:[\t ]*!)+/g;
  let exMatch: RegExpExecArray | null;
  while ((exMatch = exclamationsRegex.exec(text)) !== null) {
    const quoted = exMatch[0];

    findings.push({
      category: 'tone',
      severity: 'low',
      quoted_text: quoted,
      explanation: `Avoid excessive exclamation marks ("${quoted}"); use a single exclamation mark or period.`,
      rule_code: shoutingRuleCode,
      suggestion: '!',
      confidence: 0.9,
      source: 'rule_check',
    });
  }

  // Deduplication: ensure quoted_text is exact substring & dedupe by quoted_text + rule_code
  const seen = new Set<string>();
  const uniqueFindings: Finding[] = [];

  for (const finding of findings) {
    if (!text.includes(finding.quoted_text)) {
      continue;
    }
    const key = `${finding.quoted_text}::${finding.rule_code}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueFindings.push(finding);
    }
  }

  return uniqueFindings;
}
