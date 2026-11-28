import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { createHmac, randomBytes } from "node:crypto";
import { CreateWebhookEndpointSchema } from "@avenza/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { encryptSecret, revealMaybeEncryptedSecret } from "../crypto/secrets";

@Injectable()
export class WebhooksService {
  private readonly log = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createEndpoint(orgId: string, actorId: string, body: unknown) {
    const parsed = CreateWebhookEndpointSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const secret = `whsec_${randomBytes(24).toString("hex")}`;
    const row = await this.prisma.webhookEndpoint.create({
      data: {
        organizationId: orgId,
        url: parsed.data.url,
        description: parsed.data.description,
        secret: encryptSecret(secret),
        eventsJson: JSON.stringify(parsed.data.events),
      },
    });
    await this.audit.record({
      organizationId: orgId,
      actorId,
      eventType: "webhook.created",
      entityType: "webhook_endpoint",
      entityId: row.id,
      eventPayload: { url: row.url, events: parsed.data.events },
    });
    // Return plaintext secret once; DB stores AES-GCM ciphertext.
    return { ...row, secret };
  }

  listEndpoints(orgId: string) {
    return this.prisma.webhookEndpoint.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        url: true,
        description: true,
        eventsJson: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async revokeEndpoint(orgId: string, id: string, actorId: string) {
    const row = await this.prisma.webhookEndpoint.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!row) throw new NotFoundException();
    const updated = await this.prisma.webhookEndpoint.update({
      where: { id },
      data: { active: false },
    });
    await this.audit.record({
      organizationId: orgId,
      actorId,
      eventType: "webhook.revoked",
      entityType: "webhook_endpoint",
      entityId: id,
      eventPayload: {},
    });
    return updated;
  }

  /** Enqueue signed deliveries for matching endpoints. */
  async dispatch(orgId: string, eventType: string, payload: Record<string, unknown>) {
    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: { organizationId: orgId, active: true },
    });
    const body = {
      id: randomBytes(8).toString("hex"),
      type: eventType,
      createdAt: new Date().toISOString(),
      data: payload,
    };
    const created = [];
    for (const ep of endpoints) {
      const events = JSON.parse(ep.eventsJson) as string[];
      if (!events.includes(eventType) && !events.includes("*")) continue;
      const payloadJson = JSON.stringify(body);
      const delivery = await this.prisma.webhookDelivery.create({
        data: {
          endpointId: ep.id,
          eventType,
          payloadJson,
          status: "pending",
          nextAttemptAt: new Date(),
        },
      });
      created.push(delivery);
      const plainSecret = revealMaybeEncryptedSecret(ep.secret);
      void this.enqueueBull(delivery.id, ep.url, plainSecret, eventType, payloadJson);
      // Best-effort immediate delivery (worker retries via queue).
      void this.attemptDelivery(delivery.id);
    }
    return created;
  }

  private async enqueueBull(
    deliveryId: string,
    url: string,
    secret: string,
    eventType: string,
    payloadJson: string,
  ) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) return;
    try {
      const { Queue } = await import("bullmq");
      const IORedis = (await import("ioredis")).default;
      const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
      const q = new Queue("webhooks", { connection });
      await q.add(
        "deliver_webhook",
        { deliveryId, url, secret, eventType, payloadJson },
        { removeOnComplete: 100, attempts: 5, backoff: { type: "exponential", delay: 2000 } },
      );
      await q.close();
      connection.disconnect();
    } catch (e) {
      this.log.warn(`webhook enqueue failed: ${(e as Error).message}`);
    }
  }

  sign(secret: string, payload: string, timestamp: number) {
    return createHmac("sha256", secret)
      .update(`${timestamp}.${payload}`)
      .digest("hex");
  }

  async attemptDelivery(deliveryId: string) {
    const delivery = await this.prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: { endpoint: true },
    });
    if (!delivery || !delivery.endpoint.active) return { ok: false, reason: "missing" };

    const timestamp = Math.floor(Date.now() / 1000);
    const plainSecret = revealMaybeEncryptedSecret(delivery.endpoint.secret);
    const signature = this.sign(plainSecret, delivery.payloadJson, timestamp);
    try {
      const res = await fetch(delivery.endpoint.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-avenza-timestamp": String(timestamp),
          "x-avenza-signature": signature,
          "x-avenza-event": delivery.eventType,
        },
        body: delivery.payloadJson,
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await this.prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: "delivered",
          attempts: { increment: 1 },
          deliveredAt: new Date(),
          lastError: null,
        },
      });
      return { ok: true };
    } catch (e) {
      const attempts = delivery.attempts + 1;
      const backoffMs = Math.min(60 * 60 * 1000, 2 ** Math.min(attempts, 8) * 1000);
      await this.prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: attempts >= 10 ? "failed" : "pending",
          attempts,
          lastError: (e as Error).message,
          nextAttemptAt: new Date(Date.now() + backoffMs),
        },
      });
      return { ok: false, reason: (e as Error).message };
    }
  }

  listPending(limit = 50) {
    return this.prisma.webhookDelivery.findMany({
      where: {
        status: "pending",
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }],
      },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
  }

  async markStatus(deliveryId: string, status: "delivered" | "failed", lastError?: string) {
    const delivery = await this.prisma.webhookDelivery.findUnique({ where: { id: deliveryId } });
    if (!delivery) throw new NotFoundException();
    return this.prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status,
        attempts: { increment: 1 },
        lastError: lastError || null,
        ...(status === "delivered" ? { deliveredAt: new Date() } : {}),
      },
    });
  }
}
