import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AiBadge } from "@/components/ai-badge";
import {
  Cpu,
  FileUp,
  Sparkles,
  Users,
  Database,
  AlertTriangle,
  Send,
} from "lucide-react";

export const metadata = {
  title: "How BrandFit uses AI - Disclosure",
  description: "Transparency and governance disclosure on how BrandFit uses artificial intelligence and handles data",
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
          Read how BrandFit uses Google Gemini to check content, how documents, images, and brand rules are processed, and where your data is stored.
        </p>
      </div>

      {/* Prominent Free Tier Privacy Warning */}
      <div
        role="alert"
        className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-5 text-amber-950 dark:text-amber-200 flex items-start gap-3.5 shadow-sm"
      >
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" aria-hidden="true" />
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
            Privacy Warning
          </p>
          <p className="text-base font-semibold text-amber-950 dark:text-amber-100">
            &ldquo;Only upload made-up or non-confidential material on this free tier.&rdquo;
          </p>
          <p className="text-xs text-amber-900/80 dark:text-amber-300/80 leading-relaxed">
            Requests on the provider&apos;s free tier may be used by Google to train and improve its models. Please keep all sensitive or confidential information out of free tier workspaces.
          </p>
        </div>
      </div>

      {/* Sections Grid */}
      <div className="grid gap-6">
        {/* 1. Which AI service is used */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Cpu className="h-5 w-5" aria-hidden="true" />
            </div>
            <CardTitle className="text-xl">Which AI service is used</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-relaxed text-muted-foreground space-y-2">
            <p>
              BrandFit connects to the <strong className="text-foreground">Google Gemini API</strong> for content analysis, visual review, and semantic search.
            </p>
            <p>
              Active review model:{" "}
              <code className="font-mono text-xs px-2 py-1 rounded bg-muted text-foreground border font-semibold">
                {geminiModel}
              </code>
            </p>
          </CardContent>
        </Card>

        {/* 2. Image and document review */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <FileUp className="h-5 w-5" aria-hidden="true" />
            </div>
            <CardTitle className="text-xl">Image and document review</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-relaxed text-muted-foreground space-y-2">
            <p className="font-medium text-foreground">
              Images uploaded by users and the text extracted from uploaded documents are sent to Google Gemini for review.
            </p>
            <p>
              When you submit a PDF or Word document, BrandFit reads the text from the file and submits that extracted text to Gemini to check against brand rules and accessibility guidelines. When you upload an image, the image itself is sent to Gemini to analyze visual guidelines, color palette usage, and alt text quality.
            </p>
          </CardContent>
        </Card>

        {/* 3. Embeddings and guideline search */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </div>
            <CardTitle className="text-xl">Embeddings and guideline search</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-relaxed text-muted-foreground space-y-2">
            <p className="font-medium text-foreground">
              Rule and fact text is sent to Google to generate search vectors (embeddings), which help BrandFit find relevant guidelines during reviews.
            </p>
            <p>
              Embeddings convert your organization&apos;s rules and approved facts into numerical vectors. This allows BrandFit to quickly search through large guideline libraries and retrieve only the rules that apply to what a writer is drafting.
            </p>
          </CardContent>
        </Card>

        {/* 4. What data is sent */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Send className="h-5 w-5" aria-hidden="true" />
            </div>
            <CardTitle className="text-xl">What data is sent</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-relaxed text-muted-foreground">
            <p>
              Only the submitted text, extracted document copy, uploaded images, and relevant brand guidelines are sent to the AI service. We never send passwords, personal user emails, authentication secrets, or another company&apos;s private data.
            </p>
          </CardContent>
        </Card>

        {/* 5. Where data is stored */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Database className="h-5 w-5" aria-hidden="true" />
            </div>
            <CardTitle className="text-xl">Where data is stored</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-relaxed text-muted-foreground space-y-2">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong className="text-foreground">Uploaded images are kept in private storage.</strong> They are stored in a private Supabase Storage bucket accessible only to the author and authorized reviewers.
              </li>
              <li>
                <strong className="text-foreground">Extracted document text is kept in the database.</strong> It is stored alongside submission records and version history in our database.
              </li>
              <li>
                All submissions, brand rules, facts, terminology, and audit logs are stored securely in a Supabase database, strictly separated and isolated by company workspace.
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* 6. Human control */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Users className="h-5 w-5" aria-hidden="true" />
            </div>
            <CardTitle className="text-xl">Human control</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-relaxed text-muted-foreground">
            <p>
              Humans maintain full authority over all content. AI suggestions are strictly advisory and never automatically modify or approve content. Creators decide whether to accept, edit, or reject suggestions, and human reviewers make all final approval or change request decisions.
            </p>
          </CardContent>
        </Card>

        {/* 7. Limits & Free tier guidance */}
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-3">
            <div className="p-2 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </div>
            <CardTitle className="text-xl text-amber-900 dark:text-amber-200">
              Limits &amp; Demo Guidance
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-relaxed text-muted-foreground space-y-3">
            <p>
              The AI can miss brand issues or flag false positives. Always review suggestions carefully before publishing or approving changes.
            </p>
            <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-950 dark:text-amber-100 font-medium">
              &ldquo;Only upload made-up or non-confidential material on this free tier.&rdquo;
            </div>
            <p className="text-xs">
              Because requests on the provider&apos;s free tier may be used to improve AI models, do not submit proprietary documents, confidential company data, or sensitive personal information.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
