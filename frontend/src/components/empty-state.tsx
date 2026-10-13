import { Mail, MessageSquarePlus, Reply, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";

export function EmptyState() {
  const features = [
    {
      icon: MessageSquarePlus,
      title: "Compose New Email",
      desc: "Draft a polite follow-up to a recruiter after an interview",
    },
    {
      icon: FileText,
      title: "Send with Attachment",
      desc: "Upload a document and draft an introductory note",
    },
    {
      icon: Reply,
      title: "Multiple Emails at Once",
      desc: "Send emails to multiple recipients with a single prompt",
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center max-w-[750px] mx-auto my-auto animate-in fade-in duration-500">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-800 text-white shadow-md mb-6">
        <Mail className="h-7 w-7 text-zinc-200" />
      </div>

      <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-white mb-2">
        What email would you like to write today?
      </h2>

      <p className="text-sm text-zinc-400 max-w-md mb-8 leading-relaxed">
        Describe who you want to reach and what you want to say. I will analyze
        the intent, draft the email, and review it with you.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full text-left">
        {features.map((item) => {
          const Icon = item.icon;

          return (
            <Card
              key={item.title}
              className="p-3.5 bg-zinc-900/60 border-zinc-800"
            >
              <div className="flex items-center gap-2 mb-1.5 text-zinc-300">
                <Icon className="h-4 w-4 text-zinc-400" />
                <span className="text-sm font-medium">{item.title}</span>
              </div>

              <p className="text-[12px] text-zinc-400 leading-normal line-clamp-2">
                {item.desc}
              </p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}