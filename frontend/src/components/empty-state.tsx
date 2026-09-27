import React from "react";
import { Mail, MessageSquarePlus, Reply, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";

interface EmptyStateProps {
  onSelectPrompt?: (prompt: string) => void;
}

export function EmptyState({ onSelectPrompt }: EmptyStateProps) {
  const suggestions = [
    {
      icon: MessageSquarePlus,
      title: "Compose New Email",
      desc: "Draft a polite follow-up to a recruiter after an interview",
      prompt: "Write a follow-up email to Sarah at TechCorp thanking her for yesterday's engineering interview and reiterating my interest in the role.",
    },
    {
      icon: Reply,
      title: "Reply to Thread",
      desc: "Respond to the latest team sync or proposal message",
      prompt: "Reply to the team sync email saying I will attend tomorrow at 10 AM with the updated slides.",
    },
    {
      icon: FileText,
      title: "Send with Attachment",
      desc: "Upload a document and draft an introductory note",
      prompt: "Draft an email to client@example.com introducing our quarterly report and highlighting the 15% revenue growth.",
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center max-w-2xl mx-auto my-auto animate-in fade-in duration-500">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-800 text-white shadow-md mb-6">
        <Mail className="h-7 w-7 text-zinc-200" />
      </div>

      <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-white mb-2">
        What email would you like to write today?
      </h2>
      <p className="text-sm text-zinc-400 max-w-md mb-8 leading-relaxed">
        Describe who you want to reach and what you want to say. I will analyze the intent, search Gmail context if needed, draft, and review it with you.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full text-left">
        {suggestions.map((item, idx) => {
          const Icon = item.icon;
          return (
            <Card
              key={idx}
              onClick={() => onSelectPrompt?.(item.prompt)}
              className="p-3.5 cursor-pointer bg-zinc-900/60 hover:bg-zinc-850 hover:border-zinc-700/80 transition-all group"
            >
              <div className="flex items-center gap-2 mb-1.5 text-zinc-300 group-hover:text-white">
                <Icon className="h-4 w-4 text-zinc-400 group-hover:text-zinc-200" />
                <span className="text-xs font-medium">{item.title}</span>
              </div>
              <p className="text-[11px] text-zinc-500 leading-normal line-clamp-2">
                {item.desc}
              </p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
