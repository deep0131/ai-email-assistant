"use client";

import React, { useState } from "react";
import { EmailDraft } from "@/lib/types";
import { Mail, Paperclip, User, Tag, Copy, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface EmailDraftCardProps {
  draft: EmailDraft;
  draftId?: string | null;
}

export function EmailDraftCard({ draft, draftId }: EmailDraftCardProps) {
  const [copied, setCopied] = useState(false);
  const recipients = draft.to || [];

  const handleCopyBody = async () => {
    if (!draft.body) return;
    try {
      await navigator.clipboard.writeText(draft.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API is restricted
      const textarea = document.createElement("textarea");
      textarea.value = draft.body;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 space-y-4 shadow-sm"
      role="region"
      aria-label="Email Draft Preview"
    >
      {/* Header Info */}
      <div className="space-y-2 border-b border-zinc-800/80 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            <Mail className="h-3.5 w-3.5 text-zinc-400" />
            Generated Email Draft
          </div>
          {draftId && (
            <Badge
              variant="outline"
              className="text-[10px] text-zinc-400 border-zinc-800 font-mono"
              title={`Gmail Draft ID: ${draftId}`}
            >
              Draft ID: {draftId.slice(0, 14)}...
            </Badge>
          )}
        </div>

        {/* Recipients */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
          <span className="text-zinc-500 font-medium flex items-center gap-1">
            <User className="h-3 w-3" /> To:
          </span>
          {recipients.length > 0 ? (
            recipients.map((r, i) => (
              <span
                key={`${r.email || r.name}-${i}`}
                className="inline-flex items-center gap-1 rounded bg-zinc-900 px-2 py-0.5 text-zinc-200 border border-zinc-800/80"
              >
                {r.name && <span className="font-medium text-white">{r.name}</span>}
                {r.email && (
                  <span className="text-zinc-400 text-[11px]">&lt;{r.email}&gt;</span>
                )}
              </span>
            ))
          ) : (
            <span className="text-zinc-500 italic">No recipient specified</span>
          )}
        </div>

        {/* Subject */}
        <div className="flex items-baseline gap-2 pt-1">
          <span className="text-xs font-medium text-zinc-500 flex items-center gap-1">
            <Tag className="h-3 w-3" /> Subject:
          </span>
          <span className="text-sm font-semibold text-zinc-100 selection:bg-zinc-800">
            {draft.subject || "(No Subject)"}
          </span>
        </div>
      </div>

      {/* Body content */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            Message Body
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCopyBody}
            className="h-6 px-2 text-[11px] text-zinc-400 hover:text-white hover:bg-zinc-800 gap-1 rounded"
            title="Copy email body to clipboard"
            aria-label={copied ? "Copied to clipboard" : "Copy email body to clipboard"}
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>Copy Body</span>
              </>
            )}
          </Button>
        </div>

        <div className="rounded-lg bg-zinc-900/90 border border-zinc-800/80 p-3.5 text-sm text-zinc-200 font-sans leading-relaxed whitespace-pre-wrap selection:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-700">
          {draft.body}
        </div>
      </div>

      {/* Attachments */}
      {draft.attachments && draft.attachments.length > 0 && (
        <div className="pt-2 border-t border-zinc-800/80 space-y-2">
          <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
            <Paperclip className="h-3 w-3 text-zinc-400" />
            Attachments ({draft.attachments.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {draft.attachments.map((att) => (
              <div
                key={att.attachment_id}
                className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-2.5 py-1 text-xs text-zinc-200 border border-zinc-800 shadow-sm"
              >
                <Paperclip className="h-3.5 w-3.5 text-zinc-400" />
                <span className="font-medium truncate max-w-[200px]">{att.filename}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
