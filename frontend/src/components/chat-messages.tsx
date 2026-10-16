import { EmailDraftCard, type ApprovalAction } from "@/components/email-draft-card";
import { LoaderCircle } from "lucide-react";

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
    referenceFiles?: string[];
    emailAttachments?: string[];
}

interface ChatMessagesProps {
    messages: ChatMessage[];
    approvalPending: boolean;
    isLoading: boolean;
    progressMessage?: string;
    onApproval: (action: ApprovalAction) => void;
}

export function ChatMessages({
    messages,
    approvalPending,
    isLoading,
    progressMessage,
    onApproval,
}: ChatMessagesProps) {
    const pendingDraftId = [...messages]
        .reverse()
        .find((message) => message.role === "assistant" && message.draft)?.id;

    return (
        <div className="mx-auto w-full max-w-3xl space-y-6 overflow-y-auto px-4 py-8">
            {messages.map((message) => {
                const referenceFiles = message.referenceFiles ?? [];
                const emailAttachments = message.emailAttachments ?? [];

                return (
                    <div
                        key={message.id}
                        className={`flex ${message.role === "user" ? "justify-end" : "justify-start"
                            }`}
                    >
                        <div className="flex max-w-[85%] flex-col gap-0 justify-start">
                            {(referenceFiles.length > 0 || emailAttachments.length > 0) && (
                                <div className="flex w-full flex-wrap justify-end gap-2 px-3 p-2">
                                    {referenceFiles.map((filename, index) => (
                                        <div
                                            key={`reference-${filename}-${index}`}
                                            className="flex items-center gap-2 rounded-md border border-[#29bf12]/40 bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
                                            title={`Reference file: ${filename}`}
                                        >
                                            <span className="max-w-40 truncate">{filename}</span>
                                        </div>
                                    ))}

                                    {emailAttachments.map((filename, index) => (
                                        <div
                                            key={`email-attachment-${filename}-${index}`}
                                            className="flex items-center gap-2 rounded-md border border-[#f7b801]/50 bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
                                            title={`Email attachment: ${filename}`}
                                        >
                                            <span className="max-w-40 truncate">{filename}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

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
                                <EmailDraftCard
                                    draft={message.draft}
                                    approvalPending={approvalPending && message.id === pendingDraftId}
                                    isLoading={isLoading}
                                    onApproval={onApproval}
                                />
                            )}
                        </div>
                    </div>
                );
            })}
            {progressMessage && (
                <div className="flex justify-start" role="status" aria-live="polite">
                    <div className="flex items-center gap-2 px-4 py-3 text-sm text-zinc-400">
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                        <span>{progressMessage}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
