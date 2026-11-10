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
import { AlertCircle } from "lucide-react";

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
          Enter your company name to start a new brand workspace and invite your team.
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
              className="focus-visible:ring-2 focus-visible:ring-ring"
              aria-describedby={state?.error ? "name-error" : undefined}
            />
          </div>

          {state?.error && (
            <div
              id="name-error"
              role="alert"
              className="flex items-center gap-2 text-sm font-medium text-destructive bg-destructive/10 p-3 rounded-md border border-destructive/20"
            >
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{state.error}</span>
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
