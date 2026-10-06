"use client";

import React, { useState } from "react";
import { Header } from "@/components/header";
import { ChatArea } from "@/components/chat-area";
import { PromptComposer } from "@/components/prompt-composer";
import { prepareWorkflowFormData, executeWorkflow } from "@/lib/api";
import { ChatMessage, WorkflowResponse } from "@/lib/types";

function createMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function getTimestamp(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [promptText, setPromptText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [workflowThreadId, setWorkflowThreadId] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);

  const handleSelectPrompt = (selectedText: string) => {
    setPromptText(selectedText);
  };

  const handleClearChat = () => {
    setMessages([]);
    setPromptText("");
    setSelectedFiles([]);
    setWorkflowThreadId(null);
    setCurrentStatus(null);
  };

  // General workflow execution handler
  const runWorkflow = async (formData: FormData) => {
    setIsLoading(true);

    try {
      const response: WorkflowResponse = await executeWorkflow(formData);

      if (response.workflow_thread_id) {
        setWorkflowThreadId(response.workflow_thread_id);
      }
      setCurrentStatus(response.status);

      const assistantMsg: ChatMessage = {
        id: createMessageId(),
        role: "assistant",
        workflowResponse: response,
        timestamp: getTimestamp(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while communicating with the backend.";

      const errorResponse: WorkflowResponse = {
        status: "ERROR",
        error: errorMessage,
        workflow_thread_id: workflowThreadId || undefined,
      };

      const errorMsg: ChatMessage = {
        id: createMessageId(),
        role: "assistant",
        workflowResponse: errorResponse,
        timestamp: getTimestamp(),
      };

      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Submit handler from bottom prompt composer
  const handleSubmit = async () => {
    if (isLoading) return;
    const trimmed = promptText.trim();
    if (!trimmed && selectedFiles.length === 0) return;

    // If currently waiting for user clarification, route the prompt as resume_value
    if (currentStatus === "WAITING_FOR_USER" && workflowThreadId) {
      handleResume(trimmed);
      setPromptText("");
      setSelectedFiles([]);
      return;
    }

    const fileAttachments = selectedFiles.map((f) => ({
      name: f.name,
      size: f.size,
    }));

    const userMessage: ChatMessage = {
      id: createMessageId(),
      role: "user",
      content: trimmed,
      files: fileAttachments,
      timestamp: getTimestamp(),
    };

    setMessages((prev) => [...prev, userMessage]);

    const formData = prepareWorkflowFormData({
      prompt: trimmed,
      files: selectedFiles,
      workflowThreadId: workflowThreadId || undefined,
    });

    setPromptText("");
    setSelectedFiles([]);

    await runWorkflow(formData);
  };

  // Resume handler for clarification and natural responses
  const handleResume = async (resumeValue: string) => {
    if (isLoading || !workflowThreadId) return;

    const userMessage: ChatMessage = {
      id: createMessageId(),
      role: "user",
      content: resumeValue,
      timestamp: getTimestamp(),
    };

    setMessages((prev) => [...prev, userMessage]);

    const formData = prepareWorkflowFormData({
      workflowThreadId,
      resumeValue,
    });

    await runWorkflow(formData);
  };

  // Approval handler: resumes workflow with { approved: true }
  const handleApprove = async () => {
    if (isLoading || !workflowThreadId) return;

    const userMessage: ChatMessage = {
      id: createMessageId(),
      role: "user",
      content: "Approved: Confirm and send email.",
      timestamp: getTimestamp(),
    };

    setMessages((prev) => [...prev, userMessage]);

    const formData = prepareWorkflowFormData({
      workflowThreadId,
      resumeValue: { approved: true },
    });

    await runWorkflow(formData);
  };

  // Rejection handler: resumes workflow with { approved: false }
  const handleReject = async () => {
    if (isLoading || !workflowThreadId) return;

    const userMessage: ChatMessage = {
      id: createMessageId(),
      role: "user",
      content: "Draft rejected.",
      timestamp: getTimestamp(),
    };

    setMessages((prev) => [...prev, userMessage]);

    const formData = prepareWorkflowFormData({
      workflowThreadId,
      resumeValue: { approved: false },
    });

    await runWorkflow(formData);
  };

  const getComposerPlaceholder = () => {
    if (currentStatus === "WAITING_FOR_USER") {
      return "Type your answer to the clarification question above...";
    }
    if (currentStatus === "WAITING_FOR_APPROVAL") {
      return "Review the draft above and click 'Confirm and Send' or 'Reject'...";
    }
    return "Ask AI Email Assistant to draft or reply to an email...";
  };

  return (
    <div className="flex h-screen w-full flex-col bg-[#0d0d0e] text-zinc-100 font-sans">
      <Header onClearChat={handleClearChat} />
      <main className="flex-1 flex flex-col min-h-0 relative">
        <ChatArea
          messages={messages}
          isLoading={isLoading}
          onSelectPrompt={handleSelectPrompt}
          onApprove={handleApprove}
          onReject={handleReject}
          onResume={handleResume}
        />
        <PromptComposer
          prompt={promptText}
          onPromptChange={setPromptText}
          files={selectedFiles}
          onFilesChange={setSelectedFiles}
          onSubmit={handleSubmit}
          isLoading={isLoading}
          placeholder={getComposerPlaceholder()}
        />
      </main>
    </div>
  );
}
