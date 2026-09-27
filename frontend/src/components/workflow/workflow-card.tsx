"use client";

import React from "react";
import { WorkflowResponse } from "@/lib/types";
import { StatusBadge } from "./status-badge";
import { EmailDraftCard } from "./email-draft-card";
import { ReviewCard } from "./review-card";
import { ClarificationCard } from "./clarification-card";
import { ApprovalCard } from "./approval-card";
import { SendResultCard } from "./send-result-card";
import { AlertCircle, Paperclip } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface WorkflowCardProps {
  response: WorkflowResponse;
  isLatest?: boolean;
  onApprove?: () => void;
  onReject?: () => void;
  onResume?: (value: string) => void;
  isLoading?: boolean;
}

export function WorkflowCard({
  response,
  isLatest = true,
  onApprove,
  onReject,
  onResume,
  isLoading = false,
}: WorkflowCardProps) {
  const isAttachmentQuestion = Boolean(
    response.attachment_decision === "UNCLEAR" ||
      (response.clarification_question &&
        /attach|file/i.test(response.clarification_question))
  );

  return (
    <div className="w-full space-y-4">
      {/* Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          <StatusBadge status={response.status} />
          {response.workflow_thread_id && (
            <span className="text-[11px] font-mono text-zinc-500 hidden sm:inline">
              Thread: {response.workflow_thread_id.slice(0, 8)}
            </span>
          )}
        </div>

        {/* Attachment decision badge if present */}
        {response.attachment_decision && (
          <Badge
            variant="outline"
            className="text-[11px] border-zinc-700/60 bg-zinc-900 text-zinc-300 gap-1"
          >
            <Paperclip className="h-3 w-3 text-zinc-400" />
            Decision: {response.attachment_decision}
          </Badge>
        )}
      </div>

      {/* Backend error display if present */}
      {(response.error || response.detail || response.status === "ERROR") && (
        <div className="rounded-xl border border-red-500/40 bg-red-950/20 p-3.5 text-xs text-red-300 flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <span className="font-semibold uppercase tracking-wider text-red-400">
              Backend Error
            </span>
            <p className="leading-relaxed text-zinc-200">
              {response.error || response.detail || "An unexpected error occurred."}
            </p>
          </div>
        </div>
      )}

      {/* Clarification prompt if waiting for user */}
      {response.status === "WAITING_FOR_USER" &&
        response.clarification_question &&
        isLatest &&
        onResume && (
          <ClarificationCard
            question={response.clarification_question}
            isAttachmentQuestion={isAttachmentQuestion}
            onResume={onResume}
            isLoading={isLoading}
          />
        )}

      {/* If waiting for user but not latest, show the question as read-only */}
      {response.status === "WAITING_FOR_USER" &&
        response.clarification_question &&
        !isLatest && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5 text-xs text-zinc-300 space-y-1">
            <span className="font-semibold text-zinc-400 uppercase tracking-wider">
              Clarification Requested
            </span>
            <p className="text-zinc-200">{response.clarification_question}</p>
          </div>
        )}

      {/* Email Draft Card */}
      {response.draft && (
        <EmailDraftCard draft={response.draft} draftId={response.draft_id} />
      )}

      {/* Review Information Card */}
      {response.review && <ReviewCard review={response.review} />}

      {/* Approval Actions if waiting for approval */}
      {response.status === "WAITING_FOR_APPROVAL" &&
        isLatest &&
        onApprove &&
        onReject && (
          <ApprovalCard
            onApprove={onApprove}
            onReject={onReject}
            isLoading={isLoading}
          />
        )}

      {/* Send Result */}
      {response.send_result && <SendResultCard result={response.send_result} />}
    </div>
  );
}
