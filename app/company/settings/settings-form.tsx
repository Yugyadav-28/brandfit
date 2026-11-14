"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { updateCompanyNameAction } from "@/app/actions/company";
import { CheckCircle2, AlertCircle, Building2 } from "lucide-react";

interface SettingsFormProps {
  companyId: string;
  initialName: string;
}

export function SettingsForm({ companyId, initialName }: SettingsFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [currentName, setCurrentName] = useState(initialName);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const trimmed = name.trim();

    if (trimmed.length < 2 || trimmed.length > 60) {
      setError("Company name must be between 2 and 60 characters.");
      return;
    }

    startTransition(async () => {
      const res = await updateCompanyNameAction(companyId, trimmed);

      if (res.error) {
        setError(res.error);
      } else {
        const updatedName = res.newName || trimmed;
        setCurrentName(updatedName);
        setName(updatedName);
        setSuccessMessage(`Company name updated to "${updatedName}" successfully.`);
        router.refresh();
      }
    });
  };

  return (
    <div className="flex-1 max-w-2xl mx-auto w-full p-6 md:p-10 space-y-8">
      {/* Page Title & One-sentence guidance */}
      <div className="space-y-1 pb-4 border-b">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Building2 className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Company Settings</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your company name and workspace configuration.
            </p>
          </div>
        </div>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div
          role="status"
          className="flex items-center gap-2 p-4 rounded-lg bg-green-500/10 border border-green-500/30 text-green-700 dark:text-green-400 text-sm"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm"
        >
          <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* Settings Form Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">General Information</CardTitle>
          <CardDescription>
            Update the display name of your organization. This name appears across all navigation, submissions, and brand reviews.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="company-name" className="text-sm font-medium">
                  Company name
                </Label>
                <span className="text-xs text-muted-foreground">
                  {name.trim().length}/60 characters
                </span>
              </div>
              <Input
                id="company-name"
                name="name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="e.g. FreshBrew Coffee"
                required
                minLength={2}
                maxLength={60}
                className="focus-visible:ring-2 focus-visible:ring-ring"
                aria-describedby="company-name-help"
              />
              <p id="company-name-help" className="text-xs text-muted-foreground">
                Must be between 2 and 60 characters.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="submit"
                disabled={isPending || name.trim().length < 2 || name.trim().length > 60 || name.trim() === currentName}
              >
                {isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
