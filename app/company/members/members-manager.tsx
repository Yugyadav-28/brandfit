"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  switchMemberRoleAction,
  removeMemberAction,
  regenerateJoinCodeAction,
} from "@/app/actions/members";
import {
  KeyRound,
  RefreshCw,
  UserCheck,
  UserMinus,
  AlertCircle,
  CheckCircle2,
  X,
  Crown,
  Share2,
  Users,
} from "lucide-react";

export interface MemberItem {
  user_id: string;
  role: string;
  display_name: string;
  created_at: string;
}

interface MembersManagerProps {
  companyId: string;
  companyName: string;
  initialJoinCode: string;
  ownerId: string;
  currentUserId: string;
  members: MemberItem[];
}

export function MembersManager({
  companyId,
  companyName,
  initialJoinCode,
  ownerId,
  currentUserId,
  members,
}: MembersManagerProps) {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState(initialJoinCode);
  const [isPending, startTransition] = useTransition();

  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Confirm delete/remove state
  const [removeConfirm, setRemoveConfirm] = useState<{
    userId: string;
    displayName: string;
  } | null>(null);

  // Confirm regenerate code state
  const [regenerateConfirmOpen, setRegenerateConfirmOpen] = useState(false);

  // Switch role handler
  const handleSwitchRole = (targetUserId: string, currentRole: string) => {
    setFeedback(null);
    startTransition(async () => {
      const res = await switchMemberRoleAction(companyId, targetUserId);
      if (res.error) {
        setFeedback({ type: "error", message: res.error });
      } else {
        const newRole = currentRole === "employee" ? "reviewer" : "employee";
        setFeedback({
          type: "success",
          message: `Switched member role to ${newRole}.`,
        });
        router.refresh();
      }
    });
  };

  // Remove member handler
  const handleConfirmRemove = () => {
    if (!removeConfirm) return;
    const { userId, displayName } = removeConfirm;

    setFeedback(null);
    startTransition(async () => {
      const res = await removeMemberAction(companyId, userId);
      if (res.error) {
        setFeedback({ type: "error", message: res.error });
      } else {
        setFeedback({
          type: "success",
          message: `Removed ${displayName} from the company.`,
        });
        setRemoveConfirm(null);
        router.refresh();
      }
    });
  };

  // Regenerate join code handler
  const handleRegenerateCode = () => {
    setFeedback(null);
    startTransition(async () => {
      const res = await regenerateJoinCodeAction(companyId);
      if (res.error) {
        setFeedback({ type: "error", message: res.error });
      } else if (res.newCode) {
        setJoinCode(res.newCode);
        setFeedback({
          type: "success",
          message: `Regenerated new join code: ${res.newCode}. Previous code is no longer valid.`,
        });
        setRegenerateConfirmOpen(false);
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
            <h1 className="text-3xl font-bold tracking-tight">Team Members</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-primary/10 text-primary border border-primary/20">
              {companyName}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Manage your team roles, revoke access, and share your company join code to invite new members.
          </p>
        </div>
      </div>

      {/* Join Code Card */}
      <div className="bg-card border rounded-xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <KeyRound className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block">
              Company Join Code
            </span>
            <span className="font-mono text-2xl font-bold tracking-widest text-foreground">
              {joinCode}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              navigator.clipboard?.writeText(
                `${window.location.origin}/join?code=${joinCode}`,
              );
              setFeedback({
                type: "success",
                message: "Copied join link to clipboard!",
              });
            }}
            className="flex items-center gap-1.5"
          >
            <Share2 className="h-4 w-4" />
            Copy Invite Link
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRegenerateConfirmOpen(true)}
            disabled={isPending}
            className="flex items-center gap-1.5 border-amber-500/40 hover:bg-amber-500/10 hover:border-amber-500 text-amber-700 dark:text-amber-400"
          >
            <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
            Regenerate code
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

      {/* Single member invite helper */}
      {members.length === 1 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-primary/20 bg-primary/5 gap-3 text-sm">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-primary shrink-0" aria-hidden="true" />
            <div>
              <p className="font-medium text-foreground">You are the only member in this workspace</p>
              <p className="text-xs text-muted-foreground">
                Invite employees and reviewers by sharing your 6-character join code or direct invite link.
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              navigator.clipboard?.writeText(
                `${window.location.origin}/join?code=${joinCode}`,
              );
              setFeedback({
                type: "success",
                message: "Copied join link to clipboard!",
              });
            }}
            className="shrink-0 flex items-center gap-1.5 border-primary/30 hover:bg-primary/10"
          >
            <Share2 className="h-3.5 w-3.5" /> Copy invite link
          </Button>
        </div>
      )}

      {/* Members Table */}
      <div className="border rounded-lg bg-card overflow-hidden shadow-sm">
        <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
          <h2 className="font-semibold text-base">Members ({members.length})</h2>
        </div>

        {members.length === 0 ? (
          <div className="p-10 text-center space-y-4">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground mx-auto">
              <Users className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-foreground text-base">No team members yet</p>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Share your join code or copy the invite link so teammates can join.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                navigator.clipboard?.writeText(
                  `${window.location.origin}/join?code=${joinCode}`,
                );
                setFeedback({
                  type: "success",
                  message: "Copied join link to clipboard!",
                });
              }}
              className="inline-flex items-center gap-1.5"
            >
              <Share2 className="h-4 w-4" /> Copy invite link
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/60 text-muted-foreground border-b text-xs uppercase tracking-wider">
              <tr>
                <th scope="col" className="px-6 py-3 font-semibold">
                  Display Name
                </th>
                <th scope="col" className="px-6 py-3 font-semibold w-40">
                  Role
                </th>
                <th scope="col" className="px-6 py-3 font-semibold w-44">
                  Joined Date
                </th>
                <th scope="col" className="px-6 py-3 font-semibold text-right w-64">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {members.map((member) => {
                const isOwner = member.user_id === ownerId;
                const isSelf = member.user_id === currentUserId;

                return (
                  <tr key={member.user_id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">
                          {member.display_name || "Anonymous Member"}
                        </span>
                        {isSelf && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            You
                          </span>
                        )}
                        {isOwner && (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                            <Crown className="h-3 w-3" /> Owner
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      {member.role === "employer" && (
                        <span className="capitalize px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-500/30">
                          Employer
                        </span>
                      )}
                      {member.role === "reviewer" && (
                        <span className="capitalize px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30">
                          Reviewer
                        </span>
                      )}
                      {member.role === "employee" && (
                        <span className="capitalize px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground border">
                          Employee
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-xs text-muted-foreground">
                      {member.created_at
                        ? new Date(member.created_at).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : "—"}
                    </td>

                    <td className="px-6 py-4 text-right">
                      {isOwner ? (
                        <span className="text-xs text-muted-foreground italic">
                          Primary Workspace Owner
                        </span>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          {/* Role switch button */}
                          {member.role === "employee" && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleSwitchRole(member.user_id, member.role)}
                              disabled={isPending}
                              className="text-xs flex items-center gap-1 h-8"
                            >
                              <UserCheck className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                              Make Reviewer
                            </Button>
                          )}

                          {member.role === "reviewer" && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleSwitchRole(member.user_id, member.role)}
                              disabled={isPending}
                              className="text-xs flex items-center gap-1 h-8"
                            >
                              <UserMinus className="h-3.5 w-3.5 text-muted-foreground" />
                              Make Employee
                            </Button>
                          )}

                          {/* Remove button */}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setRemoveConfirm({
                                userId: member.user_id,
                                displayName: member.display_name,
                              })
                            }
                            disabled={isPending}
                            className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-2"
                            aria-label={`Remove ${member.display_name}`}
                          >
                            Remove
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {/* CONFIRM REGENERATE JOIN CODE MODAL */}
      {regenerateConfirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in"
        >
          <div className="bg-card text-card-foreground border rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
              <RefreshCw className="h-6 w-6 shrink-0" />
              <h2 className="text-lg font-bold">Regenerate Join Code?</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to regenerate the join code? The current code{" "}
              <strong className="font-mono font-bold text-foreground">
                {joinCode}
              </strong>{" "}
              will immediately stop working, and a new 6-character code will be generated.
            </p>
            <div className="flex justify-end gap-3 pt-3 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRegenerateConfirmOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleRegenerateCode}
                disabled={isPending}
              >
                {isPending ? "Regenerating..." : "Regenerate Code"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM REMOVE MEMBER MODAL */}
      {removeConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in"
        >
          <div className="bg-card text-card-foreground border rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-destructive">
              <AlertCircle className="h-6 w-6 shrink-0" />
              <h2 className="text-lg font-bold">Confirm Member Removal</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to remove{" "}
              <strong className="text-foreground">
                {removeConfirm.displayName}
              </strong>{" "}
              from this company workspace? They will lose access to all submissions
              and reviews.
            </p>
            <div className="flex justify-end gap-3 pt-3 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRemoveConfirm(null)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleConfirmRemove}
                disabled={isPending}
              >
                {isPending ? "Removing..." : "Remove Member"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
