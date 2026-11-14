"use client";

import { useState, useId } from "react";
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
  TrendingDown,
  TrendingUp,
  FileText,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  BrokenRule,
  RepeatMistakeStat,
  RuleRejectionRate,
  PeriodTrend,
} from "@/lib/insights/compute";

interface InsightsDashboardProps {
  range: "7d" | "30d" | "all";
  companyName: string;
  role: string;
  brokenRules: BrokenRule[];
  repeatStats: RepeatMistakeStat[];
  rejectionRatesData: RuleRejectionRate[];
  trendData: PeriodTrend[];
  totalSubmissions: number;
  totalFindings: number;
}

export function InsightsDashboardClient({
  range,
  companyName,
  role,
  brokenRules,
  repeatStats,
  rejectionRatesData,
  trendData,
  totalSubmissions,
  totalFindings,
}: InsightsDashboardProps) {
  const [viewTable, setViewTable] = useState<Record<string, boolean>>({
    brokenRules: false,
    repeatMistakes: false,
    rejectionRates: false,
    trend: false,
  });

  const toggleView = (key: string) => {
    setViewTable((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const hasData = totalSubmissions > 0 || totalFindings > 0;

  // Rules with at least 5 decided findings (for Card C)
  const eligibleRejectionRules = rejectionRatesData.filter((r) => r.decided >= 5);
  const unclearRules = eligibleRejectionRules.filter((r) => r.possibly_unclear);

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
