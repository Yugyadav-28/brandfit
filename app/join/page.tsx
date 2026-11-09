import { requireUser } from "@/lib/auth";
import { JoinForm } from "./join-form";
import { Suspense } from "react";

export const metadata = {
  title: "Join a company - BrandFit",
  description: "Join an existing brand workspace using a join code",
};

interface JoinPageProps {
  searchParams: Promise<{ code?: string }>;
}

async function JoinContent({ searchParams }: JoinPageProps) {
  const user = await requireUser();
  const { code } = await searchParams;
  const defaultDisplayName = user.email ? user.email.split("@")[0] : "";

  return <JoinForm initialCode={code || ""} defaultDisplayName={defaultDisplayName} />;
}

export default function JoinPage(props: JoinPageProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-6 md:p-10">
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading form...</div>}>
        <JoinContent searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
