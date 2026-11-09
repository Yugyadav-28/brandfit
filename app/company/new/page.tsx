import { requireUser } from "@/lib/auth";
import { CompanyNewForm } from "./company-new-form";
import { Suspense } from "react";

export const metadata = {
  title: "Create a company - BrandFit",
  description: "Create a new company brand workspace",
};

async function CompanyNewContent() {
  await requireUser();
  return <CompanyNewForm />;
}

export default function CompanyNewPage() {
  return (
    <div className="flex-1 flex items-center justify-center p-6 md:p-10">
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading form...</div>}>
        <CompanyNewContent />
      </Suspense>
    </div>
  );
}
