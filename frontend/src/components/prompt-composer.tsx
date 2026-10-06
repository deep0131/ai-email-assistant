"use client";

import React, { useRef, useEffect, useMemo } from "react";
import {
  Paperclip,
  ArrowUp,
  X,
  FileText,
  FileCode,
  FileArchive,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatFileSize } from "@/lib/utils";

export interface PromptComposerProps {
  prompt: string;
  onPromptChange: (value: string) => void;
  files: File[];
  onFilesChange: (files: File[]) => void;
  onSubmit: () => void;
  isLoading?: boolean;
  placeholder?: string;
}

// Subcomponent for individual attachment preview with thumbnail support
function AttachmentPreviewItem({
  file,
  onRemove,
  disabled,
}: {
  file: File;
  onRemove: () => void;
  disabled: boolean;
}) {
  const isImage = file.type.startsWith("image/");
  const previewUrl = useMemo(() => {
    if (!isImage) return null;
    return URL.createObjectURL(file);
  }, [file, isImage]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const fileIcon = useMemo(() => {
    if (isImage) return <ImageIcon className="h-3.5 w-3.5 text-sky-400 shrink-0" />;
    const name = file.name.toLowerCase();
    if (name.endsWith(".zip") || name.endsWith(".tar") || name.endsWith(".gz")) {
      return <FileArchive className="h-3.5 w-3.5 text-amber-400 shrink-0" />;
    }
    if (name.endsWith(".json") || name.endsWith(".ts") || name.endsWith(".js") || name.endsWith(".py")) {
      return <FileCode className="h-3.5 w-3.5 text-emerald-400 shrink-0" />;
    }
    return <FileText className="h-3.5 w-3.5 text-zinc-400 shrink-0" />;
  }, [file.name, isImage]);

  return (
    <div
      className="group relative flex items-center gap-2 rounded-lg bg-zinc-800/90 pl-1.5 pr-2 py-1 text-xs text-zinc-200 border border-zinc-700/60 transition-colors hover:border-zinc-600 focus-within:ring-1 focus-within:ring-zinc-500"
      title={`${file.name} (${formatFileSize(file.size)})`}
    >
      {/* Thumbnail preview for images */}
      {isImage && previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt={file.name}
          className="h-6 w-6 rounded object-cover border border-zinc-700/80 shrink-0"
        />
      ) : (
        <span className="p-0.5">{fileIcon}</span>
      )}

      <div className="flex flex-col min-w-0 max-w-[140px] sm:max-w-[200px]">
        <span className="truncate font-medium text-zinc-100">{file.name}</span>
        <span className="text-[10px] text-zinc-400 tabular-nums">
          {formatFileSize(file.size)}
        </span>
      </div>

      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        className="rounded-full p-1 text-zinc-400 hover:text-white hover:bg-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-400 disabled:opacity-40 transition-colors ml-0.5"
        aria-label={`Remove attachment ${file.name}`}
        title={`Remove ${file.name}`}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

export function PromptComposer({
  prompt,
  onPromptChange,
  files,
  onFilesChange,
  onSubmit,
  isLoading = false,
  placeholder = "Ask AI Email Assistant to draft or reply to an email...",
}: PromptComposerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && (prompt.trim().length > 0 || files.length > 0)) {
        onSubmit();
      }
    }
  };

  const handleFileClick = () => {
    if (isLoading) return;
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected || selected.length === 0) return;

    const newFiles = Array.from(selected);
    const existingKeys = new Set(files.map((f) => `${f.name}-${f.size}`));
    const deduplicated = newFiles.filter(
      (f) => !existingKeys.has(`${f.name}-${f.size}`)
    );

    if (deduplicated.length > 0) {
      onFilesChange([...files, ...deduplicated]);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveFile = (indexToRemove: number) => {
    if (isLoading) return;
    onFilesChange(files.filter((_, idx) => idx !== indexToRemove));
  };

  const canSubmit = !isLoading && (prompt.trim().length > 0 || files.length > 0);

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-4">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileSelect}
        aria-label="Upload file attachments"
        tabIndex={-1}
      />

      <div
        className="relative flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/90 shadow-xl transition-all focus-within:border-zinc-700 focus-within:ring-1 focus-within:ring-zinc-700"
        role="region"
        aria-label="Prompt and attachment composer"
      >
        {/* Selected files preview tray */}
        {files.length > 0 && (
          <div
            className="flex flex-wrap gap-2 px-3 pt-3 pb-1 border-b border-zinc-800/80"
            role="list"
            aria-label="Attached files"
          >
            {files.map((file, idx) => (
              <AttachmentPreviewItem
                key={`${file.name}-${file.size}-${idx}`}
                file={file}
                onRemove={() => handleRemoveFile(idx)}
                disabled={isLoading}
              />
            ))}
          </div>
        )}

        {/* Multiline textarea */}
        <Textarea
          placeholder={placeholder}
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          rows={1}
          aria-label="Email assistant prompt"
          className="min-h-[56px] max-h-48 border-0 bg-transparent px-4 pt-3.5 pb-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none disabled:opacity-50"
        />

        {/* Action bar */}
        <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleFileClick}
              disabled={isLoading}
              className="h-8 w-8 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
              title="Add attachment"
              aria-label="Add file attachment"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            {files.length > 0 && (
              <span
                className="text-xs text-zinc-500 font-mono"
                aria-live="polite"
              >
                {files.length} {files.length === 1 ? "file" : "files"}
              </span>
            )}
          </div>

          <Button
            type="button"
            size="icon"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="h-8 w-8 rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 disabled:opacity-30 disabled:hover:bg-white transition-opacity"
            title={isLoading ? "Processing..." : "Send prompt"}
            aria-label={isLoading ? "Processing prompt" : "Send prompt"}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin stroke-[2.5]" />
            ) : (
              <ArrowUp className="h-4 w-4 stroke-[2.5]" />
            )}
          </Button>
        </div>
      </div>

      <p className="mt-2 text-center text-[11px] text-zinc-500">
        AI Email Assistant drafts emails with Gemini. User approval is always required before sending.
      </p>
    </div>
  );
}
