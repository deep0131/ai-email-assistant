"use client";

import React, { useEffect, useRef } from "react";
import { Paperclip, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { formatFileSize } from "@/lib/utils";
import { ChatMessage } from "@/lib/types";
import { WorkflowCard } from "@/components/workflow/workflow-card";

export type { AttachedFileMeta as MessageAttachment } from "@/lib/types";
export type MessageItem = ChatMessage;

interface ChatAreaProps {
  messages?: ChatMessage[];
  isLoading?: boolean;
  onSelectPrompt?: (prompt: string) => void;
  onApprove?: () => void;
  onReject?: () => void;
  onResume?: (value: string) => void;
}

export function ChatArea({
  messages = [],
  isLoading = false,
  onSelectPrompt,
  onApprove,
  onReject,
  onResume,
}: ChatAreaProps) {
  const scrollEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex-1 flex flex-col justify-center overflow-y-auto">
        <EmptyState onSelectPrompt={onSelectPrompt} />
      </div>
    );
  }

  return (
    <div
      className="flex-1 overflow-y-auto px-3 sm:px-4 py-6"
      role="log"
      aria-live="polite"
      aria-label="Conversation with AI Email Assistant"
    >
      <div className="max-w-3xl mx-auto space-y-6">
        {messages.map((msg, index) => {
          const isLatest = index === messages.length - 1;

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.role === "user" ? "items-end" : "items-start w-full"
              }`}
            >
              <div
                className={`rounded-2xl text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "max-w-[85%] sm:max-w-[75%] px-4 py-3 bg-zinc-800 text-zinc-100 border border-zinc-700/60 space-y-2.5"
                    : "w-full max-w-full sm:max-w-3xl px-4 sm:px-5 py-4 bg-zinc-900/90 text-zinc-200 border border-zinc-800 shadow-md space-y-3"
                }`}
              >
                {/* Attached files chips for user messages */}
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

                {/* Plain text content */}
                {msg.content && (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}

                {/* Structured workflow response */}
                {msg.workflowResponse && (
                  <WorkflowCard
                    response={msg.workflowResponse}
                    isLatest={isLatest}
                    onApprove={onApprove}
                    onReject={onReject}
                    onResume={onResume}
                    isLoading={isLoading}
                  />
                )}
              </div>
            </div>
          );
        })}

        {/* Loading bubble */}
        {isLoading && (
          <div className="flex flex-col items-start">
            <div className="rounded-2xl px-4 py-3 bg-zinc-900/90 border border-zinc-800 text-sm text-zinc-400 flex items-center gap-2.5">
              <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
              <span>AI Email Assistant is executing workflow...</span>
            </div>
          </div>
        )}

        <div ref={scrollEndRef} />
      </div>
    </div>
  );
}
