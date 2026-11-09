import { NextResponse, type NextRequest } from "next/server";
import { getMyMemberships, requireUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    await requireUser();
    const memberships = await getMyMemberships();

    let destination = "/home-start";
    if (memberships && memberships.length > 0) {
      if (memberships.some((m) => m.role === "employer")) {
        destination = "/dashboard";
      } else if (memberships.some((m) => m.role === "reviewer")) {
        destination = "/review";
      } else if (memberships.some((m) => m.role === "employee")) {
        destination = "/my";
      }
    }

    return NextResponse.redirect(new URL(destination, request.url));
  } catch {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }
}
