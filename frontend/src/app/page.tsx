"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { PromptComposer } from "@/components/prompt-composer";
import { ChatMessages } from "@/components/chat-messages";
import type { ApprovalAction } from "@/components/email-draft-card";

type ResumeValue = { answer: string } | ApprovalAction;
type GmailConnectionStatus = "checking" | "connected" | "disconnected" | "unavailable";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
).replace(/\/$/, "");

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
  const [gmailStatus, setGmailStatus] = useState<GmailConnectionStatus>("checking");
  const [gmailEmail, setGmailEmail] = useState<string | null>(null);
  const [gmailNotice, setGmailNotice] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    const query = new URLSearchParams(window.location.search);
    const oauthResult = query.get("gmail");
    const oauthMessage = query.get("message");

    if (oauthResult) {
      window.history.replaceState({}, "", window.location.pathname);
    }

    const checkGmailConnection = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/gmail/status`, {
          cache: "no-store",
        });
        const data: { status?: string; email?: string } = await response.json();

        if (!isCurrent) return;

        if (response.ok && data.status === "connected") {
          setGmailStatus("connected");
          setGmailEmail(data.email ?? null);
          if (oauthResult) setGmailNotice(oauthMessage);
        } else {
          setGmailStatus("disconnected");
          setGmailEmail(null);
          if (oauthResult) {
            setGmailNotice(
              oauthMessage || "Gmail is not connected. Please try connecting again.",
            );
          }
        }
      } catch {
        if (isCurrent) {
          setGmailStatus("unavailable");
          if (oauthResult) {
            setGmailNotice(
              oauthMessage || "Could not verify the Gmail connection.",
            );
          }
        }
      }
    };

    void checkGmailConnection();
    return () => {
      isCurrent = false;
    };
  }, []);

  const connectGmail = () => {
    window.open(`${API_BASE_URL}/api/gmail/oauth/start`, "_self");
  };

  const handleSubmit = async (resumeValue?: ResumeValue) => {
    const prompt = promptText.trim();
    if (
      resumeValue &&
      "decision" in resumeValue &&
      resumeValue.decision === "SEND" &&
      gmailStatus !== "connected"
    ) {
      setGmailNotice("Connect Gmail before sending this email.");
      return;
    }
    const isResuming =
      workflowThreadId !== null &&
      (workflowStatus === "WAITING_FOR_USER" ||
        workflowStatus === "WAITING_FOR_APPROVAL");

    if (workflowStatus === "WAITING_FOR_APPROVAL" && !resumeValue) {
      return;
    }

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

    const visibleUserMessage =
      resumeValue && "decision" in resumeValue
        ? resumeValue.decision === "IMPROVE"
          ? `Improve the draft: ${resumeValue.feedback}`
          : resumeValue.decision === "SEND"
            ? "Send this email"
            : "Reject this email"
        : prompt;

    setMessages((current) => [
      ...current,
      {
        id: createMessageId(),
        role: "user",
        content: visibleUserMessage,
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
      formData.append(
        "resume_value",
        JSON.stringify(resumeValue ?? { answer: prompt }),
      );
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
      const result = await fetch(`${API_BASE_URL}/api/workflow`, {
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
      if (data.status === "FAILED" && data.error?.includes("invalid_grant")) {
        setGmailStatus("disconnected");
        setGmailEmail(null);
        setGmailNotice("Gmail authorization expired. Reconnect Gmail before sending.");
      }

      const needsClarification = Boolean(data.clarification_question);
      const assistantMessage =
        data.status === "SENT"
          ? "The email was sent."
          : data.status === "REJECTED"
            ? "The email was rejected. Nothing was sent."
            : data.status === "FAILED"
              ? "Sorry, the email could not be sent due to an internal error. Please try again later."
              : data.clarification_question ||
                data.draft?.assistant_message ||
                "The workflow has been updated.";

      setMessages((current) => [
        ...current,
        {
          id: createMessageId(),
          role: "assistant",
          content: assistantMessage,
          draft:
            !needsClarification && data.status === "WAITING_FOR_APPROVAL"
              ? data.draft ?? undefined
              : undefined,
        },
      ]);
    } 
    catch {
      setMessages((current) => [
        ...current,
        {
          id: createMessageId(),
          role: "assistant",
          content: "Sorry, I couldn't generate the email due to an internal error. Please try again later.",
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
      <header className="flex items-center justify-between gap-4 border-b border-zinc-800 px-4 py-3 sm:px-6">
        <div>
          <h1 className="text-sm font-semibold text-zinc-100">AI Email Assistant</h1>
          <p className="text-xs text-zinc-400" aria-live="polite">
            {gmailStatus === "checking"
              ? "Checking Gmail connection…"
              : gmailStatus === "connected"
                ? `Gmail connected${gmailEmail ? ` as ${gmailEmail}` : ""}`
                : gmailStatus === "unavailable"
                  ? "Gmail service unavailable"
                  : "Gmail not connected"}
          </p>
          {gmailNotice && (
            <p className="mt-1 text-xs text-amber-300" role="status">
              {gmailNotice}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={connectGmail}
          disabled={gmailStatus === "checking"}
          className="shrink-0 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-50"
        >
          {gmailStatus === "connected" ? "Reconnect Gmail" : "Connect Gmail"}
        </button>
      </header>
      <main className="relative flex min-h-0 flex-1 flex-col">
        <div className="flex flex-1 flex-col overflow-y-auto">
          {messages.length === 0 ? (
            <EmptyState />
          ) : (
          <ChatMessages
            messages={messages}
            approvalPending={workflowStatus === "WAITING_FOR_APPROVAL"}
            isLoading={isLoading}
            onApproval={handleSubmit}
          />
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
          disabled={
            workflowStatus === "WAITING_FOR_APPROVAL" ||
            gmailStatus !== "connected"
          }
          placeholder={
            gmailStatus !== "connected"
              ? "Connect Gmail to start..."
              : workflowStatus === "WAITING_FOR_USER"
              ? "Type your answer..."
              : "Ask AI Email Assistant to draft an email..."
          }
        />
      </main>
    </div>
  );
}
