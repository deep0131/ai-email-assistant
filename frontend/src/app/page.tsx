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
  detail?: string | null;
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
  const [referenceFiles, setReferenceFiles] = useState<File[]>([]);
  const [emailAttachments, setEmailAttachments] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const handleSubmit = async () => {
    const prompt = promptText.trim();

    if (
      isLoading ||
      (!prompt && referenceFiles.length === 0 && emailAttachments.length === 0)
    ) {
      return;
    }

    const selectedFileSummary = [
      referenceFiles.length > 0
        ? `Reference files: ${referenceFiles.map((file) => file.name).join(", ")}`
        : "",
      emailAttachments.length > 0
        ? `Email attachments: ${emailAttachments.map((file) => file.name).join(", ")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    setIsLoading(true);

    setMessages((current) => [
      ...current,
      {
        id: createMessageId(),
        role: "user",
        content: prompt,
        referenceFiles: referenceFiles.map((file) => file.name),
        emailAttachments: emailAttachments.map((file) => file.name),
      },
    ]);

    const formData = new FormData();
    formData.append("prompt", prompt);

    referenceFiles.forEach((file) => {
      formData.append("reference_files", file);
    });

    emailAttachments.forEach((file) => {
      formData.append("email_attachments", file);
    });

    try {
      const result = await fetch("http://localhost:8000/api/workflow", {
        method: "POST",
        body: formData,
      });

      const data: WorkflowResponse = await result.json();

      if (!result.ok) {
        throw new Error(data.detail || data.error || "Unable to generate the email.");
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
      setPromptText("");
      setReferenceFiles([]);
      setEmailAttachments([]);
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
          referenceFiles={referenceFiles}
          onReferenceFilesChange={setReferenceFiles}
          emailAttachments={emailAttachments}
          onEmailAttachmentsChange={setEmailAttachments}
          onSubmit={handleSubmit}
          isLoading={isLoading}
          placeholder="Ask AI Email Assistant to draft an email..."
        />
      </main>
    </div>
  );
}
