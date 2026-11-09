"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import type { Role } from "@/lib/types";

const JOIN_CODE_CHARS = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function generateJoinCode(): string {
  const bytes = crypto.randomBytes(6);
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += JOIN_CODE_CHARS[bytes[i] % JOIN_CODE_CHARS.length];
  }
  return code;
}

export interface ActionResult {
  success?: boolean;
  error?: string;
  newCode?: string;
}

// 1. Switch Role between employee and reviewer
export async function switchMemberRoleAction(
  companyId: string,
  targetUserId: string,
): Promise<ActionResult> {
  const actor = await requireMember(companyId, "employer");
  const admin = createAdminClient();

  // Find company to check owner
  const { data: company, error: compErr } = await admin
    .from("companies")
    .select("owner_id")
    .eq("id", companyId)
    .single();

  if (compErr || !company) {
    return { error: "Company not found." };
  }

  if (targetUserId === company.owner_id) {
    return { error: "The company owner's role cannot be changed." };
  }

  // Find target member
  const { data: targetMember, error: memErr } = await admin
    .from("memberships")
    .select("user_id, role, display_name")
    .eq("company_id", companyId)
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (memErr || !targetMember) {
    return { error: "Member not found in this company." };
  }

  if (targetMember.role === "employer") {
    return { error: "Employer roles cannot be switched." };
  }

  const newRole: Role = targetMember.role === "employee" ? "reviewer" : "employee";

  const { error: updateErr } = await admin
    .from("memberships")
    .update({ role: newRole })
    .eq("company_id", companyId)
    .eq("user_id", targetUserId);

  if (updateErr) {
    console.error("Failed to update role:", updateErr);
    return { error: "Failed to update role. Please try again." };
  }

  await logAudit({
    companyId,
    userId: actor.user.id,
    action: "role_changed",
    detail: {
      target_user_id: targetUserId,
      display_name: targetMember.display_name,
      old_role: targetMember.role,
      new_role: newRole,
    },
  });

  revalidatePath("/company/members");
  return { success: true };
}

// 2. Remove Member (never the owner)
export async function removeMemberAction(
  companyId: string,
  targetUserId: string,
): Promise<ActionResult> {
  const actor = await requireMember(companyId, "employer");
  const admin = createAdminClient();

  // Check company owner
  const { data: company, error: compErr } = await admin
    .from("companies")
    .select("owner_id")
    .eq("id", companyId)
    .single();

  if (compErr || !company) {
    return { error: "Company not found." };
  }

  if (targetUserId === company.owner_id) {
    return { error: "The company owner cannot be removed." };
  }

  // Get member details for audit log
  const { data: targetMember } = await admin
    .from("memberships")
    .select("display_name, role")
    .eq("company_id", companyId)
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (!targetMember) {
    return { error: "Member not found." };
  }

  if (targetMember.role === "employer") {
    return { error: "Employers cannot be removed." };
  }

  const { error: delErr } = await admin
    .from("memberships")
    .delete()
    .eq("company_id", companyId)
    .eq("user_id", targetUserId);

  if (delErr) {
    console.error("Failed to remove member:", delErr);
    return { error: "Failed to remove member. Please try again." };
  }

  await logAudit({
    companyId,
    userId: actor.user.id,
    action: "member_removed",
    detail: {
      target_user_id: targetUserId,
      display_name: targetMember.display_name,
      role: targetMember.role,
    },
  });

  revalidatePath("/company/members");
  return { success: true };
}

// 3. Regenerate Join Code
export async function regenerateJoinCodeAction(
  companyId: string,
): Promise<ActionResult> {
  await requireMember(companyId, "employer");
  const admin = createAdminClient();

  let newCode = generateJoinCode();
  let attempts = 0;

  while (attempts < 5) {
    const { data: existing } = await admin
      .from("companies")
      .select("id")
      .ilike("join_code", newCode)
      .maybeSingle();

    if (!existing) break;
    newCode = generateJoinCode();
    attempts++;
  }

  const { error: updateErr } = await admin
    .from("companies")
    .update({ join_code: newCode })
    .eq("id", companyId);

  if (updateErr) {
    console.error("Failed to regenerate code:", updateErr);
    return { error: "Failed to regenerate join code. Please try again." };
  }

  revalidatePath("/company/members");
  revalidatePath("/dashboard");
  return { success: true, newCode };
}
