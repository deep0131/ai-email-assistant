import React from "react";
import { Paperclip, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface PromptComposerShellProps {
  value?: string;
  onChange?: (val: string) => void;
  onSubmit?: () => void;
}

export function PromptComposerShell({
  value = "",
  onChange,
  onSubmit,
}: PromptComposerShellProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit?.();
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-4">
      <div className="relative flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/90 shadow-lg transition-all focus-within:border-zinc-700 focus-within:ring-1 focus-within:ring-zinc-700">
        <Textarea
          placeholder="Ask AI Email Assistant to draft or reply to an email..."
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          onKeyDown={handleKeyDown}
          className="min-h-[56px] max-h-48 border-0 bg-transparent px-4 pt-3.5 pb-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none"
        />

        <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              title="Attach files (coming in Phase 2)"
            >
              <Paperclip className="h-4 w-4" />
              <span className="sr-only">Attach files</span>
            </Button>
          </div>

          <Button
            type="button"
            size="icon"
            onClick={onSubmit}
            disabled={!value.trim()}
            className="h-8 w-8 rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 disabled:opacity-30 disabled:hover:bg-white transition-opacity"
            title="Send prompt"
          >
            <ArrowUp className="h-4 w-4 stroke-[2.5]" />
            <span className="sr-only">Send prompt</span>
          </Button>
        </div>
      </div>

      <p className="mt-2 text-center text-[11px] text-zinc-500">
        AI Email Assistant drafts emails with Gemini. User approval is always required before sending.
      </p>
    </div>
  );
}
