import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import type { AuditAction } from '@/lib/types';

export interface LogAuditParams {
  companyId: string;
  userId: string;
  action: AuditAction | string;
  detail?: Record<string, unknown> | unknown;
}

export async function logAudit({
  companyId,
  userId,
  action,
  detail,
}: LogAuditParams): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from('audit_log').insert({
      company_id: companyId,
      user_id: userId,
      action,
      detail: detail ?? {},
    });

    if (error) {
      console.error('Failed to insert into audit_log:', error);
    }
  } catch (error) {
    console.error('Unexpected error logging audit:', error);
  }
}
