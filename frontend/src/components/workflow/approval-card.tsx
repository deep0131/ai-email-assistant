"use client";

import React from "react";
import { Check, X, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ApprovalCardProps {
  onApprove: () => void;
  onReject: () => void;
  isLoading?: boolean;
}

export function ApprovalCard({
  onApprove,
  onReject,
  isLoading = false,
}: ApprovalCardProps) {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 space-y-3.5">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <div className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <Send className="h-3.5 w-3.5" />
            Human Approval Required
          </div>
          <p className="text-xs text-zinc-300">
            Please review the generated email draft and evaluation above. Antigravity will send via Gmail upon confirmation.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 pt-1">
        <Button
          type="button"
          onClick={onApprove}
          disabled={isLoading}
          className="h-9 px-4 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 shadow-sm transition-colors"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4 stroke-[2.5]" />
          )}
          Confirm and Send
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={onReject}
          disabled={isLoading}
          className="h-9 px-4 text-xs font-medium border-rose-500/40 text-rose-300 hover:bg-rose-950/40 hover:text-rose-200 gap-1.5 transition-colors"
        >
          <X className="h-4 w-4" />
          Reject
        </Button>
      </div>
    </div>
  );
}
