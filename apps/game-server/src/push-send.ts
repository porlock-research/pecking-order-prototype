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

    if (response.status === 201 || response.status === 200) return "sent";
    if (response.status === 410 || response.status === 404) return "expired";

    console.error(`[Push] Unexpected status ${response.status} from ${endpoint}`);
    return "error";
  } catch (err) {
    console.error("[Push] Failed to send notification:", err);
    return "error";
  }
}
