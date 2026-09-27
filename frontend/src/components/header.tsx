import React from "react";
import { Mail, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function Header() {
  return (
    <header className="sticky top-0 z-20 flex h-14 w-full items-center justify-between border-b border-zinc-800/80 bg-[#0d0d0e]/95 px-4 backdrop-blur sm:px-6">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 border border-zinc-700/60 text-white shadow-sm">
          <Mail className="h-4 w-4" />
        </div>
        <div className="flex flex-col">
          <h1 className="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
            AI Email Assistant
            <Badge variant="outline" className="hidden sm:inline-flex text-[10px] py-0 px-2 font-normal text-zinc-400 border-zinc-700/70">
              LangGraph
            </Badge>
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs text-zinc-400 bg-zinc-900/80 border border-zinc-800 px-2.5 py-1 rounded-full">
          <Sparkles className="h-3 w-3 text-zinc-300" />
          <span>Gemini 2.5 Flash</span>
        </div>
      </div>
    </header>
  );
}
