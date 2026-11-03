import { userService } from "@/services/tenantServices";
import { apiErrorMessage } from "@/api/tenantClient";
import {
  BULK_MFA_ACTIONS,
  displayName,
  mfaOutcome,
  type BulkAction,
  type BulkOutcome,
} from "@/lib/userBulk";
import type { WorkspaceUser } from "@/types/tenant";

// Applies one bulk action to the members it applies to. Two-step goes to the
// server in one request; suspend/restore reuse the guarded single-user update
// (last-super-admin check, session revoke) once per member, so one refusal
// never blocks the others.
export async function runBulkAction(action: BulkAction, targets: WorkspaceUser[]): Promise<BulkOutcome> {
  if (targets.length === 0) return { done: 0, failed: [] };

  if (BULK_MFA_ACTIONS.includes(action)) {
    const results = await userService.setUsersMfa(
      targets.map((u) => u.id),
      action === "mfa-on",
    );
    return mfaOutcome(results, targets);
  }

  const status = action === "suspend" ? "suspended" : "active";
  const settled = await Promise.allSettled(targets.map((u) => userService.updateUser(u.id, { status })));
  const outcome: BulkOutcome = { done: 0, failed: [] };
  settled.forEach((result, i) => {
    if (result.status === "fulfilled") outcome.done += 1;
    else outcome.failed.push({ name: displayName(targets[i]), message: apiErrorMessage(result.reason) });
  });
  return outcome;
}
