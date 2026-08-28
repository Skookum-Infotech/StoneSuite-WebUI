// Pure display/validation helpers for the in-app feedback ticket system.
// Mirrors the fixed vocabularies and limits in
// `StoneSuite-Backend/feedback/feedback.go` — keep in sync if the backend
// adds a category/status/priority or changes a limit.
import { Bug, Lightbulb, Sparkles, Zap, MessageCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { FeedbackCategory, FeedbackPriority, FeedbackStatus } from '@/types/feedback';

export const MAX_DESCRIPTION_LENGTH = 5000;
export const MAX_COMMENT_LENGTH = 5000;
export const MAX_RATING = 5;

// Ticket attachments are capped lower than the general record-attachment
// batch (10) — bug reports rarely need more than a handful of screenshots.
export const MAX_FEEDBACK_ATTACHMENTS = 5;
export const MAX_FEEDBACK_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB, matches the backend's per-file cap

export const ALLOWED_FEEDBACK_MIME: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'image/png': '.png',
  'image/jpeg': '.jpg',
};
export const ALLOWED_FEEDBACK_EXTS = ['.pdf', '.docx', '.xlsx', '.png', '.jpg', '.jpeg'];

export interface FeedbackCategoryOption {
  value: FeedbackCategory;
  label: string;
  icon: LucideIcon;
}

// Order matches the reporter widget's category picker.
export const FEEDBACK_CATEGORY_OPTIONS: FeedbackCategoryOption[] = [
  { value: 'bug', label: 'Bug Report', icon: Bug },
  { value: 'feature_request', label: 'Feature Request', icon: Lightbulb },
  { value: 'ux_improvement', label: 'UX / UI Improvement', icon: Sparkles },
  { value: 'performance', label: 'Performance Issue', icon: Zap },
  { value: 'general', label: 'General Feedback', icon: MessageCircle },
];

export function feedbackCategoryLabel(category: string): string {
  return FEEDBACK_CATEGORY_OPTIONS.find((c) => c.value === category)?.label ?? category;
}

// Returns the whole option (never just the bare icon component) — callers
// render it as `<option.icon />`, a member expression. Assigning the icon
// itself to a capitalized local (`const Icon = feedbackCategoryIcon(...)`)
// trips the "components created during render" lint rule, which can't tell
// a resolved reference to an existing component apart from a truly new one.
export function feedbackCategoryOption(category: string): FeedbackCategoryOption {
  return FEEDBACK_CATEGORY_OPTIONS.find((c) => c.value === category) ?? { value: 'general', label: category, icon: MessageCircle };
}

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: 'New',
  in_progress: 'In Progress',
  done: 'Done',
  cancelled: 'Cancelled',
};

// Light + dark chip classes, matching the badge convention used elsewhere
// (e.g. PeriodHistoryDrawer's ACTION_COLORS).
export const FEEDBACK_STATUS_COLORS: Record<FeedbackStatus, string> = {
  new: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400',
  in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  done: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  cancelled: 'bg-stone-200 text-stone-600 dark:bg-white/10 dark:text-stone-400',
};

export function feedbackStatusLabel(status: string): string {
  return FEEDBACK_STATUS_LABELS[status as FeedbackStatus] ?? status;
}

export const FEEDBACK_PRIORITY_LABELS: Record<FeedbackPriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
};

export const FEEDBACK_PRIORITY_COLORS: Record<FeedbackPriority, string> = {
  low: 'bg-stone-100 text-stone-600 dark:bg-white/10 dark:text-stone-400',
  normal: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400',
  urgent: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
};

export function feedbackPriorityLabel(priority: string): string {
  return FEEDBACK_PRIORITY_LABELS[priority as FeedbackPriority] ?? priority;
}

/** Client-side pre-check mirroring feedback.ValidateCreate's description
 *  rule — instant UX feedback; the server re-validates regardless. */
export function validateFeedbackDescription(description: string): string | null {
  if (description.trim() === '') return 'Please describe what happened.';
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`;
  }
  return null;
}

/** Client-side pre-check mirroring feedback.ValidateComment. */
export function validateFeedbackComment(body: string): string | null {
  if (body.trim() === '') return 'Reply cannot be empty.';
  if (body.length > MAX_COMMENT_LENGTH) return `Reply must be ${MAX_COMMENT_LENGTH} characters or fewer.`;
  return null;
}

/** Client-side pre-check mirroring the backend's allowlist + per-file size
 *  cap (validateAttachFile in controllers/attachments.go). */
export function validateFeedbackFile(file: File): string | null {
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (!ALLOWED_FEEDBACK_MIME[file.type] && !ALLOWED_FEEDBACK_EXTS.includes(ext)) {
    return `${file.name}: Unsupported type. Allowed: PDF, DOCX, XLSX, PNG, JPG`;
  }
  if (file.size > MAX_FEEDBACK_FILE_SIZE_BYTES) {
    return `${file.name}: Exceeds ${MAX_FEEDBACK_FILE_SIZE_BYTES / 1024 / 1024} MB limit`;
  }
  return null;
}

export function formatFeedbackFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Human-readable local timestamp for ticket rows and timeline entries. */
export function formatFeedbackTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
