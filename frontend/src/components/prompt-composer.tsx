"use client";

import { useRef, type ChangeEvent } from "react";
import { ArrowUp, Loader2, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface PromptComposerProps {
  prompt: string;
  onPromptChange: (value: string) => void;
  referenceFiles: File[];
  onReferenceFilesChange: (files: File[]) => void;
  emailAttachments: File[];
  onEmailAttachmentsChange: (files: File[]) => void;
  onSubmit: () => void;
  isLoading?: boolean;
  placeholder?: string;
}

export function PromptComposer({
  prompt,
  onPromptChange,
  referenceFiles,
  onReferenceFilesChange,
  emailAttachments,
  onEmailAttachmentsChange,
  onSubmit,
  isLoading = false,
  placeholder = "Ask AI Email Assistant to draft an email...",
}: PromptComposerProps) {
  const referenceInputRef = useRef<HTMLInputElement>(null);
  const emailAttachmentInputRef = useRef<HTMLInputElement>(null);

  const canSubmit =
    !isLoading &&
    (prompt.trim().length > 0 || referenceFiles.length > 0 || emailAttachments.length > 0);

  const handleFiles = (
    event: ChangeEvent<HTMLInputElement>,
    currentFiles: File[],
    onChange: (files: File[]) => void,
    inputRef: React.RefObject<HTMLInputElement | null>,
  ) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    onChange([...currentFiles, ...selectedFiles]);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const removeFile = (
    index: number,
    currentFiles: File[],
    onChange: (files: File[]) => void,
  ) => {
    onChange(currentFiles.filter((_, fileIndex) => fileIndex !== index));
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (canSubmit) onSubmit();
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-4">
      <input
        ref={referenceInputRef}
        type="file"
        multiple
        hidden
        accept=".pdf,.txt,.md,.csv,.png,.jpg,.jpeg"
        onChange={(event) =>
          handleFiles(event, referenceFiles, onReferenceFilesChange, referenceInputRef)
        }
      />
      <input
        ref={emailAttachmentInputRef}
        type="file"
        multiple
        hidden
        accept=".pdf,.txt,.md,.csv,.png,.jpg,.jpeg"
        onChange={(event) =>
          handleFiles(event, emailAttachments, onEmailAttachmentsChange, emailAttachmentInputRef)
        }
      />

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 shadow-xl">
        {(referenceFiles.length > 0 || emailAttachments.length > 0) && (
          <div className="flex flex-wrap gap-2 border-b border-zinc-800 p-3">
            {referenceFiles.map((file, index) => (
              <div
                key={`reference-${file.name}-${index}`}
                className="flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
                title={`Reference file: ${file.name}`}
              >
                <span className="text-zinc-500">Reference:</span>
                <span className="max-w-40 truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(index, referenceFiles, onReferenceFilesChange)}
                  disabled={isLoading}
                  aria-label={`Remove reference file ${file.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {emailAttachments.map((file, index) => (
              <div
                key={`email-attachment-${file.name}-${index}`}
                className="flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
                title={`Email attachment: ${file.name}`}
              >
                <span className="text-zinc-500">Attach:</span>
                <span className="max-w-40 truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(index, emailAttachments, onEmailAttachmentsChange)}
                  disabled={isLoading}
                  aria-label={`Remove email attachment ${file.name}`}
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
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => referenceInputRef.current?.click()}
              disabled={isLoading}
              aria-label="Add reference files"
            >
              <Paperclip className="mr-1.5 h-4 w-4 text-[#29bf12]/70" />
              Reference files
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => emailAttachmentInputRef.current?.click()}
              disabled={isLoading}
              aria-label="Add email attachments"
            >
              <Paperclip className="mr-1.5 h-4 w-4 text-[#f7b801]/80" />
              Email attachments
            </Button>
          </div>

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
