export const SAFE_SUGGESTION_FALLBACK =
  'Remove this wording, or support it with an approved fact.';

const FORBIDDEN_WORDS_REGEX =
  /\b(?:best|leading|top|number\s+one|guaranteed|ultimate|unmatched|revolutionary|proven|perfect|always|never)\b|(?<=^|\W)(?:#1|100\s*%)(?!\w)/i;

/**
 * Checks a suggestion against forbidden claim / superlative words.
 * If any forbidden word is found, replaces the suggestion with:
 * "Remove this wording, or support it with an approved fact."
 */
export function safeSuggestion(suggestion: string): string {
  if (!suggestion || typeof suggestion !== 'string') {
    return suggestion ?? '';
  }

  if (FORBIDDEN_WORDS_REGEX.test(suggestion)) {
    return SAFE_SUGGESTION_FALLBACK;
  }

  return suggestion;
}
