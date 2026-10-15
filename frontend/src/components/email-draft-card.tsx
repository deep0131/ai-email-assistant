interface EmailDraft {
    assistant_message?: string;
    subject: string;
    body: string;
    to: Array<{
        name?: string | null;
        email?: string | null;
    }>;
}

interface EmailDraftCardProps {
    draft: EmailDraft;
}

export function EmailDraftCard({ draft }: EmailDraftCardProps) {
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
        </div>
    );
}