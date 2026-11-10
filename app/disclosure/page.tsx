import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AiBadge } from "@/components/ai-badge";
import {
  Cpu,
  Send,
  Sparkles,
  Users,
  Database,
  AlertTriangle,
} from "lucide-react";

export const metadata = {
  title: "How BrandFit uses AI - Disclosure",
  description: "Transparency and governance disclosure on how BrandFit uses artificial intelligence",
};

export default function DisclosurePage() {
  const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  return (
    <div className="flex-1 max-w-4xl mx-auto w-full p-6 md:p-10 space-y-8">
      {/* Page Header */}
      <div className="space-y-3 pb-4 border-b">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            How BrandFit uses AI
          </h1>
          <AiBadge />
        </div>
        <p className="text-muted-foreground text-base leading-relaxed">
          Read how BrandFit uses the Google Gemini API to check content, what data is processed, and how humans keep control.
        </p>
      </div>

      {/* Sections Grid */}
      <div className="grid gap-6">
        {/* 1. Which AI service is used */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Cpu className="h-5 w-5" />
            </div>
            <CardTitle className="text-xl">Which AI service is used</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-relaxed text-muted-foreground space-y-2">
            <p>
              BrandFit connects to the <strong className="text-foreground">Google Gemini API</strong>.
            </p>
            <p>
              Active AI model:{" "}
              <code className="font-mono text-xs px-2 py-1 rounded bg-muted text-foreground border font-semibold">
                {geminiModel}
              </code>
            </p>
          </CardContent>
        </Card>

        {/* 2. What data is sent */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Send className="h-5 w-5" />
            </div>
            <CardTitle className="text-xl">What data is sent</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-relaxed text-muted-foreground">
            <p>
              Only the submitted text and the company&apos;s rule and fact text are
              sent to the AI model for checking. We never send passwords, user
              emails, personal identifying credentials, or another company&apos;s data.
            </p>
          </CardContent>
        </Card>

        {/* 3. What the AI does */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <CardTitle className="text-xl">What the AI does</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-relaxed text-muted-foreground">
            <p>
              The AI reviews submitted copy against your brand guidelines to suggest
              helpful findings and rewrites. It never approves, publishes, or changes
              content by itself.
            </p>
          </CardContent>
        </Card>

        {/* 4. Human control */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <CardTitle className="text-xl">Human control</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-relaxed text-muted-foreground">
            <p>
              Humans maintain full authority over all content. Creators decide
              whether to accept, edit, or reject any AI suggestions, and human
              reviewers make all final approval or change request decisions.
            </p>
          </CardContent>
        </Card>

        {/* 5. Where data is stored */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Database className="h-5 w-5" />
            </div>
            <CardTitle className="text-xl">Where data is stored</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-relaxed text-muted-foreground">
            <p>
              All submissions, brand rules, facts, terminology, and audit logs are
              stored in a <strong className="text-foreground">Supabase database</strong>,
              strictly separated and isolated by company workspace.
            </p>
          </CardContent>
        </Card>

        {/* 6. Limits */}
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-3">
            <div className="p-2 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <CardTitle className="text-xl text-amber-900 dark:text-amber-200">
              Limits &amp; Demo Guidance
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-relaxed text-muted-foreground space-y-2">
            <p>
              The AI can miss issues or flag wrong ones. Always review suggestions
              carefully before making changes.
            </p>
            <p>
              Requests on the provider&apos;s free tier may be used to improve its
              products, so only fictional or non-confidential content should be used
              in this demo.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
