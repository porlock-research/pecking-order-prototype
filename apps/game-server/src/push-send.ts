/**
 * Low-level push notification sending via @pushforge/builder.
 * Extracted from push.ts — no DO storage dependency.
 */
import { buildPushHTTPRequest } from "@pushforge/builder";

export type PushResult = "sent" | "expired" | "error";

export async function sendPushNotification(
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: Record<string, string>,
  vapidPrivateJWK: string,
  adminContact: string = "mailto:admin@peckingorder.app",
  ttl: number = 3600,
): Promise<PushResult> {
  try {
    const { endpoint, headers, body } = await buildPushHTTPRequest({
      privateJWK: vapidPrivateJWK,
      subscription: sub as any,
      message: {
        payload: payload as any,
        adminContact,
        options: { ttl, urgency: "high" },
      },
    });

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body,
    });

    // Always consume the response body to prevent Cloudflare's
    // "stalled HTTP response" deadlock warning, which silently
    // cancels in-flight fetch calls and drops push notifications.
    await response.body?.cancel();

    if (response.status === 201 || response.status === 200) return "sent";
    // 404/410 are the RFC 8030 codes for "subscription no longer valid"; FCM
    // also returns 403 for tokens whose registration was revoked on the client
    // (app uninstall, browser storage wipe, etc.) — treat all three as expired
    // so the upstream caller prunes the row instead of re-sending forever.
    // Playtest LR8W3U logged ~30 error-level 403s for a single dead token
    // before this change.
    if (response.status === 410 || response.status === 404 || response.status === 403) return "expired";

    console.error(`[Push] Unexpected status ${response.status} from ${endpoint}`);
    return "error";
  } catch (err) {
    console.error("[Push] Failed to send notification:", err);
    return "error";
  }
}
