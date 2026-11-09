"use client";

import { useActionState } from "react";
import { createCompanyAction, type ActionState } from "@/app/actions/company";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function CompanyNewForm() {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    createCompanyAction,
    {},
  );

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl">Create a company</CardTitle>
        <CardDescription>
          Start a new workspace for your organization. You will be set up as the
          company employer.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-6">
          <div className="grid gap-2">
            <Label htmlFor="name">Company name</Label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="e.g. FreshBrew Coffee"
              required
              autoFocus
              aria-describedby={state?.error ? "name-error" : undefined}
            />
          </div>

          {state?.error && (
            <div
              id="name-error"
              role="alert"
              className="text-sm font-medium text-destructive bg-destructive/10 p-3 rounded-md border border-destructive/20"
            >
              {state.error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Creating company..." : "Create company"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
