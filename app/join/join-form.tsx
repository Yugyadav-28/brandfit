"use client";

import { useActionState } from "react";
import { joinCompanyAction, type ActionState } from "@/app/actions/company";
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

interface JoinFormProps {
  initialCode?: string;
  defaultDisplayName?: string;
}

export function JoinForm({ initialCode = "", defaultDisplayName = "" }: JoinFormProps) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    joinCompanyAction,
    {},
  );

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl">Join a company</CardTitle>
        <CardDescription>
          Enter the 6-character join code provided by your employer to join their brand workspace.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-6">
          <div className="grid gap-2">
            <Label htmlFor="joinCode">Join code</Label>
            <Input
              id="joinCode"
              name="joinCode"
              type="text"
              placeholder="e.g. 7K4MNP"
              defaultValue={initialCode}
              required
              autoFocus={!initialCode}
              className="uppercase tracking-widest font-mono focus-visible:ring-2 focus-visible:ring-ring"
              aria-describedby={state?.error ? "join-error" : undefined}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="displayName">Your display name</Label>
            <Input
              id="displayName"
              name="displayName"
              type="text"
              placeholder="e.g. Alex Smith"
              defaultValue={defaultDisplayName}
              required
              autoFocus={!!initialCode}
              className="focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {state?.error && (
            <div
              id="join-error"
              role="alert"
              className="flex items-center gap-2 text-sm font-medium text-destructive bg-destructive/10 p-3 rounded-md border border-destructive/20"
            >
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{state.error}</span>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Joining company..." : "Join company"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
