import { EmailDraftCard } from "@/components/email-draft-card";

interface EmailDraft {
    assistant_message?: string;
    subject: string;
    body: string;
    to: Array<{
        name?: string | null;
        email?: string | null;
    }>;
}

interface ChatMessage {
    id: string;
    role: "user" | "assistant";
    content?: string;
    draft?: EmailDraft;
}

interface ChatMessagesProps {
    messages: ChatMessage[];
}

export function ChatMessages({ messages }: ChatMessagesProps) {
    return (
        <div className="mx-auto w-full max-w-3xl space-y-6 overflow-y-auto px-4 py-8">
            {messages.map((message) => (
                <div
                    key={message.id}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"
                        }`}
                >
                    <div className="flex max-w-[85%] flex-col gap-3">
                        {message.content && (
                            <div
                                className={`whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${message.role === "user"
                                        ? "border border-zinc-700/60 bg-zinc-800 text-zinc-100"
                                        : "text-zinc-200"
                                    }`}
                            >
                                {message.content}
                            </div>
                        )}

                        {message.role === "assistant" && message.draft && (
                            <EmailDraftCard draft={message.draft} />
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}