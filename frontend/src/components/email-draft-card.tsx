"use client";

import { useState } from "react";

interface EmailDraft {
    assistant_message?: string;
    subject: string;
    body: string;
    to: Array<{
        name?: string | null;
        email?: string | null;
    }>;
}

export type ApprovalAction =
    | { decision: "SEND" | "REJECT" }
    | { decision: "IMPROVE"; feedback: string };

interface EmailDraftCardProps {
    draft: EmailDraft;
    approvalPending?: boolean;
    isLoading?: boolean;
    onApproval: (action: ApprovalAction) => void;
}

export function EmailDraftCard({
    draft,
    approvalPending = false,
    isLoading = false,
    onApproval,
}: EmailDraftCardProps) {
    const [isImproving, setIsImproving] = useState(false);
    const [feedback, setFeedback] = useState("");

    const recipients = draft.to
        .map((recipient) => recipient.name || recipient.email)
        .filter(Boolean)
        .join(", ");

    return (
        <div className="w-full max-w-xl space-y-4 rounded-3xl border border-zinc-700 bg-zinc-800 p-5 text-zinc-100">
            <div>
                <span className="text-sm text-zinc-400">To:</span>
                <span className="whitespace-pre-wrap text-sm leading-6">{recipients || "No recipient"}</span>
            </div>

            <div>
                <span className="text-sm text-zinc-400">Subject:</span>
                <span className="whitespace-pre-wrap text-sm leading-6">{draft.subject}</span>
            </div>

            <div>
                <p className="text-sm text-zinc-400">Body:</p>
                <p className="whitespace-pre-wrap text-sm leading-6">{draft.body}</p>
            </div>

            {approvalPending && (
                <div className="border-t border-zinc-700 pt-4">
                    {isImproving ? (
                        <div className="space-y-3">
                            <label htmlFor="draft-feedback" className="text-sm text-zinc-300">
                                What should I improve?
                            </label>
                            <textarea
                                id="draft-feedback"
                                value={feedback}
                                onChange={(event) => setFeedback(event.target.value)}
                                disabled={isLoading}
                                rows={3}
                                className="w-full resize-y rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:opacity-50"
                                placeholder="Describe the changes you want..."
                            />
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => onApproval({ decision: "IMPROVE", feedback: feedback.trim() })}
                                    disabled={isLoading || !feedback.trim()}
                                    className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-black hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {isLoading ? "Improving..." : "Improve"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsImproving(false);
                                        setFeedback("");
                                    }}
                                    disabled={isLoading}
                                    className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => onApproval({ decision: "SEND" })}
                                disabled={isLoading}
                                className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-black hover:bg-zinc-200 disabled:opacity-50"
                            >
                                Send
                            </button>
                            <button
                                type="button"
                                onClick={() => onApproval({ decision: "REJECT" })}
                                disabled={isLoading}
                                className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
                            >
                                Reject
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsImproving(true)}
                                disabled={isLoading}
                                className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
                            >
                                Improve
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
