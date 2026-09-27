import React from "react";
import { EmptyState } from "@/components/empty-state";

export interface MessageItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

interface ChatAreaProps {
  messages?: MessageItem[];
  onSelectPrompt?: (prompt: string) => void;
}

export function ChatArea({ messages = [], onSelectPrompt }: ChatAreaProps) {
  if (messages.length === 0) {
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
              className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-zinc-800 text-zinc-100 border border-zinc-700/60"
                  : "bg-zinc-900/90 text-zinc-200 border border-zinc-800"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
