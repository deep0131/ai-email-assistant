# AI Email Assistant Frontend

A ChatGPT-inspired monochrome interface built with **Next.js 16**, **TypeScript**, **Tailwind CSS**, and **shadcn/ui** components. Integrates directly with the Python FastAPI AI Email Assistant service.

---

## Features

- **Monochrome ChatGPT-style Theme**: Deep charcoal backgrounds, subtle zinc borders, crisp typography, and responsive centered chat view.
- **Dynamic Prompt Composer**: Multiline auto-resizing textarea with keyboard support (`Enter` to submit, `Shift+Enter` for newlines).
- **Separate File Uploads**: Choose files for AI reference separately from files to attach to the outgoing email.
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

### 2. Testing Reference Files and Email Attachments

1. Choose **Reference files** to give a document to the AI for context. These files are not sent with the email.
2. Choose **Email attachments** to include files with the outgoing email after you approve it.
3. You can select files in both groups; the composer labels each file by its group.
4. Try an unsupported file type, more than five files, or a file over 10 MB to verify that the backend rejects it.

### 3. Testing Clarification (`WAITING_FOR_USER`)

1. Submit an underspecified new-email prompt with missing details:
   ```text
   Send an email to raj@example.com about my leg injury.
   ```
2. The backend responds with status `WAITING_FOR_USER` and asks for essential missing information.
3. The interface displays the **Clarification Needed** card.
4. Enter an answer. The frontend calls `POST /api/workflow` with:
   - `workflow_thread_id`
   - `resume_value`
5. The workflow resumes from its saved LangGraph checkpoint.

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
