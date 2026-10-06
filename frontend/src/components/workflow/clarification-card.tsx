"use client";

import React, { useState } from "react";
import { HelpCircle, ArrowUp, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ClarificationCardProps {
  question: string;
  isAttachmentQuestion?: boolean;
  onResume: (resumeValue: string) => void;
  isLoading?: boolean;
}

export function ClarificationCard({
  question,
  isAttachmentQuestion = false,
  onResume,
  isLoading = false,
}: ClarificationCardProps) {
  const [responseInput, setResponseInput] = useState("");

  const naturalAttachmentResponses = [
    { label: "Yes", value: "yes" },
    { label: "Okay", value: "okay" },
    { label: "Go ahead", value: "go ahead" },
    { label: "No", value: "no" },
    { label: "Send without it", value: "send without it" },
  ];

  const handleSubmit = () => {
    if (isLoading || !responseInput.trim()) return;
    onResume(responseInput.trim());
    setResponseInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="rounded-xl border border-sky-500/30 bg-sky-950/20 p-4 space-y-3.5">
      {/* Question Header */}
      <div className="flex items-start gap-2.5">
        <HelpCircle className="h-4 w-4 text-sky-400 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-sky-400">
            Clarification Needed
          </div>
          <p className="text-sm text-zinc-100 font-medium whitespace-pre-wrap leading-relaxed">
            {question}
          </p>
        </div>
      </div>

      {/* Quick response suggestions for attachment confirmation or natural choices */}
      {isAttachmentQuestion && (
        <div className="space-y-1.5 pt-1">
          <div className="text-[11px] font-medium text-zinc-400 flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-sky-400" />
            Quick responses:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {naturalAttachmentResponses.map((item) => (
              <Button
                key={item.value}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onResume(item.value)}
                disabled={isLoading}
                className="h-7 text-xs bg-zinc-900 border-zinc-700/80 hover:bg-zinc-800 text-zinc-200 hover:text-white"
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Response input composer */}
      <div className="relative flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/90 pt-1 pb-1 px-2 focus-within:border-zinc-700 focus-within:ring-1 focus-within:ring-zinc-700">
        <Textarea
          placeholder="Type your response here... (Enter to send)"
          value={responseInput}
          onChange={(e) => setResponseInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          rows={1}
          className="min-h-[44px] max-h-32 border-0 bg-transparent px-2 pt-2 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none"
        />

        <div className="flex justify-end pt-1 pb-1">
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={isLoading || !responseInput.trim()}
            className="h-7 px-3 text-xs bg-white text-zinc-950 hover:bg-zinc-200 disabled:opacity-40"
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <ArrowUp className="h-3.5 w-3.5 mr-1" />
                Send Response
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
