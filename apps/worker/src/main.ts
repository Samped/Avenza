import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { createHmac } from "node:crypto";

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const apiBase = (process.env.API_INTERNAL_URL || process.env.API_URL || "http://127.0.0.1:3001").replace(
  /\/$/,
  "",
);
const internalToken = process.env.INTERNAL_WEBHOOK_TOKEN || "dev";

async function deliverWebhook(job: {
  deliveryId: string;
  url: string;
  secret: string;
  eventType: string;
  payloadJson: string;
}) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", job.secret)
    .update(`${timestamp}.${job.payloadJson}`)
    .digest("hex");
  try {
    const res = await fetch(job.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-avenza-timestamp": String(timestamp),
        "x-avenza-signature": signature,
        "x-avenza-event": job.eventType,
      },
      body: job.payloadJson,
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await fetch(`${apiBase}/api/v1/internal/webhooks/deliveries/${job.deliveryId}/status`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-avenza-internal": internalToken,
      },
      body: JSON.stringify({ status: "delivered" }),
    }).catch(() => null);
    return { ok: true };
  } catch (e) {
    await fetch(`${apiBase}/api/v1/internal/webhooks/deliveries/${job.deliveryId}/status`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-avenza-internal": internalToken,
      },
      body: JSON.stringify({ status: "failed", lastError: (e as Error).message }),
    }).catch(() => null);
    throw e;
  }
}

async function monitorPayment(job: { organizationId: string; paymentId: string }) {
  if (!job.organizationId || !job.paymentId) {
    throw new Error("payment-monitor requires organizationId + paymentId");
  }
  const res = await fetch(
    `${apiBase}/api/v1/internal/payments/${job.organizationId}/${job.paymentId}/refresh-status`,
    {
      method: "POST",
      headers: { "x-avenza-internal": internalToken },
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`payment refresh ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function main() {
  if (process.env.NODE_ENV === "production" && internalToken === "dev") {
    throw new Error("INTERNAL_WEBHOOK_TOKEN must be set in production (not 'dev')");
  }

  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

  const invoiceQueue = new Queue("invoice-pipeline", { connection });
  const paymentQueue = new Queue("payment-monitor", { connection });
  const webhookQueue = new Queue("webhooks", { connection });

  new Worker(
    "invoice-pipeline",
    async (job) => {
      console.log(`[invoice-pipeline] job=${job.id} name=${job.name}`, job.data);
      return { ok: true, deferred: true };
    },
    { connection },
  );

  new Worker(
    "payment-monitor",
    async (job) => {
      console.log(`[payment-monitor] paymentId=${job.data.paymentId}`);
      return monitorPayment(job.data);
    },
    { connection },
  );

  new Worker(
    "webhooks",
    async (job) => {
      if (job.name !== "deliver_webhook") throw new Error(`Unknown job ${job.name}`);
      if (job.data.url && job.data.secret && job.data.payloadJson) {
        return deliverWebhook(job.data);
      }
      if (job.data.deliveryId) {
        const res = await fetch(
          `${apiBase}/api/v1/internal/webhooks/deliveries/${job.data.deliveryId}/attempt`,
          {
            method: "POST",
            headers: { "x-avenza-internal": internalToken },
          },
        );
        if (!res.ok) throw new Error(`API delivery attempt ${res.status}`);
        return res.json();
      }
      return { ok: true, deferred: true };
    },
    { connection },
  );

  console.log("AVENZA worker started (invoice-pipeline, payment-monitor, webhooks)");
  await invoiceQueue.waitUntilReady();
  await paymentQueue.waitUntilReady();
  await webhookQueue.waitUntilReady();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
