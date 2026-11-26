import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { CreateApiKeySchema } from "@avenza/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

export const PARTNER_SCOPES = [
  "invoices:read",
  "invoices:write",
  "approvals:submit", // submit for approval only — cannot decide
  "approvals:write", // legacy alias of approvals:submit (cannot decide)
  "payments:read",
  "payments:initiate", // create / authorize only — cannot settle
  "payments:settle", // execute / batch settle (requires prior human approvals)
  "suppliers:read",
  "treasury:read",
] as const;

function hashApiKey(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

function generateApiKey() {
  const raw = `avz_live_${randomBytes(24).toString("hex")}`;
  return { raw, prefix: raw.slice(0, 16), hash: hashApiKey(raw) };
}

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(orgId: string, actorId: string, body: unknown) {
    const parsed = CreateApiKeySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    for (const s of parsed.data.scopes) {
      if (!(PARTNER_SCOPES as readonly string[]).includes(s)) {
        throw new BadRequestException(`Unknown scope: ${s}`);
      }
    }
    const key = generateApiKey();
    const row = await this.prisma.apiKey.create({
      data: {
        organizationId: orgId,
        name: parsed.data.name,
        keyPrefix: key.prefix,
        keyHash: key.hash,
        scopesJson: JSON.stringify(parsed.data.scopes),
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      },
    });
    await this.audit.record({
      organizationId: orgId,
      actorId,
      eventType: "api_key.created",
      entityType: "api_key",
      entityId: row.id,
      eventPayload: { name: row.name, prefix: row.keyPrefix, scopes: parsed.data.scopes },
    });
    return {
      id: row.id,
      name: row.name,
      keyPrefix: row.keyPrefix,
      scopes: parsed.data.scopes,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      rawKey: key.raw,
    };
  }

  list(orgId: string) {
    return this.prisma.apiKey.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopesJson: true,
        lastUsedAt: true,
        expiresAt: true,
        revokedAt: true,
        createdAt: true,
      },
    });
  }

  async revoke(orgId: string, keyId: string, actorId: string) {
    const row = await this.prisma.apiKey.findFirst({
      where: { id: keyId, organizationId: orgId },
    });
    if (!row) throw new NotFoundException();
    if (row.revokedAt) return row;
    const updated = await this.prisma.apiKey.update({
      where: { id: keyId },
      data: { revokedAt: new Date() },
    });
    await this.audit.record({
      organizationId: orgId,
      actorId,
      eventType: "api_key.revoked",
      entityType: "api_key",
      entityId: keyId,
      eventPayload: {},
    });
    return updated;
  }

  async authenticate(
    authorization: string | undefined,
    requiredScopes: string[],
  ): Promise<{ organizationId: string; apiKeyId: string; scopes: string[] }> {
    if (!authorization?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Bearer API key required");
    }
    const raw = authorization.slice(7).trim();
    if (!raw.startsWith("avz_")) throw new UnauthorizedException("Invalid API key");
    const hash = hashApiKey(raw);
    const row = await this.prisma.apiKey.findFirst({ where: { keyHash: hash } });
    if (!row || row.revokedAt) throw new UnauthorizedException("Invalid API key");
    if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException("API key expired");
    }
    const scopes = JSON.parse(row.scopesJson) as string[];
    for (const needed of requiredScopes) {
      if (!scopes.includes(needed)) {
        throw new UnauthorizedException(`Missing scope: ${needed}`);
      }
    }
    // Constant-time-ish compare already via hash lookup; touch lastUsed
    await this.prisma.apiKey.update({
      where: { id: row.id },
      data: { lastUsedAt: new Date() },
    });
    // Prevent timing leaks on prefix display path
    const prefixBuf = Buffer.from(row.keyPrefix);
    const rawPrefix = Buffer.from(raw.slice(0, row.keyPrefix.length));
    if (
      prefixBuf.length === rawPrefix.length &&
      !timingSafeEqual(prefixBuf, rawPrefix)
    ) {
      throw new UnauthorizedException("Invalid API key");
    }
    return { organizationId: row.organizationId, apiKeyId: row.id, scopes };
  }
}
