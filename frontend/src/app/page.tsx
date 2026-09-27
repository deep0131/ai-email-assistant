"use client";

import React, { useState } from "react";
import { Header } from "@/components/header";
import { ChatArea, MessageItem } from "@/components/chat-area";
import { PromptComposerShell } from "@/components/prompt-composer-shell";

export default function Home() {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [promptText, setPromptText] = useState("");

  const handleSelectPrompt = (selectedText: string) => {
    setPromptText(selectedText);
  };

  const handleSendPrompt = () => {
    if (!promptText.trim()) return;

    const userMessage: MessageItem = {
      id: Date.now().toString(),
      role: "user",
      content: promptText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setPromptText("");
  };

  return (
    <div className="flex h-screen w-full flex-col bg-[#0d0d0e] text-zinc-100 font-sans">
      <Header />
      <main className="flex-1 flex flex-col min-h-0 relative">
        <ChatArea messages={messages} onSelectPrompt={handleSelectPrompt} />
        <PromptComposerShell
          value={promptText}
          onChange={setPromptText}
          onSubmit={handleSendPrompt}
        />
      </main>
    </div>
  );
}
