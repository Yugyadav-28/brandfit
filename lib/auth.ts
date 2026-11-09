import 'server-only';
import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Role } from '@/lib/types';

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export interface MemberContext {
  user: User;
  role: Role;
  companyId: string;
}

export interface UserCompanyMembership {
  companyId: string;
  company_id: string;
  role: Role;
  displayName: string;
  display_name: string;
  name: string;
}

export async function requireUser(): Promise<User> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/auth/login');
  }

  return user;
}

export async function requireMember(
  companyId: string,
  allowedRoles?: Role[] | Role,
): Promise<MemberContext> {
  const user = await requireUser();
  const admin = createAdminClient();

  const { data: membership, error } = await admin
    .from('memberships')
    .select('role, company_id, user_id')
    .eq('company_id', companyId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !membership) {
    throw new ForbiddenError(
      `Forbidden: You are not a member of company ${companyId}`,
    );
  }

  const role = membership.role as Role;

  if (allowedRoles) {
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    if (roles.length > 0 && !roles.includes(role)) {
      throw new ForbiddenError(
        `Forbidden: Role '${role}' is not authorized. Allowed: ${roles.join(', ')}`,
      );
    }
  }

  return {
    user,
    role,
    companyId,
  };
}

export async function getMyMemberships(): Promise<UserCompanyMembership[]> {
  const user = await requireUser();
  const admin = createAdminClient();

  const { data: memberships, error } = await admin
    .from('memberships')
    .select('company_id, role')
    .eq('user_id', user.id);

  if (error) {
    console.error('Failed to get user memberships:', error);
    throw new Error('Failed to get memberships');
  }

  if (!memberships || memberships.length === 0) {
    return [];
  }

  const companyIds = memberships.map((m) => m.company_id);
  const { data: companies, error: companiesError } = await admin
    .from('companies')
    .select('*')
    .in('id', companyIds);

  if (companiesError) {
    console.error('Failed to get companies for memberships:', companiesError);
  }

  const companyMap = new Map(
    (companies ?? []).map((c: { id: string; [key: string]: unknown }) => [c.id, c]),
  );

  return memberships.map((m) => {
    const comp = companyMap.get(m.company_id) as Record<string, unknown> | undefined;
    const displayName = String(
      comp?.display_name || comp?.name || comp?.title || m.company_id,
    );
    return {
      companyId: m.company_id,
      company_id: m.company_id,
      role: m.role as Role,
      displayName,
      display_name: displayName,
      name: typeof comp?.name === 'string' ? comp.name : displayName,
    };
  });
}
