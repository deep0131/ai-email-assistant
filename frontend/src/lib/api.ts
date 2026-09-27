import { WorkflowResponse } from "./types";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface WorkflowRequestOptions {
  prompt?: string;
  files?: File[];
  workflowThreadId?: string;
  resumeValue?: string | Record<string, unknown> | boolean | null;
}

/**
 * Prepares a FormData payload for the POST /api/workflow endpoint.
 */
export function prepareWorkflowFormData(options: WorkflowRequestOptions): FormData {
  const formData = new FormData();

  if (options.prompt !== undefined && options.prompt !== null) {
    formData.append("prompt", options.prompt.trim());
  }

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
      typeof options.resumeValue === "object"
        ? JSON.stringify(options.resumeValue)
        : String(options.resumeValue);
    formData.append("resume_value", serialized);
  }

  return formData;
}

/**
 * Calls the backend POST /api/workflow endpoint with FormData.
 * Returns the parsed WorkflowResponse or throws an Error.
 */
export async function executeWorkflow(formData: FormData): Promise<WorkflowResponse> {
  const url = `${API_BASE_URL}/api/workflow`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      body: formData,
    });
  } catch (err: unknown) {
    const msg =
      err instanceof Error
        ? err.message
        : "Failed to connect to the AI Email Assistant backend server.";
    throw new Error(`Network error: ${msg}. Make sure the backend is running at ${API_BASE_URL}.`);
  }

  if (!response.ok) {
    let errorDetail = `Backend returned status ${response.status}`;
    try {
      const errJson = await response.json();
      if (errJson && typeof errJson === "object") {
        errorDetail =
          errJson.detail ||
          errJson.error ||
          errJson.message ||
          JSON.stringify(errJson);
      }
    } catch {
      const text = await response.text();
      if (text) errorDetail = text;
    }
    throw new Error(errorDetail);
  }

  const data: WorkflowResponse = await response.json();
  return data;
}
