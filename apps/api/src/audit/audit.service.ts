import { Injectable } from "@nestjs/common";
import { chainAuditHash } from "@avenza/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: {
    organizationId: string;
    actorId?: string | null;
    eventType: string;
    entityType: string;
    entityId: string;
    eventPayload: Record<string, unknown>;
  }) {
    const last = await this.prisma.auditEvent.findFirst({
      where: { organizationId: input.organizationId },
      orderBy: { createdAt: "desc" },
    });
    const previousHash = last?.currentHash ?? "genesis";
    const currentHash = chainAuditHash(previousHash, {
      ...input.eventPayload,
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId,
    });
    const actorId =
      input.actorId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.actorId)
        ? input.actorId
        : null;

    return this.prisma.auditEvent.create({
      data: {
        organizationId: input.organizationId,
        actorId,
        eventType: input.eventType,
        entityType: input.entityType,
        entityId: input.entityId,
        eventPayload: JSON.stringify(input.eventPayload),
        previousHash,
        currentHash,
      },
    });
  }

  list(organizationId: string, take = 100) {
    return this.prisma.auditEvent.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take,
    });
  }
}
