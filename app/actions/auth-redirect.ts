"use server";

import { getMyMemberships, requireUser } from "@/lib/auth";

export async function getPostLoginRedirect(): Promise<string> {
  try {
    await requireUser();
    const memberships = await getMyMemberships();

    if (!memberships || memberships.length === 0) {
      return "/home-start";
    }

    if (memberships.some((m) => m.role === "employer")) {
      return "/dashboard";
    }

    if (memberships.some((m) => m.role === "reviewer")) {
      return "/review";
    }

    if (memberships.some((m) => m.role === "employee")) {
      return "/my";
    }

    return "/home-start";
  } catch {
    return "/home-start";
  }
}
