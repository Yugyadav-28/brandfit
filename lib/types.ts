export type Role = 'employer' | 'reviewer' | 'employee';

export type Finding = {
  category:
    | 'tone'
    | 'terminology'
    | 'claims'
    | 'facts'
    | 'visual'
    | 'accessibility';
  severity: 'low' | 'medium' | 'high';
  quoted_text: string;
  explanation: string;
  rule_code: string;
  suggestion: string;
  confidence: number;
  source: 'rule_check' | 'ai';
};

export type SubmissionStatus =
  | 'draft'
  | 'in_review'
  | 'approved'
  | 'changes_requested';

export type AuditAction =
  | 'company_created'
  | 'member_joined'
  | 'role_changed'
  | 'member_removed'
  | 'rule_saved'
  | 'rule_deleted'
  | 'fact_saved'
  | 'term_saved'
  | 'submission_created'
  | 'review_run'
  | 'finding_decided'
  | 'sent_for_review'
  | 'approved'
  | 'changes_requested'
  | 'comment_added';
