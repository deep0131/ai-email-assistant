"use client";

import { useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { PromptComposer } from "@/components/prompt-composer";
import { ChatMessages } from "@/components/chat-messages";

interface EmailDraft {
  assistant_message?: string;
  subject: string;
  body: string;
  to: Array<{
    name?: string | null;
    email?: string | null;
  }>;
}

interface WorkflowResponse {
  status?: string;
  clarification_question?: string | null;
  draft?: EmailDraft | null;
  error?: string | null;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content?: string;
  draft?: EmailDraft;
}

function createMessageId() {
  return `${Date.now()}-${Math.random()}`;
}

export default function Home() {
  const [promptText, setPromptText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const handleSubmit = async () => {
    const prompt = promptText.trim();

    if (isLoading || (!prompt && selectedFiles.length === 0)) {
      return;
    }

    setIsLoading(true);

    setMessages((current) => [
      ...current,
      {
        id: createMessageId(),
        role: "user",
        content: prompt || "Please use the uploaded files.",
      },
    ]);

    const formData = new FormData();
    formData.append("prompt", prompt);

    selectedFiles.forEach((file) => {
      formData.append("files", file);
    });

    try {
      const result = await fetch("http://localhost:8000/api/workflow", {
        method: "POST",
        body: formData,
      });

      const data: WorkflowResponse = await result.json();

      if (!result.ok) {
        throw new Error(data.error || "Unable to generate the email.");
      }

      const needsClarification = Boolean(data.clarification_question);

      setMessages((current) => [
        ...current,
        {
          id: createMessageId(),
          role: "assistant",
          content:
            data.clarification_question ||
            data.draft?.assistant_message ||
            data.error ||
            "Waiting for the email to be generated...",
          draft: needsClarification ? undefined : data.draft ?? undefined,
        },
      ]);

      setPromptText("");
      setSelectedFiles([]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: createMessageId(),
          role: "assistant",
          content: "Sorry, I'm unable to generate the email.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full flex-col bg-background text-zinc-100 font-sans">
      <main className="relative flex min-h-0 flex-1 flex-col">
        <div className="flex flex-1 flex-col overflow-y-auto">
          {messages.length === 0 ? (
            <EmptyState />
          ) : (
            <ChatMessages messages={messages} />
          )}
        </div>

        <PromptComposer
          prompt={promptText}
          onPromptChange={setPromptText}
          files={selectedFiles}
          onFilesChange={setSelectedFiles}
          onSubmit={handleSubmit}
          isLoading={isLoading}
          placeholder="Ask AI Email Assistant to draft an email..."
        />
      </main>
    </div>
  );
}
