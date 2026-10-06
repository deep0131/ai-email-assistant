export interface EmailRecipient {
  name?: string | null;
  email?: string | null;
}

export interface EmailAttachment {
  attachment_id: string;
  filename: string;
}

export interface EmailDraft {
  subject: string;
  to: EmailRecipient[];
  body: string;
  action?: string;
  attachments?: EmailAttachment[];
  questions?: string[];
  ready_for_approval?: boolean;
}

export interface ReviewResponse {
  decision: "PASS" | "FAIL";
  score?: number;
  summary: string;
  issues?: string[];
  revision_instructions?: string[];
  ready_for_approval?: boolean;
}

export interface IntentResponse {
  action: "NEW_EMAIL" | "REPLY" | "DRAFT" | "UNKNOWN";
  recipient?: string | null;
  source?: string;
  has_email_content?: boolean;
  needs_attachment?: boolean;
  confidence?: number;
  missing_information?: string[];
  reasoning_summary?: string;
}

export interface SendResult {
  status: "SENT" | "DRAFT_ONLY" | "ERROR" | string;
  message_id?: string;
  draft_id?: string;
  thread_id?: string;
  detail?: string;
}

export type WorkflowStatus =
  | "IN_PROGRESS"
  | "WAITING_FOR_USER"
  | "WAITING_FOR_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "COMPLETED"
  | "REVIEW_FAILED"
  | "ERROR";

export interface WorkflowResponse {
  status: WorkflowStatus;
  workflow_thread_id?: string;
  intent?: IntentResponse | null;
  draft?: EmailDraft | null;
  review?: ReviewResponse | null;
  revision_count?: number;
  draft_id?: string | null;
  clarification_question?: string | null;
  selected_thread_id?: string | null;
  attachment_decision?: "ATTACH" | "SKIP" | "UNCLEAR" | string | null;
  selected_attachment_ids?: string[];
  send_result?: SendResult | null;
  error?: string | null;
  detail?: string | null;
}

export interface AttachedFileMeta {
  name: string;
  size: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content?: string;
  files?: AttachedFileMeta[];
  timestamp: string;
  // Workflow response payload when role is assistant
  workflowResponse?: WorkflowResponse;
}
