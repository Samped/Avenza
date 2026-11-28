import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { createXLayerPublicClient } from "@avenza/chain";
import { PrismaService } from "./prisma/prisma.service";

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async health() {
    const checks: Record<string, "ok" | "skip" | "fail"> = {
      database: "fail",
      redis: "skip",
      rpc: "skip",
    };
    const detail: Record<string, string> = {};

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = "ok";
    } catch (e) {
      detail.database = (e as Error).message;
    }

    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      try {
        const IORedis = (await import("ioredis")).default;
        const redis = new IORedis(redisUrl, {
          maxRetriesPerRequest: 1,
          connectTimeout: 2_000,
          lazyConnect: true,
        });
        await redis.connect();
        const pong = await redis.ping();
        await redis.quit();
        checks.redis = pong === "PONG" ? "ok" : "fail";
      } catch (e) {
        checks.redis = "fail";
        detail.redis = (e as Error).message;
      }
    }

    const chainId = Number(process.env.XLAYER_CHAIN_ID || 0);
    const rpc = process.env.XLAYER_RPC_URL;
    if (chainId && rpc) {
      try {
        const client = createXLayerPublicClient(chainId, rpc);
        const block = await client.getBlockNumber();
        checks.rpc = "ok";
        detail.rpcBlock = String(block);
      } catch (e) {
        checks.rpc = "fail";
        detail.rpc = (e as Error).message;
      }
    }

    const failed = Object.values(checks).includes("fail");
    const body = {
      status: failed ? "degraded" : "ok",
      service: "avenza-api",
      time: new Date().toISOString(),
      chainId: chainId || null,
      checks,
      detail,
    };
    if (checks.database === "fail") {
      throw new ServiceUnavailableException(body);
    }
    return body;
  }
}
