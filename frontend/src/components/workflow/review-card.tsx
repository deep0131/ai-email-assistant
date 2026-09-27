import React from "react";
import { ReviewResponse } from "@/lib/types";
import { ShieldCheck, ShieldAlert, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ReviewCardProps {
  review: ReviewResponse;
}

export function ReviewCard({ review }: ReviewCardProps) {
  const isPass = review.decision === "PASS";

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3.5 space-y-3">
      {/* Reviewer Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isPass ? (
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
          ) : (
            <ShieldAlert className="h-4 w-4 text-rose-400" />
          )}
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
            Reviewer Agent Evaluation
          </span>
        </div>
        <Badge
          variant="outline"
          className={
            isPass
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-xs font-medium"
              : "border-rose-500/40 bg-rose-500/10 text-rose-300 text-xs font-medium"
          }
        >
          {review.decision}
          {typeof review.score === "number" && ` (${Math.round(review.score * 100)}%)`}
        </Badge>
      </div>

      {/* Summary */}
      {review.summary && (
        <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800/60">
          {review.summary}
        </p>
      )}

      {/* Issues if any */}
      {review.issues && review.issues.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="text-[11px] font-semibold text-rose-400 flex items-center gap-1 uppercase tracking-wide">
            <AlertTriangle className="h-3 w-3" />
            Detected Issues
          </div>
          <ul className="space-y-1 pl-1">
            {review.issues.map((issue, idx) => (
              <li
                key={idx}
                className="text-xs text-zinc-400 flex items-start gap-1.5"
              >
                <span className="text-rose-400/80 font-bold">•</span>
                <span>{issue}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
