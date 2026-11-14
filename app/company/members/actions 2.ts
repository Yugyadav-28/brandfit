"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import {
  switchMemberRoleAction,
  removeMemberAction,
  regenerateJoinCodeAction,
} from "@/app/actions/members";

export { switchMemberRoleAction, removeMemberAction, regenerateJoinCodeAction };

export async function setMemberRoleAction(
  companyId: string,
  targetUserId: string,
  newRole: "employee" | "reviewer" | "authorised_reviewer",
) {
  const actor = await requireMember(companyId, "employer");
  const admin = createAdminClient();

  // Find company to check owner
  const { data: company, error: compErr } = await admin
    .from("companies")
    .select("owner_id")
    .eq("id", companyId)
    .single();

  if (compErr || !company) {
    return { error: "We couldn't find this company workspace." };
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
    return { error: "We couldn't find this member in your company." };
  }

  if (targetMember.role === "employer") {
    return { error: "Employer roles cannot be changed." };
  }

  const { error: updateErr } = await admin
    .from("memberships")
    .update({ role: newRole })
    .eq("company_id", companyId)
    .eq("user_id", targetUserId);

  if (updateErr) {
    console.error("Failed to update role:", updateErr);
    return { error: "Unable to update member role right now. Please try again." };
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
