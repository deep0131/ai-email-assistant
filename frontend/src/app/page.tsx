"use client";

import React, { useState } from "react";
import { Header } from "@/components/header";
import { ChatArea, MessageItem } from "@/components/chat-area";
import { PromptComposer } from "@/components/prompt-composer";
import { prepareWorkflowFormData } from "@/lib/api";

export default function Home() {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [promptText, setPromptText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSelectPrompt = (selectedText: string) => {
    setPromptText(selectedText);
  };

  const handleClearChat = () => {
    setMessages([]);
    setPromptText("");
    setSelectedFiles([]);
  };

  const handleSubmit = async () => {
    // Prevent duplicate or empty submissions
    if (isLoading) return;
    const trimmed = promptText.trim();
    if (!trimmed && selectedFiles.length === 0) return;

    setIsLoading(true);

    // Prepare FormData containing prompt and files
    const formData = prepareWorkflowFormData({
      prompt: trimmed,
      files: selectedFiles,
    });

    const fileAttachments = selectedFiles.map((f) => ({
      name: f.name,
      size: f.size,
    }));

    // Record user message
    const userMessage: MessageItem = {
      id: Date.now().toString(),
      role: "user",
      content: trimmed,
      files: fileAttachments,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setPromptText("");
    setSelectedFiles([]);

    // Verify prepared FormData structure and demonstrate loading state
    // In Phase 3, this will call POST /api/workflow
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));

      const fileCount = formData.getAll("files").length;
      const fileSummary =
        fileCount > 0
          ? ` with ${fileCount} attached ${fileCount === 1 ? "file" : "files"}`
          : "";

      const assistantMsg: MessageItem = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Prompt received${fileSummary}. FormData prepared successfully with 'prompt' and 'files'.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full flex-col bg-[#0d0d0e] text-zinc-100 font-sans">
      <Header onClearChat={handleClearChat} />
      <main className="flex-1 flex flex-col min-h-0 relative">
        <ChatArea
          messages={messages}
          isLoading={isLoading}
          onSelectPrompt={handleSelectPrompt}
        />
        <PromptComposer
          prompt={promptText}
          onPromptChange={setPromptText}
          files={selectedFiles}
          onFilesChange={setSelectedFiles}
          onSubmit={handleSubmit}
          isLoading={isLoading}
        />
      </main>
    </div>
  );
}
