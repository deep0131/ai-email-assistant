import React from "react";
import { Paperclip, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { formatFileSize } from "@/lib/utils";

export interface MessageAttachment {
  name: string;
  size: number;
}

export interface MessageItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  files?: MessageAttachment[];
  timestamp?: string;
}

interface ChatAreaProps {
  messages?: MessageItem[];
  isLoading?: boolean;
  onSelectPrompt?: (prompt: string) => void;
}

export function ChatArea({
  messages = [],
  isLoading = false,
  onSelectPrompt,
}: ChatAreaProps) {
  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex-1 flex flex-col justify-center overflow-y-auto">
        <EmptyState onSelectPrompt={onSelectPrompt} />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.role === "user" ? "items-end" : "items-start"
            }`}
          >
            <div
              className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed space-y-2.5 ${
                msg.role === "user"
                  ? "bg-zinc-800 text-zinc-100 border border-zinc-700/60"
                  : "bg-zinc-900/90 text-zinc-200 border border-zinc-800"
              }`}
            >
              {/* Attached files chips */}
              {msg.files && msg.files.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pb-1">
                  {msg.files.map((file, i) => (
                    <div
                      key={`${file.name}-${i}`}
                      className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900/80 px-2 py-1 text-xs text-zinc-300 border border-zinc-700/50"
                      title={`${file.name} (${formatFileSize(file.size)})`}
                    >
                      <Paperclip className="h-3 w-3 text-zinc-400" />
                      <span className="max-w-[140px] truncate">{file.name}</span>
                      <span className="text-[10px] text-zinc-500">
                        {formatFileSize(file.size)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {msg.content && <p className="whitespace-pre-wrap">{msg.content}</p>}
            </div>
          </div>
        ))}

        {/* Loading bubble */}
        {isLoading && (
          <div className="flex flex-col items-start">
            <div className="rounded-2xl px-4 py-3 bg-zinc-900/90 border border-zinc-800 text-sm text-zinc-400 flex items-center gap-2.5">
              <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
              <span>AI Email Assistant is analyzing your request...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
