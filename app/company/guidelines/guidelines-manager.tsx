"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  saveRuleAction,
  deleteRuleAction,
  saveFactAction,
  deleteFactAction,
  saveTermAction,
  deleteTermAction,
  loadSampleBrandKitAction,
} from "./actions";
import {
  Sparkles,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  FileText,
  HelpCircle,
  BookA,
} from "lucide-react";

export interface RuleItem {
  id: string;
  code: string;
  category: string;
  title: string;
  body: string;
  needs_escalation?: boolean;
  created_at?: string;
}

export interface FactItem {
  id: string;
  code: string;
  statement: string;
  source: string | null;
  updated_on: string | null;
}

export interface TermItem {
  id: string;
  preferred: string;
  avoid: string;
  note: string | null;
}

interface GuidelinesManagerProps {
  companyId: string;
  companyName: string;
  initialRules: RuleItem[];
  initialFacts: FactItem[];
  initialTerms: TermItem[];
}

const CATEGORIES = [
  { value: "tone", label: "Tone" },
  { value: "terminology", label: "Terminology" },
  { value: "claims", label: "Claims" },
  { value: "facts", label: "Facts" },
  { value: "visual", label: "Visual" },
  { value: "accessibility", label: "Accessibility" },
];

export function GuidelinesManager({
  companyId,
  companyName,
  initialRules,
  initialFacts,
  initialTerms,
}: GuidelinesManagerProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"rules" | "facts" | "terms">("rules");
  const [isPending, startTransition] = useTransition();

  // Notification banners
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Modals state
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RuleItem | null>(null);
  const [ruleFormError, setRuleFormError] = useState<string | null>(null);

  const [factModalOpen, setFactModalOpen] = useState(false);
  const [editingFact, setEditingFact] = useState<FactItem | null>(null);
  const [factFormError, setFactFormError] = useState<string | null>(null);

  const [termModalOpen, setTermModalOpen] = useState(false);
  const [editingTerm, setEditingTerm] = useState<TermItem | null>(null);
  const [termFormError, setTermFormError] = useState<string | null>(null);

  // Delete confirm state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: "rule" | "fact" | "term";
    id: string;
    identifier: string; // code or preferred
  } | null>(null);

  // Handler: Load sample brand kit
  const handleLoadSampleBrandKit = () => {
    setFeedback(null);
    startTransition(async () => {
      const res = await loadSampleBrandKitAction(companyId);
      if (res.error) {
        setFeedback({ type: "error", message: res.error });
      } else {
        const total =
          (res.insertedRules || 0) +
          (res.insertedFacts || 0) +
          (res.insertedTerms || 0);
        setFeedback({
          type: "success",
          message:
            total > 0
              ? `Loaded sample brand kit! Added ${res.insertedRules} rules, ${res.insertedFacts} facts, and ${res.insertedTerms} terms.`
              : "Sample brand kit already matches all existing items. No new items needed.",
        });
        router.refresh();
      }
    });
  };

  // Rule Submit
  const handleRuleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setRuleFormError(null);
    const formData = new FormData(e.currentTarget);

    const rawCode = (formData.get("code") as string) || "";
    const code = rawCode.trim().toUpperCase();

    if (!code) {
      setRuleFormError("Please enter a rule code.");
      return;
    }

    // Check for duplicates case-insensitively
    const isDuplicate = initialRules.some(
      (r) =>
        r.code.trim().toUpperCase() === code &&
        r.id !== editingRule?.id,
    );

    if (isDuplicate) {
      setRuleFormError(
        `Rule code "${code}" is already in use. Please choose a different code.`,
      );
      return;
    }

    const payload = {
      id: editingRule?.id,
      code,
      category: ((formData.get("category") as string) || "").trim(),
      title: ((formData.get("title") as string) || "").trim(),
      body: ((formData.get("body") as string) || "").trim(),
      needs_escalation: formData.get("needs_escalation") === "on",
    };

    startTransition(async () => {
      const res = await saveRuleAction(companyId, payload);
      if (res.error) {
        setRuleFormError(res.error);
      } else {
        setRuleModalOpen(false);
        setEditingRule(null);
        setFeedback({
          type: "success",
          message: payload.id
            ? `Rule ${payload.code} updated successfully.`
            : `Rule ${payload.code} added successfully.`,
        });
        router.refresh();
      }
    });
  };

  // Fact Submit
  const handleFactSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFactFormError(null);
    const formData = new FormData(e.currentTarget);

    const rawCode = (formData.get("code") as string) || "";
    const code = rawCode.trim().toUpperCase();

    if (!code) {
      setFactFormError("Please enter a fact code.");
      return;
    }

    // Check for duplicates case-insensitively
    const isDuplicate = initialFacts.some(
      (f) =>
        f.code.trim().toUpperCase() === code &&
        f.id !== editingFact?.id,
    );

    if (isDuplicate) {
      setFactFormError(
        `Fact code "${code}" is already in use. Please choose a different code.`,
      );
      return;
    }

    const payload = {
      id: editingFact?.id,
      code,
      statement: ((formData.get("statement") as string) || "").trim(),
      source: ((formData.get("source") as string) || "").trim(),
      updated_on: (formData.get("updated_on") as string) || undefined,
    };

    startTransition(async () => {
      const res = await saveFactAction(companyId, payload);
      if (res.error) {
        setFactFormError(res.error);
      } else {
        setFactModalOpen(false);
        setEditingFact(null);
        setFeedback({
          type: "success",
          message: payload.id
            ? `Fact ${payload.code} updated successfully.`
            : `Fact ${payload.code} added successfully.`,
        });
        router.refresh();
      }
    });
  };

  // Term Submit
  const handleTermSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTermFormError(null);
    const formData = new FormData(e.currentTarget);

    const payload = {
      id: editingTerm?.id,
      preferred: (formData.get("preferred") as string) || "",
      avoid: (formData.get("avoid") as string) || "",
      note: (formData.get("note") as string) || "",
    };

    startTransition(async () => {
      const res = await saveTermAction(companyId, payload);
      if (res.error) {
        setTermFormError(res.error);
      } else {
        setTermModalOpen(false);
        setEditingTerm(null);
        setFeedback({
          type: "success",
          message: payload.id
            ? `Term "${payload.preferred}" updated successfully.`
            : `Term "${payload.preferred}" added successfully.`,
        });
        router.refresh();
      }
    });
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    const { type, id, identifier } = deleteConfirm;

    startTransition(async () => {
      let res;
      if (type === "rule") {
        res = await deleteRuleAction(companyId, id, identifier);
      } else if (type === "fact") {
        res = await deleteFactAction(companyId, id, identifier);
      } else {
        res = await deleteTermAction(companyId, id, identifier);
      }

      if (res.error) {
        setFeedback({ type: "error", message: res.error });
      } else {
        setFeedback({
          type: "success",
          message: `Deleted ${type} "${identifier}" successfully.`,
        });
        setDeleteConfirm(null);
        router.refresh();
      }
    });
  };

  return (
    <div className="flex-1 max-w-7xl mx-auto w-full p-6 md:p-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold tracking-tight">Brand Guidelines</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-primary/10 text-primary border border-primary/20">
              {companyName}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Create and manage the brand rules, approved facts, and vocabulary that guide your team and power AI reviews.
          </p>
        </div>

        <div>
          <Button
            onClick={handleLoadSampleBrandKit}
            disabled={isPending}
            variant="outline"
            className="flex items-center gap-2 border-primary/40 hover:bg-primary/5 hover:border-primary"
          >
            <Sparkles className="h-4 w-4 text-primary" />
            {isPending ? "Loading kit..." : "Load sample brand kit"}
          </Button>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          role="alert"
          className={`flex items-center justify-between p-4 rounded-lg border text-sm ${
            feedback.type === "success"
              ? "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400"
              : "bg-destructive/10 border-destructive/30 text-destructive"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="h-5 w-5 shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close notification"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center justify-between border-b pb-1">
        <div role="tablist" aria-label="Brand Guidelines sections" className="flex gap-2">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "rules"}
            onClick={() => setActiveTab("rules")}
            className={`flex items-center gap-2 px-4 py-2 font-medium text-sm rounded-t-md transition-colors border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              activeTab === "rules"
                ? "border-primary text-primary bg-primary/5 font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            Rules
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted font-mono">
              {initialRules.length}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "facts"}
            onClick={() => setActiveTab("facts")}
            className={`flex items-center gap-2 px-4 py-2 font-medium text-sm rounded-t-md transition-colors border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              activeTab === "facts"
                ? "border-primary text-primary bg-primary/5 font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <HelpCircle className="h-4 w-4" aria-hidden="true" />
            Facts
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted font-mono">
              {initialFacts.length}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "terms"}
            onClick={() => setActiveTab("terms")}
            className={`flex items-center gap-2 px-4 py-2 font-medium text-sm rounded-t-md transition-colors border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              activeTab === "terms"
                ? "border-primary text-primary bg-primary/5 font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <BookA className="h-4 w-4" aria-hidden="true" />
            Terms
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted font-mono">
              {initialTerms.length}
            </span>
          </button>
        </div>

        {/* Tab-specific Add Button */}
        <div>
          {activeTab === "rules" && (
            <Button
              size="sm"
              onClick={() => {
                setEditingRule(null);
                setRuleFormError(null);
                setRuleModalOpen(true);
              }}
              className="flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" /> Add Rule
            </Button>
          )}

          {activeTab === "facts" && (
            <Button
              size="sm"
              onClick={() => {
                setEditingFact(null);
                setFactFormError(null);
                setFactModalOpen(true);
              }}
              className="flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" /> Add Fact
            </Button>
          )}

          {activeTab === "terms" && (
            <Button
              size="sm"
              onClick={() => {
                setEditingTerm(null);
                setTermFormError(null);
                setTermModalOpen(true);
              }}
              className="flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" /> Add Term
            </Button>
          )}
        </div>
      </div>

      {/* Tab 1: RULES TABLE */}
      {activeTab === "rules" && (
        <div className="border rounded-lg bg-card overflow-hidden shadow-sm">
          {initialRules.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground space-y-4">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground mx-auto">
                <FileText className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-foreground text-base">No brand rules configured yet</p>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Rules guide how content should be written — covering tone, claims, terminology, and accessibility.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <Button
                  type="button"
                  onClick={() => {
                    setEditingRule(null);
                    setRuleFormError(null);
                    setRuleModalOpen(true);
                  }}
                  className="flex items-center gap-1.5"
                >
                  <Plus className="h-4 w-4" /> Add your first rule
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleLoadSampleBrandKit}
                  disabled={isPending}
                  className="flex items-center gap-1.5"
                >
                  <Sparkles className="h-4 w-4 text-primary" />
                  {isPending ? "Loading..." : "Load sample brand kit"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/60 text-muted-foreground border-b text-xs uppercase tracking-wider">
                  <tr>
                    <th scope="col" className="px-6 py-3 font-semibold w-28">
                      Code
                    </th>
                    <th scope="col" className="px-6 py-3 font-semibold w-36">
                      Category
                    </th>
                    <th scope="col" className="px-6 py-3 font-semibold">
                      Title
                    </th>
                    <th scope="col" className="px-6 py-3 font-semibold text-right w-36">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {initialRules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-foreground">
                        {rule.code.toUpperCase()}
                      </td>
                      <td className="px-6 py-4">
                        <span className="capitalize px-2 py-0.5 rounded text-xs font-medium bg-muted border">
                          {rule.category}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-foreground">{rule.title}</span>
                          {rule.needs_escalation && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
                              Sensitive
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {rule.body}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingRule(rule);
                              setRuleFormError(null);
                              setRuleModalOpen(true);
                            }}
                            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition"
                            aria-label={`Edit rule ${rule.code.toUpperCase()}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteConfirm({
                                type: "rule",
                                id: rule.id,
                                identifier: rule.code.toUpperCase(),
                              })
                            }
                            className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition"
                            aria-label={`Delete rule ${rule.code.toUpperCase()}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: FACTS TABLE */}
      {activeTab === "facts" && (
        <div className="border rounded-lg bg-card overflow-hidden shadow-sm">
          {initialFacts.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground space-y-4">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground mx-auto">
                <HelpCircle className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-foreground text-base">No approved facts configured yet</p>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Approved facts ensure numbers, dates, sourcing, and company claims are accurate and verifiable.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <Button
                  type="button"
                  onClick={() => {
                    setEditingFact(null);
                    setFactFormError(null);
                    setFactModalOpen(true);
                  }}
                  className="flex items-center gap-1.5"
                >
                  <Plus className="h-4 w-4" /> Add your first fact
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleLoadSampleBrandKit}
                  disabled={isPending}
                  className="flex items-center gap-1.5"
                >
                  <Sparkles className="h-4 w-4 text-primary" />
                  {isPending ? "Loading..." : "Load sample brand kit"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/60 text-muted-foreground border-b text-xs uppercase tracking-wider">
                  <tr>
                    <th scope="col" className="px-6 py-3 font-semibold w-28">
                      Code
                    </th>
                    <th scope="col" className="px-6 py-3 font-semibold">
                      Statement
                    </th>
                    <th scope="col" className="px-6 py-3 font-semibold w-56">
                      Source
                    </th>
                    <th scope="col" className="px-6 py-3 font-semibold w-36">
                      Last Updated
                    </th>
                    <th scope="col" className="px-6 py-3 font-semibold text-right w-36">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {initialFacts.map((fact) => (
                    <tr key={fact.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-foreground">
                        {fact.code.toUpperCase()}
                      </td>
                      <td className="px-6 py-4 text-foreground font-medium">
                        {fact.statement}
                      </td>
                      <td className="px-6 py-4 text-xs text-muted-foreground">
                        {fact.source || "—"}
                      </td>
                      <td className="px-6 py-4 text-xs text-muted-foreground">
                        {fact.updated_on
                          ? new Date(fact.updated_on).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingFact(fact);
                              setFactFormError(null);
                              setFactModalOpen(true);
                            }}
                            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition"
                            aria-label={`Edit fact ${fact.code.toUpperCase()}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteConfirm({
                                type: "fact",
                                id: fact.id,
                                identifier: fact.code.toUpperCase(),
                              })
                            }
                            className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition"
                            aria-label={`Delete fact ${fact.code.toUpperCase()}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: TERMS TABLE */}
      {activeTab === "terms" && (
        <div className="border rounded-lg bg-card overflow-hidden shadow-sm">
          {initialTerms.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground space-y-4">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground mx-auto">
                <BookA className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-foreground text-base">No vocabulary terms configured yet</p>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Define preferred and avoided words so all copy matches your organization&apos;s voice.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <Button
                  type="button"
                  onClick={() => {
                    setEditingTerm(null);
                    setTermFormError(null);
                    setTermModalOpen(true);
                  }}
                  className="flex items-center gap-1.5"
                >
                  <Plus className="h-4 w-4" /> Add your first term
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleLoadSampleBrandKit}
                  disabled={isPending}
                  className="flex items-center gap-1.5"
                >
                  <Sparkles className="h-4 w-4 text-primary" />
                  {isPending ? "Loading..." : "Load sample brand kit"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/60 text-muted-foreground border-b text-xs uppercase tracking-wider">
                  <tr>
                    <th scope="col" className="px-6 py-3 font-semibold w-48">
                      Preferred
                    </th>
                    <th scope="col" className="px-6 py-3 font-semibold w-64">
                      Avoid
                    </th>
                    <th scope="col" className="px-6 py-3 font-semibold">
                      Note
                    </th>
                    <th scope="col" className="px-6 py-3 font-semibold text-right w-36">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {initialTerms.map((term) => (
                    <tr key={term.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 font-semibold text-green-700 dark:text-green-400">
                        {term.preferred}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-destructive">
                        {term.avoid}
                      </td>
                      <td className="px-6 py-4 text-xs text-muted-foreground">
                        {term.note || "—"}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTerm(term);
                              setTermFormError(null);
                              setTermModalOpen(true);
                            }}
                            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition"
                            aria-label={`Edit term ${term.preferred}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteConfirm({
                                type: "term",
                                id: term.id,
                                identifier: term.preferred,
                              })
                            }
                            className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition"
                            aria-label={`Delete term ${term.preferred}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL: ADD / EDIT RULE */}
      {ruleModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in"
        >
          <div className="bg-card text-card-foreground border rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-xl font-bold">
                {editingRule ? `Edit Rule: ${editingRule.code.toUpperCase()}` : "Add New Rule"}
              </h2>
              <button
                type="button"
                onClick={() => setRuleModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {ruleFormError && (
              <div
                role="alert"
                className="p-3 bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-md"
              >
                {ruleFormError}
              </div>
            )}

            <form onSubmit={handleRuleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="rule-code">Rule Code</Label>
                  <Input
                    id="rule-code"
                    name="code"
                    defaultValue={editingRule?.code ? editingRule.code.toUpperCase() : ""}
                    placeholder="e.g. T-1"
                    required
                    className="font-mono uppercase"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="rule-category">Category</Label>
                  <select
                    id="rule-category"
                    name="category"
                    defaultValue={editingRule?.category || "tone"}
                    required
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="rule-title">Title</Label>
                <Input
                  id="rule-title"
                  name="title"
                  defaultValue={editingRule?.title || ""}
                  placeholder="e.g. Friendly and warm"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="rule-body">Rule Body</Label>
                <textarea
                  id="rule-body"
                  name="body"
                  defaultValue={editingRule?.body || ""}
                  rows={4}
                  placeholder="Write like a friendly neighbour: short sentences, speak to the reader as you, no jargon."
                  required
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="rule-needs-escalation"
                  name="needs_escalation"
                  defaultChecked={editingRule?.needs_escalation ?? false}
                  className="h-4 w-4 rounded border-input bg-background text-purple-600 focus:ring-purple-500 cursor-pointer"
                />
                <Label
                  htmlFor="rule-needs-escalation"
                  className="text-sm font-normal cursor-pointer"
                >
                  Needs authorised reviewer sign off
                </Label>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRuleModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Saving..." : editingRule ? "Save Changes" : "Create Rule"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT FACT */}
      {factModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in"
        >
          <div className="bg-card text-card-foreground border rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-xl font-bold">
                {editingFact ? `Edit Fact: ${editingFact.code.toUpperCase()}` : "Add New Fact"}
              </h2>
              <button
                type="button"
                onClick={() => setFactModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {factFormError && (
              <div
                role="alert"
                className="p-3 bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-md"
              >
                {factFormError}
              </div>
            )}

            <form onSubmit={handleFactSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="fact-code">Fact Code</Label>
                  <Input
                    id="fact-code"
                    name="code"
                    defaultValue={editingFact?.code ? editingFact.code.toUpperCase() : ""}
                    placeholder="e.g. F-1"
                    required
                    className="font-mono uppercase"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="fact-source">Source</Label>
                  <Input
                    id="fact-source"
                    name="source"
                    defaultValue={editingFact?.source || ""}
                    placeholder="e.g. Sourcing report 2026"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="fact-statement">Statement</Label>
                <textarea
                  id="fact-statement"
                  name="statement"
                  defaultValue={editingFact?.statement || ""}
                  rows={3}
                  placeholder="e.g. FreshBrew beans come from three countries: Colombia, Ethiopia and Brazil."
                  required
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="fact-updated">Last Updated (YYYY-MM-DD)</Label>
                <Input
                  id="fact-updated"
                  name="updated_on"
                  type="date"
                  defaultValue={
                    editingFact?.updated_on
                      ? editingFact.updated_on.split("T")[0]
                      : new Date().toISOString().split("T")[0]
                  }
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setFactModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Saving..." : editingFact ? "Save Changes" : "Create Fact"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT TERM */}
      {termModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in"
        >
          <div className="bg-card text-card-foreground border rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-xl font-bold">
                {editingTerm ? `Edit Term: ${editingTerm.preferred}` : "Add New Term"}
              </h2>
              <button
                type="button"
                onClick={() => setTermModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {termFormError && (
              <div
                role="alert"
                className="p-3 bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-md"
              >
                {termFormError}
              </div>
            )}

            <form onSubmit={handleTermSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="term-preferred">Preferred Term</Label>
                <Input
                  id="term-preferred"
                  name="preferred"
                  defaultValue={editingTerm?.preferred || ""}
                  placeholder="e.g. affordable"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="term-avoid">Avoid Terms</Label>
                <Input
                  id="term-avoid"
                  name="avoid"
                  defaultValue={editingTerm?.avoid || ""}
                  placeholder="e.g. cheap"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="term-note">Note / Guidance</Label>
                <Input
                  id="term-note"
                  name="note"
                  defaultValue={editingTerm?.note || ""}
                  placeholder="e.g. Never describe our prices as cheap"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setTermModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Saving..." : editingTerm ? "Save Changes" : "Create Term"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {deleteConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in"
        >
          <div className="bg-card text-card-foreground border rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-destructive">
              <AlertCircle className="h-6 w-6 shrink-0" />
              <h2 className="text-lg font-bold">Confirm Delete</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete {deleteConfirm.type}{" "}
              <strong className="text-foreground font-mono">{deleteConfirm.identifier}</strong>?
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-3 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteConfirm(null)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={isPending}
              >
                {isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
