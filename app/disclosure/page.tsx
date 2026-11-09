import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Sparkles, ShieldCheck, Scale } from "lucide-react";

export const metadata = {
  title: "AI Disclosure - BrandFit",
  description: "How BrandFit uses artificial intelligence and governance principles",
};

export default function DisclosurePage() {
  return (
    <div className="flex-1 max-w-4xl mx-auto w-full p-6 md:p-10 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">AI Disclosure &amp; Governance</h1>
        <p className="text-muted-foreground">
          BrandFit is built with transparency and human-in-the-loop governance at its foundation.
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <div className="p-2 rounded-md bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">AI Only Suggests</CardTitle>
              <CardDescription>
                Automated models never modify or approve your content independently
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground leading-relaxed">
            The AI engine inspects submitted content strictly against your company&apos;s
            configured brand rules, approved facts, and terminology. Any identified issues are
            presented as recommendations with citations back to approved brand guidelines.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <div className="p-2 rounded-md bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Data Isolation &amp; Privacy</CardTitle>
              <CardDescription>
                Company guidelines and submissions remain private
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground leading-relaxed">
            All submitted content is treated strictly as data and never as instructions. Every
            request is isolated by company workspace, and queries are verified server-side with
            strict row-level controls.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <div className="p-2 rounded-md bg-primary/10 text-primary">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Human Authority</CardTitle>
              <CardDescription>
                Final review and decision-making rests with your team
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground leading-relaxed">
            Content creators can review, accept, or reject AI suggestions before submitting.
            Company reviewers and employers make all final approval or change request
            decisions, recorded in an immutable audit log.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
