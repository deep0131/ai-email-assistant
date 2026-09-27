export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface WorkflowRequestOptions {
  prompt: string;
  files?: File[];
  workflowThreadId?: string;
  resumeValue?: string | Record<string, unknown> | null;
}

/**
 * Prepares a FormData payload for the /api/workflow endpoint.
 * Ensures "prompt" is included and "files" are appended as individual file entries.
 */
export function prepareWorkflowFormData(options: WorkflowRequestOptions): FormData {
  const formData = new FormData();
  formData.append("prompt", options.prompt.trim());

  if (options.files && options.files.length > 0) {
    for (const file of options.files) {
      formData.append("files", file);
    }
  }

  if (options.workflowThreadId) {
    formData.append("workflow_thread_id", options.workflowThreadId);
  }

  if (options.resumeValue !== undefined && options.resumeValue !== null) {
    const serialized =
      typeof options.resumeValue === "string"
        ? options.resumeValue
        : JSON.stringify(options.resumeValue);
    formData.append("resume_value", serialized);
  }

  return formData;
}
