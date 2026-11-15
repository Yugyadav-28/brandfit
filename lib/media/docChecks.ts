export type FindingSource = "rule_check" | "ai" | "image_check" | "doc_check";

export interface Finding {
  category:
    | "tone"
    | "terminology"
    | "claims"
    | "facts"
    | "visual"
    | "accessibility";
  severity: "low" | "medium" | "high";
  quoted_text: string;
  explanation: string;
  rule_code: string;
  suggestion: string;
  confidence: number;
  source: FindingSource;
}

export interface DocumentAccessibility {
  imageCount: number;
  imagesWithoutAlt: number;
  hasHeadings: boolean;
  wordCount: number;
  hasReadableText: boolean;
}

export interface RuleItem {
  code: string;
  category?: string;
  title?: string;
  body?: string;
  [key: string]: unknown;
}

/**
 * Runs automated accessibility checks on an uploaded document.
 * Returns findings with source 'doc_check':
 * 1. One finding per image without alt text (quoted_text like "Image 2", severity medium).
 * 2. A finding when wordCount > 300 and hasHeadings is false (severity low).
 * 3. A finding when hasReadableText is false (severity high, quoted_text the file name).
 *
 * Citing logic:
 * - For images: the alt text rule for images; otherwise first accessibility rule; otherwise ACCESSIBILITY.
 * - For document structure / readability: A-4 or a rule that mentions documents or headings;
 *   otherwise first accessibility rule; otherwise ACCESSIBILITY.
 *
 * Plain language explanations. Never throws.
 */
export function docChecks(
  accessibility: DocumentAccessibility,
  fileName: string,
  rules: RuleItem[] = [],
): Finding[] {
  const findings: Finding[] = [];

  try {
    if (!accessibility) {
      return findings;
    }

    const safeRules = Array.isArray(rules) ? rules : [];
    const accessRules = safeRules.filter(
      (r) => (r?.category || "").toLowerCase() === "accessibility",
    );

    // Rule code for images without alt text:
    // Look for alt text rule (A-1 or rule mentioning alt/alt text/image)
    let altRuleCode = "ACCESSIBILITY";
    const altRule = accessRules.find(
      (r) =>
        r?.code?.toUpperCase() === "A-1" ||
        /alt\s*text|\balt\b/i.test(r?.title || "") ||
        /alt\s*text|\balt\b/i.test(r?.body || ""),
    );
    if (altRule?.code) {
      altRuleCode = altRule.code;
    } else if (accessRules[0]?.code) {
      altRuleCode = accessRules[0].code;
    }

    // Rule code for headings and readable text:
    // Look for A-4 or a rule that mentions documents or headings
    let docRuleCode = "ACCESSIBILITY";
    const docRule = accessRules.find(
      (r) =>
        r?.code?.toUpperCase() === "A-4" ||
        /heading|document/i.test(r?.title || "") ||
        /heading|document/i.test(r?.body || ""),
    );
    if (docRule?.code) {
      docRuleCode = docRule.code;
    } else if (accessRules[0]?.code) {
      docRuleCode = accessRules[0].code;
    }

    // Check 1: One finding per image without alt text
    const missingAltCount = Math.max(0, accessibility.imagesWithoutAlt || 0);
    for (let i = 1; i <= missingAltCount; i++) {
      findings.push({
        category: "accessibility",
        severity: "medium",
        quoted_text: `Image ${i}`,
        explanation: `Image ${i} is missing descriptive alt text. Every image must describe what is shown so people using screen readers can understand it.`,
        rule_code: altRuleCode,
        suggestion: "Add alt text that describes the image",
        confidence: 1.0,
        source: "doc_check" as const,
      });
    }

    // Check 2: Document longer than 300 words without headings
    if ((accessibility.wordCount || 0) > 300 && !accessibility.hasHeadings) {
      findings.push({
        category: "accessibility",
        severity: "low",
        quoted_text: fileName || "Document headings",
        explanation: `This document contains ${accessibility.wordCount} words but has no headings. Documents longer than 300 words need headings to help readers navigate sections.`,
        rule_code: docRuleCode,
        suggestion: "Add headings to organize the document into clear sections",
        confidence: 1.0,
        source: "doc_check" as const,
      });
    }

    // Check 3: Document has little or no readable text
    if (!accessibility.hasReadableText) {
      findings.push({
        category: "accessibility",
        severity: "high",
        quoted_text: fileName || "Document text",
        explanation: "This document contains little or no readable text and may consist only of scanned pictures. Pages must contain real selectable text that screen readers can read.",
        rule_code: docRuleCode,
        suggestion: "Ensure the document contains real selectable text rather than only scanned pictures",
        confidence: 1.0,
        source: "doc_check" as const,
      });
    }
  } catch (err) {
    console.error("docChecks error:", err);
  }

  return findings;
}
