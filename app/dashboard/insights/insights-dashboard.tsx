"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
  ReferenceLine,
  LineChart,
  Line,
} from "recharts";
import {
  Table as TableIcon,
  BarChart2,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  FileText,
  Sparkles,
  Loader2,
  Quote,
  MessageSquare,
  Check,
  AlertCircle,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AiBadge } from "@/components/ai-badge";
import type {
  BrokenRule,
  RepeatMistakeStat,
  RuleRejectionRate,
  PeriodTrend,
} from "@/lib/insights/compute";
import {
  suggestClearerWordingAction,
  applyRuleRewriteAction,
  type RuleRewriteSuggestion,
} from "./actions";

export interface PossiblyUnclearRuleItem {
  id: string;
  code: string;
  title: string;
  body: string;
  category?: string;
  decided: number;
  rejected: number;
  rejectionRate: number;
  rejectionReasons: string[];
  rejectedQuotes: string[];
}

interface InsightsDashboardProps {
  range: "7d" | "30d" | "all";
  companyName: string;
  companyId: string;
  role: string;
  isEmployer: boolean;
  brokenRules: BrokenRule[];
  repeatStats: RepeatMistakeStat[];
  rejectionRatesData: RuleRejectionRate[];
  trendData: PeriodTrend[];
  unclearRules: PossiblyUnclearRuleItem[];
  totalSubmissions: number;
  totalFindings: number;
}

export function InsightsDashboardClient({
  range,
  companyName,
  companyId,
  role,
  isEmployer,
  brokenRules,
  repeatStats,
  rejectionRatesData,
  trendData,
  unclearRules,
  totalSubmissions,
  totalFindings,
}: InsightsDashboardProps) {
  const [viewTable, setViewTable] = useState<Record<string, boolean>>({
    brokenRules: false,
    repeatMistakes: false,
    rejectionRates: false,
    trend: false,
  });

  // Local overrides for rule title & body after apply
  const [localRuleUpdates, setLocalRuleUpdates] = useState<
    Record<string, { title: string; body: string }>
  >({});

  // AI suggestions state per rule ID
  const [suggestions, setSuggestions] = useState<Record<string, RuleRewriteSuggestion | null>>({});
  const [loadingSuggest, setLoadingSuggest] = useState<Record<string, boolean>>({});
  const [suggestErrors, setSuggestErrors] = useState<Record<string, string | null>>({});

  // Apply state per rule ID
  const [applying, setApplying] = useState<Record<string, boolean>>({});
  const [applyErrors, setApplyErrors] = useState<Record<string, string | null>>({});
  const [applySuccess, setApplySuccess] = useState<Record<string, string | null>>({});

  const toggleView = (key: string) => {
    setViewTable((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSuggest = async (rule: PossiblyUnclearRuleItem) => {
    setLoadingSuggest((prev) => ({ ...prev, [rule.id]: true }));
    setSuggestErrors((prev) => ({ ...prev, [rule.id]: null }));
    setApplySuccess((prev) => ({ ...prev, [rule.id]: null }));

    try {
      const currentTitle = localRuleUpdates[rule.id]?.title ?? rule.title;
      const currentBody = localRuleUpdates[rule.id]?.body ?? rule.body;

      const res = await suggestClearerWordingAction(
        companyId,
        {
          id: rule.id,
          code: rule.code,
          title: currentTitle,
          body: currentBody,
          category: rule.category,
        },
        rule.rejectionReasons,
        rule.rejectedQuotes,
      );

      if (res.success && res.suggestion) {
        setSuggestions((prev) => ({ ...prev, [rule.id]: res.suggestion! }));
      } else {
        setSuggestErrors((prev) => ({
          ...prev,
          [rule.id]: res.error || "Failed to generate suggested wording.",
        }));
      }
    } catch (err: any) {
      setSuggestErrors((prev) => ({
        ...prev,
        [rule.id]: err?.message || "An unexpected error occurred while requesting suggestions.",
      }));
    } finally {
      setLoadingSuggest((prev) => ({ ...prev, [rule.id]: false }));
    }
  };

  const handleDismiss = (ruleId: string) => {
    setSuggestions((prev) => ({ ...prev, [ruleId]: null }));
    setSuggestErrors((prev) => ({ ...prev, [ruleId]: null }));
  };

  const handleApply = async (rule: PossiblyUnclearRuleItem, suggestion: RuleRewriteSuggestion) => {
    setApplying((prev) => ({ ...prev, [rule.id]: true }));
    setApplyErrors((prev) => ({ ...prev, [rule.id]: null }));

    try {
      const res = await applyRuleRewriteAction(
        companyId,
        rule.id,
        suggestion.title,
        suggestion.body,
        suggestion.explanation,
      );

      if (res.success) {
        // Update local wording immediately
        setLocalRuleUpdates((prev) => ({
          ...prev,
          [rule.id]: {
            title: suggestion.title,
            body: suggestion.body,
          },
        }));
        // Clear active suggestion
        setSuggestions((prev) => ({ ...prev, [rule.id]: null }));
        setApplySuccess((prev) => ({
          ...prev,
          [rule.id]: `Rewrite successfully applied to ${rule.code}! Embeddings refreshed.`,
        }));
      } else {
        setApplyErrors((prev) => ({
          ...prev,
          [rule.id]: res.error || "Failed to apply rewrite.",
        }));
      }
    } catch (err: any) {
      setApplyErrors((prev) => ({
        ...prev,
        [rule.id]: err?.message || "An unexpected error occurred while applying rewrite.",
      }));
    } finally {
      setApplying((prev) => ({ ...prev, [rule.id]: false }));
    }
  };

  const hasData = totalSubmissions > 0 || totalFindings > 0;

  // Rules with at least 5 decided findings (for Card C)
  const eligibleRejectionRules = rejectionRatesData.filter((r) => r.decided >= 5);

  return (
    <div className="flex-1 max-w-7xl mx-auto w-full p-6 md:p-8 space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold tracking-tight">Insights &amp; Analytics</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-primary/10 text-primary border border-primary/20 capitalize">
              {companyName} ({role})
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Track guideline adherence, identify repeat mistakes, evaluate rule clarity, and review quality trends.
          </p>
        </div>

        {/* ── Date Range Filter ── */}
        <div
          className="inline-flex items-center rounded-lg border bg-muted/40 p-1 text-xs font-medium"
          role="group"
          aria-label="Date range selector"
        >
          <Link
            href="/dashboard/insights?range=7d"
            className={`px-3 py-1.5 rounded-md transition-all ${
              range === "7d"
                ? "bg-card text-foreground font-semibold shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            aria-current={range === "7d" ? "page" : undefined}
          >
            Last 7 days
          </Link>
          <Link
            href="/dashboard/insights?range=30d"
            className={`px-3 py-1.5 rounded-md transition-all ${
              range === "30d"
                ? "bg-card text-foreground font-semibold shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            aria-current={range === "30d" ? "page" : undefined}
          >
            Last 30 days
          </Link>
          <Link
            href="/dashboard/insights?range=all"
            className={`px-3 py-1.5 rounded-md transition-all ${
              range === "all"
                ? "bg-card text-foreground font-semibold shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            aria-current={range === "all" ? "page" : undefined}
          >
            All time
          </Link>
        </div>
      </div>

      {/* ── Stat Highlights ── */}
      {hasData && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card border rounded-xl p-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">Submissions analyzed</p>
            <p className="text-2xl font-bold mt-1 text-foreground">{totalSubmissions}</p>
            <p className="text-xs text-muted-foreground mt-0.5 capitalize">{range === "all" ? "All time" : `Past ${range}`}</p>
          </div>
          <div className="bg-card border rounded-xl p-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">First-version findings</p>
            <p className="text-2xl font-bold mt-1 text-foreground">{totalFindings}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Initial author mistakes</p>
          </div>
          <div className="bg-card border rounded-xl p-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">Top broken rule</p>
            <p className="text-xl font-bold mt-1 text-foreground truncate">
              {brokenRules[0]?.code ? `${brokenRules[0].code} (${brokenRules[0].count})` : "None"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {brokenRules[0]?.title || "No rule violations"}
            </p>
          </div>
          <div className="bg-card border rounded-xl p-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">Rules flagged unclear</p>
            <p className={`text-2xl font-bold mt-1 ${unclearRules.length > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>
              {unclearRules.length}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {unclearRules.length > 0 ? "Rejection rate ≥ 40%" : "All rules clear"}
            </p>
          </div>
        </div>
      )}

      {/* ── Empty State ── */}
      {!hasData ? (
        <div className="border rounded-2xl bg-card p-12 text-center space-y-5 shadow-sm max-w-xl mx-auto my-12">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground mx-auto">
            <BarChart2 className="h-8 w-8" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">No insights data yet</h2>
            <p className="text-sm text-muted-foreground">
              Charts appear after posts have been submitted by team members and reviewed. Submissions and reviewer decisions will automatically populate these analytics.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {range !== "all" && (
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/insights?range=all">View all time data</Link>
              </Button>
            )}
            <Button asChild size="sm">
              <Link href="/submit">Submit new content</Link>
            </Button>
          </div>
        </div>
      ) : (
        /* ── 4 Recharts Cards ── */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* ── Card A: Most Broken Rules ── */}
          <ChartCard
            title="Most broken rules"
            description="Top 8 brand rules violated in the first version of submissions, showing which guidelines writers struggle with most."
            isTable={viewTable.brokenRules}
            onToggle={() => toggleView("brokenRules")}
            tableContent={
              <AccessibleTable
                caption="Top broken rules in first version of submissions"
                headers={["Rule Code", "Rule Title", "First-Version Mistakes"]}
                rows={brokenRules.map((r) => [r.code, r.title, r.count])}
              />
            }
          >
            {brokenRules.length === 0 ? (
              <NoCardData message="No broken rules recorded in this period." />
            ) : (
              <div
                className="w-full h-80 pt-4"
                role="region"
                aria-label="Horizontal bar chart showing top broken rules by count"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={brokenRules.map((r) => ({
                      code: r.code,
                      name: `${r.code}: ${r.title}`,
                      count: r.count,
                    }))}
                    margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#88888820" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                    <YAxis
                      type="category"
                      dataKey="code"
                      width={65}
                      tick={{ fontSize: 12, fontWeight: 600 }}
                    />
                    <Tooltip
                      formatter={(val: any) => [`${val} occurrences`, "Findings Count"]}
                      labelFormatter={(_: any, payload: any) => {
                        if (payload && payload[0]) {
                          return payload[0].payload.name;
                        }
                        return "";
                      }}
                      contentStyle={{
                        backgroundColor: "var(--background)",
                        borderColor: "var(--border)",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar
                      dataKey="count"
                      name="Violations count"
                      fill="#3b82f6"
                      radius={[0, 4, 4, 0]}
                    >
                      <LabelList
                        dataKey="count"
                        position="right"
                        style={{ fill: "currentColor", fontSize: 12, fontWeight: 600 }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>

          {/* ── Card B: Repeat Mistakes by Person ── */}
          <ChartCard
            title="Repeat mistakes by person"
            description="Percentage of first-version mistakes that repeat a rule code the author previously broke in another post."
            isTable={viewTable.repeatMistakes}
            onToggle={() => toggleView("repeatMistakes")}
            tableContent={
              <AccessibleTable
                caption="Author repeat mistake statistics and repeated rule codes"
                headers={[
                  "Author",
                  "Total Mistakes",
                  "Repeated Mistakes",
                  "Repeat Rate",
                  "Repeated Codes",
                ]}
                rows={repeatStats.map((s) => [
                  s.display_name,
                  s.total_mistakes,
                  s.repeated_mistakes,
                  `${(s.repeat_rate * 100).toFixed(1)}%`,
                  s.repeated_rule_codes.length > 0
                    ? s.repeated_rule_codes.join(", ")
                    : "None",
                ])}
              />
            }
          >
            {repeatStats.length === 0 ? (
              <NoCardData message="No author mistake data recorded in this period." />
            ) : (
              <div className="space-y-4">
                <div
                  className="w-full h-72 pt-4"
                  role="region"
                  aria-label="Bar chart showing repeat mistake rate percentage per author"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={repeatStats.map((s) => ({
                        author: s.display_name,
                        repeatPercent: Number((s.repeat_rate * 100).toFixed(1)),
                        repeatedMistakes: s.repeated_mistakes,
                        totalMistakes: s.total_mistakes,
                        codes: s.repeated_rule_codes,
                      }))}
                      margin={{ top: 15, right: 20, left: 0, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888820" />
                      <XAxis dataKey="author" tick={{ fontSize: 12, fontWeight: 500 }} />
                      <YAxis
                        unit="%"
                        domain={[0, 100]}
                        tick={{ fontSize: 12 }}
                        allowDecimals={false}
                      />
                      <Tooltip
                        formatter={(val: any, _: any, item: any) => [
                          `${val}% (${item.payload.repeatedMistakes} of ${item.payload.totalMistakes} mistakes)`,
                          "Repeat Rate",
                        ]}
                        contentStyle={{
                          backgroundColor: "var(--background)",
                          borderColor: "var(--border)",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar
                        dataKey="repeatPercent"
                        name="Repeat rate (%)"
                        fill="#f59e0b"
                        radius={[4, 4, 0, 0]}
                      >
                        <LabelList
                          dataKey="repeatPercent"
                          position="top"
                          formatter={(v: any) => `${v}%`}
                          style={{ fill: "currentColor", fontSize: 12, fontWeight: 600 }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Repeated Rule Codes Listed Below Chart */}
                <div className="pt-2 border-t text-xs space-y-1.5">
                  <p className="font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">
                    Repeated rule codes by author (appear in 2+ posts):
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {repeatStats.map((s) => (
                      <div
                        key={s.author_id}
                        className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border text-foreground"
                      >
                        <span className="font-medium text-foreground">{s.display_name}:</span>
                        {s.repeated_rule_codes.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {s.repeated_rule_codes.map((c) => (
                              <span
                                key={c}
                                className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 font-mono text-[11px] font-semibold border border-amber-500/20"
                              >
                                {c}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">No repeated mistakes</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </ChartCard>

          {/* ── Card C: Rejection Rate by Rule ── */}
          <ChartCard
            title="Rejection rate by rule"
            description="Percentage of decided findings rejected during review for rules with at least 5 decided findings. The red line marks the 40% threshold for possibly unclear rules."
            isTable={viewTable.rejectionRates}
            onToggle={() => toggleView("rejectionRates")}
            tableContent={
              <AccessibleTable
                caption="Rejection rate per rule code with clarity status"
                headers={[
                  "Rule Code",
                  "Rule Title",
                  "Decided Findings",
                  "Rejected Findings",
                  "Rejection Rate",
                  "Clarity Status",
                ]}
                rows={eligibleRejectionRules.map((r) => [
                  r.code,
                  r.title,
                  r.decided,
                  r.rejected,
                  `${(r.rejection_rate * 100).toFixed(1)}%`,
                  r.possibly_unclear ? "⚠️ Possibly Unclear (≥40%)" : "Clear (<40%)",
                ])}
              />
            }
          >
            {eligibleRejectionRules.length === 0 ? (
              <div className="border rounded-lg bg-muted/20 p-6 text-center space-y-2 my-8">
                <HelpCircle className="h-7 w-7 text-muted-foreground mx-auto" aria-hidden="true" />
                <p className="text-sm font-medium text-foreground">No rules with ≥ 5 decided findings yet</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  To ensure statistical relevance, this chart only displays rules once reviewers have decided (accepted, edited, or rejected) at least 5 findings for that rule code.
                </p>
              </div>
            ) : (
              <div
                className="w-full h-80 pt-4"
                role="region"
                aria-label="Bar chart showing rule rejection rates with 40 percent threshold"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={eligibleRejectionRules.map((r) => ({
                      code: r.code,
                      name: `${r.code}: ${r.title}`,
                      ratePercent: Number((r.rejection_rate * 100).toFixed(1)),
                      decided: r.decided,
                      rejected: r.rejected,
                      unclear: r.possibly_unclear,
                    }))}
                    margin={{ top: 20, right: 20, left: 0, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888820" />
                    <XAxis dataKey="code" tick={{ fontSize: 12, fontWeight: 600 }} />
                    <YAxis
                      unit="%"
                      domain={[0, 100]}
                      tick={{ fontSize: 12 }}
                      allowDecimals={false}
                    />
                    <Tooltip
                      formatter={(val: any, _: any, item: any) => [
                        `${val}% (${item.payload.rejected} of ${item.payload.decided} decided rejected)${
                          item.payload.unclear ? " — Possibly unclear" : ""
                        }`,
                        "Rejection Rate",
                      ]}
                      labelFormatter={(_: any, payload: any) => {
                        if (payload && payload[0]) {
                          return payload[0].payload.name;
                        }
                        return "";
                      }}
                      contentStyle={{
                        backgroundColor: "var(--background)",
                        borderColor: "var(--border)",
                        borderRadius: "8px",
                      }}
                    />
                    <ReferenceLine
                      y={40}
                      stroke="#ef4444"
                      strokeDasharray="4 4"
                      strokeWidth={2}
                      label={{
                        value: "40% Unclear threshold",
                        fill: "#ef4444",
                        fontSize: 11,
                        position: "top",
                        fontWeight: 600,
                      }}
                    />
                    <Bar
                      dataKey="ratePercent"
                      name="Rejection rate (%)"
                      fill="#8b5cf6"
                      radius={[4, 4, 0, 0]}
                    >
                      <LabelList
                        dataKey="ratePercent"
                        position="top"
                        formatter={(v: any) => `${v}%`}
                        style={{ fill: "currentColor", fontSize: 12, fontWeight: 600 }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>

          {/* ── Card D: Trend Over Time ── */}
          <ChartCard
            title="Trend over time"
            description={`Findings per submission per ${
              range === "all" ? "week" : "day"
            }, tracking whether brand adherence is improving over time.`}
            isTable={viewTable.trend}
            onToggle={() => toggleView("trend")}
            tableContent={
              <AccessibleTable
                caption={`Findings per submission trend over time (${range === "all" ? "weekly" : "daily"})`}
                headers={["Period", "Submissions", "Findings", "Findings per Submission"]}
                rows={trendData.map((t) => [
                  t.period,
                  t.submissions,
                  t.findings,
                  t.findings_per_submission.toFixed(2),
                ])}
              />
            }
          >
            {trendData.length === 0 ? (
              <NoCardData message="No trend timeline data available for this range." />
            ) : (
              <div
                className="w-full h-80 pt-4"
                role="region"
                aria-label={`Line chart showing findings per submission per ${
                  range === "all" ? "week" : "day"
                }`}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={trendData.map((t) => ({
                      period: t.period,
                      rate: Number(t.findings_per_submission.toFixed(2)),
                      findings: t.findings,
                      submissions: t.submissions,
                    }))}
                    margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888820" />
                    <XAxis
                      dataKey="period"
                      tick={{ fontSize: 11 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      allowDecimals={true}
                      tick={{ fontSize: 12 }}
                      label={{
                        value: "Findings / post",
                        angle: -90,
                        position: "insideLeft",
                        style: { fontSize: 11, fill: "currentColor" },
                      }}
                    />
                    <Tooltip
                      formatter={(val: any, _: any, item: any) => [
                        `${val} (${item.payload.findings} findings across ${item.payload.submissions} submissions)`,
                        "Findings / submission",
                      ]}
                      contentStyle={{
                        backgroundColor: "var(--background)",
                        borderColor: "var(--border)",
                        borderRadius: "8px",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="rate"
                      name="Findings per submission"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "#10b981", strokeWidth: 1.5, stroke: "currentColor" }}
                      activeDot={{ r: 6 }}
                    >
                      <LabelList
                        dataKey="rate"
                        position="top"
                        formatter={(v: any) => (v > 0 ? v : "")}
                        style={{ fill: "currentColor", fontSize: 11, fontWeight: 500 }}
                      />
                    </Line>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>
        </div>
      )}

      {/* ── Possibly Unclear Rules Section ── */}
      <section aria-labelledby="unclear-rules-heading" className="space-y-6 pt-4 border-t">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h2 id="unclear-rules-heading" className="text-2xl font-bold tracking-tight text-foreground">
              Possibly unclear rules
            </h2>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                unclearRules.length > 0
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
                  : "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30"
              }`}
            >
              {unclearRules.length} {unclearRules.length === 1 ? "rule flagged" : "rules flagged"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
            Rules with at least 5 decided findings and a rejection rate of 40% or higher. When writers frequently reject findings citing a rule, the wording may be ambiguous, overly broad, or lack clear examples.
          </p>
        </div>

        {unclearRules.length === 0 ? (
          <div className="border rounded-2xl bg-card p-8 text-center space-y-3 shadow-sm">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10 text-green-600 mx-auto">
              <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-foreground">No rules are currently flagged as unclear</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                All rules with 5 or more decided reviewer findings have rejection rates below 40%.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {unclearRules.map((rule) => {
              const currentTitle = localRuleUpdates[rule.id]?.title ?? rule.title;
              const currentBody = localRuleUpdates[rule.id]?.body ?? rule.body;
              const suggestion = suggestions[rule.id];
              const isLoading = loadingSuggest[rule.id] ?? false;
              const isApplying = applying[rule.id] ?? false;
              const suggestError = suggestErrors[rule.id];
              const applyError = applyErrors[rule.id];
              const successMsg = applySuccess[rule.id];

              return (
                <div
                  key={rule.id}
                  className="bg-card border rounded-2xl p-6 shadow-sm space-y-6 transition-all"
                >
                  {/* Rule Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                          {rule.code}
                        </span>
                        {rule.category && (
                          <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground capitalize">
                            {rule.category}
                          </span>
                        )}
                        <h3 className="text-lg font-semibold text-foreground">{currentTitle}</h3>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="font-semibold text-amber-600 dark:text-amber-400">
                          {(rule.rejectionRate * 100).toFixed(1)}% rejection rate
                        </span>
                        <span>•</span>
                        <span>
                          {rule.rejected} rejected of {rule.decided} decided findings
                        </span>
                      </div>
                    </div>

                    {/* Employer action button if no suggestion currently active */}
                    {isEmployer && !suggestion && (
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isLoading}
                          onClick={() => handleSuggest(rule)}
                          className="gap-2 border-purple-500/40 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10"
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                              <span>Generating suggestion...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" aria-hidden="true" />
                              <span>Suggest clearer wording</span>
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Notification banners */}
                  {suggestError && (
                    <div
                      role="alert"
                      className="p-3.5 rounded-lg border border-destructive/30 bg-destructive/10 text-xs text-destructive flex items-start gap-2.5"
                    >
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                      <div className="flex-1 space-y-1">
                        <p className="font-semibold">Unable to generate suggestion</p>
                        <p>{suggestError}</p>
                      </div>
                    </div>
                  )}

                  {applyError && (
                    <div
                      role="alert"
                      className="p-3.5 rounded-lg border border-destructive/30 bg-destructive/10 text-xs text-destructive flex items-start gap-2.5"
                    >
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                      <div className="flex-1 space-y-1">
                        <p className="font-semibold">Failed to apply rule rewrite</p>
                        <p>{applyError}</p>
                      </div>
                    </div>
                  )}

                  {successMsg && (
                    <div
                      role="status"
                      className="p-3.5 rounded-lg border border-green-500/30 bg-green-500/10 text-xs text-green-700 dark:text-green-300 flex items-start gap-2.5"
                    >
                      <Check className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                      <p className="font-medium">{successMsg}</p>
                    </div>
                  )}

                  {/* Main comparison grid: Beside each other when suggestion exists */}
                  <div
                    className={`grid gap-6 ${
                      suggestion ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"
                    }`}
                  >
                    {/* Current Wording Column */}
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Current wording
                        </h4>
                        <div className="p-4 rounded-xl border bg-muted/20 space-y-2">
                          <p className="text-sm font-semibold text-foreground">{currentTitle}</p>
                          <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
                            {currentBody || (
                              <span className="italic text-muted-foreground">
                                (No description provided)
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Writers' Rejection Reasons (Up to 5) */}
                      <div className="space-y-2 pt-2">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                          Writers&apos; rejection reasons ({rule.rejectionReasons.length} of max 5)
                        </h4>
                        {rule.rejectionReasons.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic p-3 rounded-lg border bg-muted/10">
                            No written rejection reasons recorded.
                          </p>
                        ) : (
                          <div className="space-y-1.5">
                            {rule.rejectionReasons.map((reason, idx) => (
                              <div
                                key={idx}
                                className="p-2.5 rounded-lg border bg-muted/30 text-xs text-foreground/90 italic flex items-start gap-2"
                              >
                                <span className="text-muted-foreground font-mono text-[11px] not-italic shrink-0">
                                  #{idx + 1}
                                </span>
                                <span>&ldquo;{reason}&rdquo;</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Quoted texts that were rejected (Up to 5) */}
                      <div className="space-y-2 pt-2">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <Quote className="h-3.5 w-3.5" aria-hidden="true" />
                          Quoted content flagged &amp; rejected ({rule.rejectedQuotes.length} of max 5)
                        </h4>
                        {rule.rejectedQuotes.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic p-3 rounded-lg border bg-muted/10">
                            No quoted snippets recorded.
                          </p>
                        ) : (
                          <div className="space-y-1.5">
                            {rule.rejectedQuotes.map((q, idx) => (
                              <div
                                key={idx}
                                className="p-2.5 rounded-lg border bg-muted/30 font-mono text-[11px] text-foreground/90 flex items-start gap-2"
                              >
                                <span className="text-muted-foreground font-sans not-italic shrink-0">
                                  #{idx + 1}
                                </span>
                                <span className="break-words">&ldquo;{q}&rdquo;</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* AI Suggestion Column (shown beside current wording) */}
                    {suggestion && (
                      <div className="space-y-4 flex flex-col justify-between">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                                Suggested clearer wording
                              </h4>
                              <AiBadge />
                            </div>
                          </div>

                          <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-500/5 space-y-3">
                            <div>
                              <p className="text-[11px] uppercase tracking-wider font-semibold text-purple-700 dark:text-purple-300">
                                Proposed Title
                              </p>
                              <p className="text-sm font-semibold text-foreground mt-0.5">
                                {suggestion.title}
                              </p>
                            </div>

                            <div className="pt-2 border-t border-purple-500/20">
                              <p className="text-[11px] uppercase tracking-wider font-semibold text-purple-700 dark:text-purple-300">
                                Proposed Body (With Specific Examples)
                              </p>
                              <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed mt-1">
                                {suggestion.body}
                              </p>
                            </div>

                            <div className="pt-2 border-t border-purple-500/20">
                              <p className="text-[11px] uppercase tracking-wider font-semibold text-purple-700 dark:text-purple-300">
                                Why this improves clarity
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                                {suggestion.explanation}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Action buttons: Apply and Dismiss */}
                        <div className="pt-4 border-t flex flex-wrap items-center justify-end gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isApplying}
                            onClick={() => handleDismiss(rule.id)}
                            className="text-xs"
                          >
                            Dismiss
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={isApplying}
                            onClick={() => handleApply(rule, suggestion)}
                            className="text-xs gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                          >
                            {isApplying ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                                <span>Applying rewrite...</span>
                              </>
                            ) : (
                              <>
                                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>Apply</span>
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

function ChartCard({
  title,
  description,
  isTable,
  onToggle,
  tableContent,
  children,
}: {
  title: string;
  description: string;
  isTable: boolean;
  onToggle: () => void;
  tableContent: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border rounded-2xl p-6 shadow-sm flex flex-col justify-between transition-all">
      <div className="space-y-1 pb-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground tracking-tight">{title}</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onToggle}
            className="h-8 gap-1.5 text-xs font-medium"
            aria-pressed={isTable}
          >
            {isTable ? (
              <>
                <BarChart2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>View as chart</span>
              </>
            ) : (
              <>
                <TableIcon className="h-3.5 w-3.5" aria-hidden="true" />
                <span>View as table</span>
              </>
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      </div>

      <div className="mt-4 flex-1">
        {isTable ? <div className="mt-2">{tableContent}</div> : children}
      </div>
    </div>
  );
}

function AccessibleTable({
  caption,
  headers,
  rows,
}: {
  caption: string;
  headers: string[];
  rows: (string | number)[][];
}) {
  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground py-8 text-center">No rows to display.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-xs">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-muted/60 text-muted-foreground border-b uppercase font-semibold text-[11px]">
          <tr>
            {headers.map((h, i) => (
              <th
                key={h}
                scope="col"
                className={`px-3 py-2.5 ${i > 1 ? "text-center" : ""}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row, idx) => (
            <tr key={idx} className="hover:bg-muted/30 transition-colors">
              {row.map((cell, cIdx) => (
                <td
                  key={cIdx}
                  className={`px-3 py-2.5 text-foreground ${
                    cIdx === 0 ? "font-medium" : ""
                  } ${cIdx > 1 ? "text-center" : ""}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NoCardData({ message }: { message: string }) {
  return (
    <div className="h-64 flex flex-col items-center justify-center text-center p-6 space-y-2">
      <FileText className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  );
}
