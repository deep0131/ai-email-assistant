"use client";

import { useRef } from "react";
import { ArrowUp, Loader2, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface PromptComposerProps {
  prompt: string;
  onPromptChange: (value: string) => void;
  files: File[];
  onFilesChange: (files: File[]) => void;
  onSubmit: () => void;
  isLoading?: boolean;
  placeholder?: string;
}

export function PromptComposer({
  prompt,
  onPromptChange,
  files,
  onFilesChange,
  onSubmit,
  isLoading = false,
  placeholder = "Ask AI Email Assistant to draft an email...",
}: PromptComposerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSubmit =
    !isLoading && (prompt.trim().length > 0 || files.length > 0);

  const handleFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    onFilesChange([...files, ...selectedFiles]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, fileIndex) => fileIndex !== index));
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();

      if (canSubmit) {
        onSubmit();
      }
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-4">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        onChange={handleFiles}
      />

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 shadow-xl">
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2 border-b border-zinc-800 p-3">
            {files.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
              >
                <span className="max-w-40 truncate">{file.name}</span>

                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  disabled={isLoading}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <Textarea
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isLoading}
          rows={2}
          className="min-h-[56px] resize-none border-0 bg-transparent px-4 pt-3 text-sm focus-visible:ring-0"
        />

        <div className="flex items-center justify-between px-3 pb-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
          >
            <Paperclip className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            size="icon"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="bg-white text-black hover:bg-zinc-200"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}