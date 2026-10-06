import React from "react";
import { SendResult } from "@/lib/types";
import { CheckCircle2, AlertCircle, Send, Hash } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SendResultCardProps {
  result: SendResult;
}

export function SendResultCard({ result }: SendResultCardProps) {
  const isSent = result.status === "SENT";

  return (
    <div
      className={`rounded-xl border p-4 space-y-2.5 ${
        isSent
          ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-200"
          : "border-zinc-800 bg-zinc-950/50 text-zinc-300"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-medium text-sm">
          {isSent ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          ) : (
            <AlertCircle className="h-4 w-4 text-amber-400" />
          )}
          <span>{isSent ? "Email Sent Successfully" : `Status: ${result.status}`}</span>
        </div>
        <Badge
          variant="outline"
          className={
            isSent
              ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-300 font-mono text-[11px]"
              : "border-zinc-700 bg-zinc-800 text-zinc-300 font-mono text-[11px]"
          }
        >
          {result.status}
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
        {result.message_id && (
          <div className="flex items-center gap-1.5 font-mono text-zinc-400 bg-zinc-900/60 p-2 rounded border border-zinc-800/80">
            <Send className="h-3 w-3 text-zinc-500 shrink-0" />
            <span className="truncate">Msg ID: {result.message_id}</span>
          </div>
        )}
        {result.thread_id && (
          <div className="flex items-center gap-1.5 font-mono text-zinc-400 bg-zinc-900/60 p-2 rounded border border-zinc-800/80">
            <Hash className="h-3 w-3 text-zinc-500 shrink-0" />
            <span className="truncate">Thread ID: {result.thread_id}</span>
          </div>
        )}
      </div>

      {result.detail && (
        <p className="text-xs text-zinc-400 pt-1">{result.detail}</p>
      )}
    </div>
  );
}
