import { Suspense } from 'react';
import Link from 'next/link';
import { requireUser, getMyMemberships } from '@/lib/auth';
import { SubmitForm } from './submit-form';
import { Button } from '@/components/ui/button';

interface SubmitContentProps {
  searchParams: Promise<{ companyId?: string }>;
}

async function SubmitContent({ searchParams }: SubmitContentProps) {
  await requireUser();
  const memberships = await getMyMemberships();
  const { companyId } = await searchParams;

  if (!memberships || memberships.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-foreground mb-3">
          No Company Workspace Found
        </h1>
        <p className="text-muted-foreground text-sm mb-6">
          You must be a member of a company to submit content for brand review.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Button asChild>
            <Link href="/company/new">Create a Company</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/join">Join via Invite</Link>
          </Button>
        </div>
      </div>
    );
  }

  const companyOptions = memberships.map((m) => ({
    companyId: m.companyId,
    displayName: m.displayName || m.name || m.companyId,
  }));

  const preselected =
    companyId && companyOptions.some((c) => c.companyId === companyId)
      ? companyId
      : companyOptions[0].companyId;

  return (
    <div className="bg-card border border-border rounded-xl p-6 sm:p-8 shadow-sm">
      <SubmitForm
        companies={companyOptions}
        defaultCompanyId={preselected}
      />
    </div>
  );
}

export default function SubmitPage(props: {
  searchParams: Promise<{ companyId?: string }>;
}) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Submit Content
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Submit copy or draft posts for instant rule checks and AI brand compliance review.
        </p>
      </div>

      <Suspense
        fallback={
          <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
            Loading submission form...
          </div>
        }
      >
        <SubmitContent searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
