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
  workflow_thread_id?: string | null;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content?: string;
  draft?: EmailDraft;
  referenceFiles?: string[];
  emailAttachments?: string[];
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
  const [workflowThreadId, setWorkflowThreadId] = useState<string | null>(null);
  const [workflowStatus, setWorkflowStatus] = useState<string | null>(null);

  const handleSubmit = async () => {
    const prompt = promptText.trim();
    const isResuming =
      workflowStatus === "WAITING_FOR_USER" && workflowThreadId !== null;

    if (
      isLoading ||
      (!isResuming &&
        !prompt &&
        referenceFiles.length === 0 &&
        emailAttachments.length === 0)
    ) {
      return;
    }

    setIsLoading(true);

    setMessages((current) => [
      ...current,
      {
        id: createMessageId(),
        role: "user",
        content: prompt,
        referenceFiles: isResuming
          ? []
          : referenceFiles.map((file) => file.name),
        emailAttachments: isResuming
          ? []
          : emailAttachments.map((file) => file.name),
      },
    ]);

    const formData = new FormData();

    if (isResuming) {
      formData.append("workflow_thread_id", workflowThreadId);
      formData.append("resume_value", JSON.stringify({ answer: prompt }));
    } else {
      formData.append("prompt", prompt);

      referenceFiles.forEach((file) => {
        formData.append("reference_files", file);
      });

      emailAttachments.forEach((file) => {
        formData.append("email_attachments", file);
      });

      setWorkflowThreadId(null);
      setWorkflowStatus("IN_PROGRESS");
    }

    try {
      const result = await fetch("http://localhost:8000/api/workflow", {
        method: "POST",
        body: formData,
      });

      const data: WorkflowResponse = await result.json();

      if (!result.ok) {
        throw new Error(
          data.detail || data.error || "Unable to process the workflow.",
        );
      }

      if (data.workflow_thread_id) {
        setWorkflowThreadId(data.workflow_thread_id);
      }

      setWorkflowStatus(data.status ?? null);

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
            "The workflow has been updated.",
          draft: needsClarification ? undefined : data.draft ?? undefined,
        },
      ]);
    } 
    catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: createMessageId(),
          role: "assistant",
          content:
            error instanceof Error
              ? error.message
              : "Sorry, I'm unable to process the workflow.",
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
    <div className="flex h-screen w-full flex-col bg-background font-sans text-zinc-100">
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
          placeholder={
            workflowStatus === "WAITING_FOR_USER"
              ? "Type your answer..."
              : "Ask AI Email Assistant to draft an email..."
          }
        />
      </main>
    </div>
  );
}