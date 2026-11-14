"use server";

import crypto from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser, requireMember } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

const JOIN_CODE_CHARS = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function generateJoinCode(): string {
  const bytes = crypto.randomBytes(6);
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += JOIN_CODE_CHARS[bytes[i] % JOIN_CODE_CHARS.length];
  }
  return code;
}

export type ActionState = {
  error?: string;
};

export async function createCompanyAction(
  _prevState: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const name = formData.get("name") as string | null;

  if (!name || !name.trim()) {
    return { error: "Please enter a company name." };
  }

  const admin = createAdminClient();
  let joinCode = generateJoinCode();
  let attempts = 0;

  while (attempts < 5) {
    const { data: existing } = await admin
      .from("companies")
      .select("id")
      .ilike("join_code", joinCode)
      .maybeSingle();

    if (!existing) break;
    joinCode = generateJoinCode();
    attempts++;
  }

  const { data: company, error: companyError } = await admin
    .from("companies")
    .insert({
      name: name.trim(),
      join_code: joinCode,
      owner_id: user.id,
    })
    .select("id, name, join_code")
    .single();

  if (companyError || !company) {
    console.error("Failed to create company:", companyError);
    return { error: "Unable to create your company workspace. Please try again." };
  }

  const { error: memberError } = await admin.from("memberships").insert({
    company_id: company.id,
    user_id: user.id,
    role: "employer",
    display_name: user.email || "Employer",
  });

  if (memberError) {
    console.error("Failed to add employer membership:", memberError);
    return { error: "The company was created, but we couldn't assign your account as the employer. Please try refreshing." };
  }

  await logAudit({
    companyId: company.id,
    userId: user.id,
    action: "company_created",
    detail: {
      company_name: company.name,
      join_code: company.join_code,
    },
  });

  redirect("/dashboard");
}

export async function joinCompanyAction(
  _prevState: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const joinCode = formData.get("joinCode") as string | null;
  const displayName = formData.get("displayName") as string | null;

  if (!joinCode || !joinCode.trim()) {
    return { error: "Please enter a join code." };
  }

  if (!displayName || !displayName.trim()) {
    return { error: "Please enter your display name." };
  }

  const admin = createAdminClient();
  const { data: company, error: findError } = await admin
    .from("companies")
    .select("id, name, join_code")
    .ilike("join_code", joinCode.trim())
    .maybeSingle();

  if (findError) {
    console.error("Error looking up company:", findError);
    return { error: "We couldn't check that join code right now. Please try again in a moment." };
  }

  if (!company) {
    return { error: "We couldn't find a company with that join code. Please check the 6 characters and try again." };
  }

  const { data: existingMember } = await admin
    .from("memberships")
    .select("role")
    .eq("company_id", company.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existingMember) {
    const { error: memberError } = await admin.from("memberships").insert({
      company_id: company.id,
      user_id: user.id,
      role: "employee",
      display_name: displayName.trim(),
    });

    if (memberError) {
      console.error("Error creating membership:", memberError);
      return { error: "Unable to join the company right now. Please try again." };
    }

    await logAudit({
      companyId: company.id,
      userId: user.id,
      action: "member_joined",
      detail: {
        display_name: displayName.trim(),
        role: "employee",
      },
    });
  }

  redirect("/my");
}

export async function updateCompanyNameAction(
  companyId: string,
  newName: string,
): Promise<{ success?: boolean; error?: string; newName?: string }> {
  const member = await requireMember(companyId, "employer");
  const trimmed = (newName || "").trim();

  if (trimmed.length < 2 || trimmed.length > 60) {
    return { error: "Company name must be between 2 and 60 characters." };
  }

  const admin = createAdminClient();

  const { data: currentCompany, error: fetchErr } = await admin
    .from("companies")
    .select("name")
    .eq("id", companyId)
    .single();

  if (fetchErr || !currentCompany) {
    return { error: "Company not found." };
  }

  const oldName = currentCompany.name;

  if (oldName === trimmed) {
    return { success: true, newName: trimmed };
  }

  const { error: updateErr } = await admin
    .from("companies")
    .update({ name: trimmed })
    .eq("id", companyId);

  if (updateErr) {
    console.error("Failed to update company name:", updateErr);
    return { error: "Unable to update company name right now. Please try again." };
  }

  await logAudit({
    companyId,
    userId: member.user.id,
    action: "company_renamed",
    detail: {
      old_name: oldName,
      new_name: trimmed,
    },
  });

  revalidatePath("/company/settings");
  revalidatePath("/dashboard");
  revalidatePath("/");
  return { success: true, newName: trimmed };
}
