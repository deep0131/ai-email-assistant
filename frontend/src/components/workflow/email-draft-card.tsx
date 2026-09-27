import React from "react";
import { EmailDraft } from "@/lib/types";
import { Mail, Paperclip, User, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface EmailDraftCardProps {
  draft: EmailDraft;
  draftId?: string | null;
}

export function EmailDraftCard({ draft, draftId }: EmailDraftCardProps) {
  const recipients = draft.to || [];

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 space-y-4">
      {/* Header Info */}
      <div className="space-y-2 border-b border-zinc-800/80 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            <Mail className="h-3.5 w-3.5 text-zinc-400" />
            Generated Email Draft
          </div>
          {draftId && (
            <Badge variant="outline" className="text-[10px] text-zinc-400 border-zinc-800 font-mono">
              Draft ID: {draftId.slice(0, 12)}...
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
                className="inline-flex items-center gap-1 rounded bg-zinc-900 px-2 py-0.5 text-zinc-200 border border-zinc-800"
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
          <span className="text-sm font-semibold text-zinc-100">
            {draft.subject || "(No Subject)"}
          </span>
        </div>
      </div>

      {/* Body content */}
      <div className="space-y-1.5">
        <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          Message Body
        </div>
        <div className="rounded-lg bg-zinc-900/90 border border-zinc-800/80 p-3.5 text-sm text-zinc-200 font-sans leading-relaxed whitespace-pre-wrap selection:bg-zinc-800">
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
                className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-2.5 py-1 text-xs text-zinc-200 border border-zinc-800"
              >
                <Paperclip className="h-3.5 w-3.5 text-zinc-400" />
                <span className="font-medium">{att.filename}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
