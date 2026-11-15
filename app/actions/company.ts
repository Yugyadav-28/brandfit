"use server";

import crypto from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
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
  fieldErrors?: Record<string, string>;
};

const CreateCompanySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Company name must be between 2 and 60 characters.")
    .max(60, "Company name must be between 2 and 60 characters."),
});

const JoinCompanySchema = z.object({
  joinCode: z
    .string()
    .trim()
    .length(6, "Join code must be exactly 6 characters.")
    .regex(/^[0-9A-Za-z]{6}$/, "Join code must be 6 letters or numbers."),
  displayName: z
    .string()
    .trim()
    .min(1, "Please enter your display name.")
    .max(60, "Display name must be 60 characters or fewer."),
});

const UpdateCompanyNameSchema = z.object({
  companyId: z.string().min(1, "Company ID is required."),
  newName: z
    .string()
    .trim()
    .min(2, "Company name must be between 2 and 60 characters.")
    .max(60, "Company name must be between 2 and 60 characters."),
});

export async function createCompanyAction(
  _prevState: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const rawName = formData.get("name");

  const validated = CreateCompanySchema.safeParse({ name: rawName });
  if (!validated.success) {
    const issue = validated.error.issues[0];
    return {
      error: issue?.message || "Invalid company name.",
      fieldErrors: { name: issue?.message || "Invalid company name." },
    };
  }

  const name = validated.data.name;

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
      name,
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
  const rawJoinCode = formData.get("joinCode");
  const rawDisplayName = formData.get("displayName");

  const validated = JoinCompanySchema.safeParse({
    joinCode: rawJoinCode,
    displayName: rawDisplayName,
  });

  if (!validated.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of validated.error.issues) {
      const field = issue.path[0] as string;
      if (!fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return {
      error: validated.error.issues[0]?.message || "Invalid input.",
      fieldErrors,
    };
  }

  const { joinCode, displayName } = validated.data;

  const admin = createAdminClient();
  const { data: company, error: findError } = await admin
    .from("companies")
    .select("id, name, join_code")
    .ilike("join_code", joinCode)
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
      display_name: displayName,
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
        display_name: displayName,
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
  const validated = UpdateCompanyNameSchema.safeParse({ companyId, newName });
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || "Invalid company name." };
  }

  const member = await requireMember(companyId, "employer");
  const trimmed = validated.data.newName;

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
