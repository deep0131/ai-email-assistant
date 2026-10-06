"use client";

import React, { useState } from "react";
import { WorkflowResponse } from "@/lib/types";
import { StatusBadge } from "./status-badge";
import { EmailDraftCard } from "./email-draft-card";
import { ReviewCard } from "./review-card";
import { ClarificationCard } from "./clarification-card";
import { ApprovalCard } from "./approval-card";
import { SendResultCard } from "./send-result-card";
import {
  AlertCircle,
  Paperclip,
  Code2,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Compass,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
  const [showRawJson, setShowRawJson] = useState(false);
  const [copiedRawJson, setCopiedRawJson] = useState(false);

  const isAttachmentQuestion = Boolean(
    response.attachment_decision === "UNCLEAR" ||
      (response.clarification_question &&
        /attach|file/i.test(response.clarification_question))
  );

  const handleCopyRawJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(response, null, 2));
      setCopiedRawJson(true);
      setTimeout(() => setCopiedRawJson(false), 2000);
    } catch {
      setCopiedRawJson(true);
      setTimeout(() => setCopiedRawJson(false), 2000);
    }
  };

  return (
    <div
      className="w-full space-y-4"
      role="article"
      aria-label={`Workflow update: ${response.status}`}
    >
      {/* Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          <StatusBadge status={response.status} />
          {response.workflow_thread_id && (
            <span
              className="text-[11px] font-mono text-zinc-500 hidden sm:inline"
              title={`LangGraph Memory Thread ID: ${response.workflow_thread_id}`}
            >
              Thread: {response.workflow_thread_id.slice(0, 8)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Intent Action badge */}
          {response.intent && (
            <Badge
              variant="outline"
              className="text-[11px] border-zinc-700/60 bg-zinc-900 text-zinc-300 gap-1 font-mono hidden sm:inline-flex"
              title={`Intent: ${response.intent.action} (${Math.round(
                (response.intent.confidence || 1) * 100
              )}% confidence)`}
            >
              <Compass className="h-3 w-3 text-zinc-400" />
              {response.intent.action}
            </Badge>
          )}

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
      </div>

      {/* Backend error display if present */}
      {(response.error || response.detail || response.status === "ERROR") && (
        <div
          className="rounded-xl border border-red-500/40 bg-red-950/20 p-3.5 text-xs text-red-300 flex items-start gap-2.5"
          role="alert"
          aria-live="assertive"
        >
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

      {/* Expandable Raw Response Details for Debugging */}
      <div className="pt-2 border-t border-zinc-800/60">
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowRawJson((prev) => !prev)}
            className="h-7 px-2 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 gap-1.5 rounded-lg"
            aria-expanded={showRawJson}
            aria-controls={`debug-raw-${response.workflow_thread_id || "resp"}`}
          >
            <Code2 className="h-3.5 w-3.5 text-zinc-400" />
            <span>{showRawJson ? "Hide Debug Data" : "Raw Response Debug"}</span>
            {showRawJson ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </Button>

          {showRawJson && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCopyRawJson}
              className="h-7 px-2 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 gap-1 rounded"
              title="Copy JSON payload"
              aria-label="Copy JSON payload"
            >
              {copiedRawJson ? (
                <>
                  <Check className="h-3 w-3 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  <span>Copy JSON</span>
                </>
              )}
            </Button>
          )}
        </div>

        {showRawJson && (
          <div
            id={`debug-raw-${response.workflow_thread_id || "resp"}`}
            className="mt-2 overflow-x-auto rounded-lg bg-zinc-950 p-3 font-mono text-[11px] leading-relaxed text-zinc-300 border border-zinc-800/80 max-h-64 overflow-y-auto"
            tabIndex={0}
            role="region"
            aria-label="Raw JSON Response Debug Block"
          >
            <pre>{JSON.stringify(response, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
