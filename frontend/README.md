# AI Email Assistant Frontend

A ChatGPT-inspired monochrome interface built with **Next.js 16**, **TypeScript**, **Tailwind CSS**, and **shadcn/ui** components. Integrates directly with the Python FastAPI AI Email Assistant service.

---

## Features

- **Monochrome ChatGPT-style Theme**: Deep charcoal backgrounds, subtle zinc borders, crisp typography, and responsive centered chat view.
- **Dynamic Prompt Composer**: Multiline auto-resizing textarea with keyboard support (`Enter` to submit, `Shift+Enter` for newlines).
- **Attachment Uploads & Previews**: Upload multiple file attachments with deduplication, formatted file sizes, thumbnail image previews, and remove buttons.
- **Workflow State Management**: Seamless handling of LangGraph MemorySaver threads via `POST /api/workflow`.
- **Structured Response Cards**:
  - **Status Badges**: Visual indicators for `WAITING_FOR_USER`, `WAITING_FOR_APPROVAL`, `COMPLETED`, `APPROVED`, `REJECTED`, and `ERROR`.
  - **Email Draft Card**: Subject, recipient pills, copy-to-clipboard message body, and attachment badges.
  - **Reviewer Evaluation Card**: Reviewer agent `PASS`/`FAIL` decision, score, summary, and detected issues.
  - **Clarification Composer**: Interactive card with natural quick-response buttons (`"okay"`, `"yes"`, `"go ahead"`, `"no"`, `"send without it"`) plus text input for clarifying details.
  - **Approval Actions**: Explicit `"Confirm and Send"` and `"Reject"` buttons; never sends emails directly from the frontend.
  - **Debug Inspection**: Collapsible raw JSON response block with one-click copy.

---

## Environment Setup

1. Navigate to the `frontend/` directory:
   ```bash
   cd frontend
   ```

2. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

3. Ensure the backend endpoint is configured:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```

---

## Starting the Application

### 1. Starting the Backend

From the repository root or `ai-service/`:

```bash
cd ai-service
source venv/bin/activate  # Or on Windows: .\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000
```

Verify backend health at: [http://localhost:8000/docs](http://localhost:8000/docs)

### 2. Starting the Frontend

From the `frontend/` directory:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Verification Commands

To verify code quality and build integrity:

```bash
# Run ESLint
npm run lint

# Run Production Build
npm run build
```

---

## Manual Testing Guide

### 1. Testing a New Email

1. Type a natural email request in the prompt composer:
   ```text
   Send an email to alex@example.com thanking them for the product demo today and confirming our next meeting on Thursday.
   ```
2. Press **Enter** or click the **Send** button.
3. Observe:
   - User message bubble appears on the right.
   - Assistant displays loading indicator while communicating with the backend.
   - Assistant responds with `WAITING_FOR_APPROVAL` card showing:
     - Recipient: `alex@example.com`
     - Subject: `Thank you for the product demo / Next steps`
     - Clean message body with copy button
     - Reviewer evaluation score & decision (`PASS`)
     - Action buttons: `Confirm and Send` and `Reject`.

### 2. Testing an Uploaded Attachment

1. Click the **Paperclip** icon in the prompt composer.
2. Select one or more files (e.g., an image or PDF file).
3. Observe:
   - Attachment chip appears with file icon, image preview (for images), filename, formatted size (e.g. `24.5 KB`), and an `X` remove button.
4. Type your prompt:
   ```text
   Send an email to hr@company.com with my resume attached for the Senior Engineer opening.
   ```
5. Click **Send**.
6. The backend workflow automatically recognizes the uploaded file, verifies the attachment decision, and displays the draft with the attached file.

### 3. Testing Clarification (`WAITING_FOR_USER`)

1. Submit an underspecified prompt with missing details:
   ```text
   Please reply to that earlier email.
   ```
2. The backend responds with status `WAITING_FOR_USER` and asks for missing information (e.g. recipient or thread context).
3. The interface displays the **Clarification Needed** card.
4. If testing attachment confirmation:
   - Upload a file without mentioning attachments in prompt: `Email Sarah saying hello`.
   - The assistant asks if you want to include the file.
   - Use the one-click natural response chips:
     - `okay`, `yes`, `go ahead`, `no`, or `send without it`.
5. Enter your answer or click a chip. The frontend calls `POST /api/workflow` with:
   - `workflow_thread_id`
   - `resume_value`
6. The workflow resumes from its saved LangGraph checkpoint without re-running previous nodes.

### 4. Testing Approval and Rejection (`WAITING_FOR_APPROVAL`)

1. When a generated draft is ready, the status updates to `WAITING_FOR_APPROVAL`.
2. Inspect the draft details, recipient, subject, and reviewer score.
3. **Approval**:
   - Click **Confirm and Send**.
   - Frontend sends `resume_value: {"approved": true}` with the active `workflow_thread_id`.
   - Backend sends the email via Gmail API and returns `status: "APPROVED"` with Gmail message ID and thread ID.
4. **Rejection**:
   - Click **Reject**.
   - Frontend sends `resume_value: {"approved": false}` with the active `workflow_thread_id`.
   - Backend cancels the draft without sending, returning `status: "REJECTED"`.

---

## Architectural Notes

- **Zero Direct Gmail Sends**: The frontend never directly communicates with Gmail or external LLM APIs. All actions route through `POST /api/workflow`.
- **MemorySaver Checkpointing**: The `workflow_thread_id` is retained across conversational turns so multi-step workflows (clarification -> draft -> review -> approval) maintain coherent state.
- **In-Memory Attachments**: Files are sent as `multipart/form-data` to FastAPI, processed in-memory as `GmailAttachment` objects, and never permanently stored on disk.
