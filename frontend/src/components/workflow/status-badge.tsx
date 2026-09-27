import React from "react";
import { Badge } from "@/components/ui/badge";
import { WorkflowStatus } from "@/lib/types";
import { CheckCircle2, Clock, AlertTriangle, AlertCircle, XCircle } from "lucide-react";

interface StatusBadgeProps {
  status: WorkflowStatus | string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  switch (status) {
    case "WAITING_FOR_APPROVAL":
      return (
        <Badge
          variant="outline"
          className="border-amber-500/40 bg-amber-500/10 text-amber-300 gap-1.5 py-1 px-2.5 text-xs font-medium"
        >
          <Clock className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
          Waiting for Approval
        </Badge>
      );
    case "WAITING_FOR_USER":
      return (
        <Badge
          variant="outline"
          className="border-sky-500/40 bg-sky-500/10 text-sky-300 gap-1.5 py-1 px-2.5 text-xs font-medium"
        >
          <AlertCircle className="h-3.5 w-3.5 text-sky-400" />
          Input Needed
        </Badge>
      );
    case "COMPLETED":
    case "APPROVED":
      return (
        <Badge
          variant="outline"
          className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300 gap-1.5 py-1 px-2.5 text-xs font-medium"
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          {status === "APPROVED" ? "Approved & Sent" : "Completed"}
        </Badge>
      );
    case "REJECTED":
      return (
        <Badge
          variant="outline"
          className="border-rose-500/40 bg-rose-500/10 text-rose-300 gap-1.5 py-1 px-2.5 text-xs font-medium"
        >
          <XCircle className="h-3.5 w-3.5 text-rose-400" />
          Rejected
        </Badge>
      );
    case "REVIEW_FAILED":
      return (
        <Badge
          variant="outline"
          className="border-rose-500/40 bg-rose-500/10 text-rose-300 gap-1.5 py-1 px-2.5 text-xs font-medium"
        >
          <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
          Review Failed
        </Badge>
      );
    case "ERROR":
      return (
        <Badge
          variant="outline"
          className="border-red-500/40 bg-red-500/10 text-red-300 gap-1.5 py-1 px-2.5 text-xs font-medium"
        >
          <AlertCircle className="h-3.5 w-3.5 text-red-400" />
          Error
        </Badge>
      );
    default:
      return (
        <Badge
          variant="outline"
          className="border-zinc-700 bg-zinc-800 text-zinc-300 gap-1.5 py-1 px-2.5 text-xs font-medium"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
          {status.replace(/_/g, " ")}
        </Badge>
      );
  }
}
