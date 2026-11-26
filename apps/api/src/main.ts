import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { NextFunction, Request, Response } from "express";
import { AppModule } from "./app.module";

function assertProdSecrets() {
  if (process.env.NODE_ENV !== "production") return;
  const required = [
    "JWT_SECRET",
    "ENCRYPTION_KEY",
    "AVENZA_FIELD_ENCRYPTION_KEY",
    "INTERNAL_WEBHOOK_TOKEN",
  ] as const;
  const missing = required.filter((k) => !process.env[k] || process.env[k] === "dev");
  if (missing.length) {
    throw new Error(`Missing required production secrets: ${missing.join(", ")}`);
  }
  if (process.env.ALLOW_TAPEOUT_LOCAL_FALLBACK === "true") {
    throw new Error("ALLOW_TAPEOUT_LOCAL_FALLBACK must be false in production");
  }
  if (process.env.JWT_SECRET === "dev-insecure-jwt-secret-change-me-32") {
    throw new Error("JWT_SECRET must not use the insecure default in production");
  }
}

/** Simple fixed-window rate limit per IP (no extra dependency). */
function rateLimitMiddleware(limit = 120, windowMs = 60_000) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
    const now = Date.now();
    const row = hits.get(ip);
    if (!row || row.resetAt <= now) {
      hits.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }
    row.count += 1;
    if (row.count > limit) {
      res.status(429).json({ message: "Too many requests" });
      return;
    }
    next();
  };
}

async function bootstrap() {
  assertProdSecrets();

  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.setGlobalPrefix("api/v1");
  app.enableCors({
    origin: process.env.APP_URL || "http://localhost:3000",
    credentials: true,
  });
  app.use(rateLimitMiddleware(Number(process.env.API_RATE_LIMIT_PER_MIN || 120)));

  const config = new DocumentBuilder()
    .setTitle("AVENZA API")
    .setDescription("Programmable B2B payments and financial operations")
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);

  const port = Number(process.env.API_PORT || 3001);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`AVENZA API listening on :${port}`);
}

bootstrap();
