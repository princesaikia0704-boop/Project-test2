/**
 * Corporate Office Store - Upstash QStash Queue Publisher & Webhook Receiver
 * Transparent fallback for background task dispatch and HMAC signature verification.
 */

import { Client, Receiver } from "@upstash/qstash";
import { NextRequest } from "next/server";
import { isServiceMocked } from "@/lib/mock/utils";

export interface QStashPublishOptions {
  url: string;
  body?: any;
  headers?: Record<string, string>;
  delay?: number;
}

export interface IQStashClient {
  publishJSON(opts: QStashPublishOptions): Promise<{ messageId: string }>;
  publish(opts: QStashPublishOptions): Promise<{ messageId: string }>;
}

export class MockQStashClient implements IQStashClient {
  async publishJSON(opts: QStashPublishOptions): Promise<{ messageId: string }> {
    return { messageId: `msg_mock_${Date.now()}_${Math.random().toString(36).substring(7)}` };
  }

  async publish(opts: QStashPublishOptions): Promise<{ messageId: string }> {
    return this.publishJSON(opts);
  }
}

declare global {
  // eslint-disable-next-line no-var
  var _qstashClient: IQStashClient | undefined;
  // eslint-disable-next-line no-var
  var _qstashReceiver: Receiver | undefined;
}

export function getQStashClient(): IQStashClient {
  if (isServiceMocked("qstash")) {
    if (!globalThis._qstashClient) {
      globalThis._qstashClient = new MockQStashClient();
    }
    return globalThis._qstashClient;
  }

  return new Client({ token: process.env.QSTASH_TOKEN! });
}

export function getQStashReceiver(): Receiver | null {
  if (isServiceMocked("qstash")) {
    return null;
  }

  if (!globalThis._qstashReceiver) {
    globalThis._qstashReceiver = new Receiver({
      currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY || "",
      nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || "",
    });
  }
  return globalThis._qstashReceiver;
}

export const qstash = getQStashClient();

export async function verifySignatureAppRouter(
  req: NextRequest | Request,
  rawBody?: string
): Promise<{ isValid: boolean; error?: string }> {
  const signature =
    req.headers.get("upstash-signature") ||
    req.headers.get("x-upstash-signature") ||
    (req as any).rawSignature;

  // Rejection of missing or empty signature (T1-F06-02, T2-F06-01)
  if (!signature || signature.trim() === "") {
    return { isValid: false, error: "InvalidSignature" };
  }

  // Mock / Development Verification
  if (isServiceMocked("qstash")) {
    if (signature === "mock_valid_signature") {
      return { isValid: true };
    }
    // Any other mock signature (e.g., 'invalid_signature', 'forged_signature_token') fails (T1-F06-03, T2-F06-02)
    return { isValid: false, error: "InvalidSignature" };
  }

  // Live Cloud Verification
  const receiver = getQStashReceiver();
  if (!receiver) {
    return { isValid: false, error: "InvalidSignature" };
  }

  try {
    const body = rawBody ?? (await req.text());
    const isValid = await receiver.verify({
      signature,
      body,
      url: req.url,
    });
    return { isValid, error: isValid ? undefined : "InvalidSignature" };
  } catch {
    return { isValid: false, error: "InvalidSignature" };
  }
}
