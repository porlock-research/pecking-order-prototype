import { buildPushHTTPRequest, type PushSubscription } from "@pushforge/builder";

const PUSH_SUB_PREFIX = "push_sub:";

export async function savePushSubscription(
  storage: DurableObjectStorage,
  realUserId: string,
  sub: PushSubscription,
): Promise<void> {
  await storage.put(`${PUSH_SUB_PREFIX}${realUserId}`, JSON.stringify(sub));
}

export async function deletePushSubscription(
  storage: DurableObjectStorage,
  realUserId: string,
): Promise<void> {
  await storage.delete(`${PUSH_SUB_PREFIX}${realUserId}`);
}

export async function getPushSubscription(
  storage: DurableObjectStorage,
  realUserId: string,
): Promise<PushSubscription | null> {
  const raw = await storage.get<string>(`${PUSH_SUB_PREFIX}${realUserId}`);
  if (!raw) return null;
  return JSON.parse(raw) as PushSubscription;
}

export type PushResult = "sent" | "expired" | "error";

export async function sendPushNotification(
  sub: PushSubscription,
  payload: Record<string, string>,
  vapidPrivateJWK: string,
  adminContact: string = "mailto:admin@peckingorder.app",
): Promise<PushResult> {
  try {
    const { endpoint, headers, body } = await buildPushHTTPRequest({
      privateJWK: vapidPrivateJWK,
      subscription: sub,
      message: {
        payload: payload as any,
        adminContact,
        options: { ttl: 86400, urgency: "high" },
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
