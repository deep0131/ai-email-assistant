"use client";

import { useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { PromptComposer } from "@/components/prompt-composer";

export default function Home() {
  const [promptText, setPromptText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  return (
    <div className="flex h-screen w-full flex-col bg-background text-zinc-100 font-sans">
      <main className="flex-1 flex flex-col min-h-0 relative">
        <div className="flex-1 flex flex-col justify-center overflow-y-auto">
          <EmptyState />
        </div>
        <PromptComposer
          prompt={promptText}
          onPromptChange={setPromptText}
          files={selectedFiles}
          onFilesChange={setSelectedFiles}
          onSubmit={() => undefined}
          placeholder="Ask AI Email Assistant to draft an email..."
        />
      </main>
    </div>
  );
}
