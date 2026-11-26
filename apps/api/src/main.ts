import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { NextFunction, Request, Response } from "express";
import { AppModule } from "./app.module";
import { assertProductionAndMainnetGates, corsOrigins } from "./boot-guards";

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

function securityHeaders(req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
}

async function bootstrap() {
  assertProductionAndMainnetGates();

  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.setGlobalPrefix("api/v1");
  app.enableCors({
    origin: corsOrigins(),
    credentials: true,
  });
  app.use(securityHeaders);
  const rateLimit =
    Number(process.env.XLAYER_CHAIN_ID) === 196
      ? Number(process.env.API_RATE_LIMIT_PER_MIN || 60)
      : Number(process.env.API_RATE_LIMIT_PER_MIN || 120);
  app.use(rateLimitMiddleware(rateLimit));

  const enableSwagger =
    process.env.ENABLE_SWAGGER === "true" || process.env.NODE_ENV !== "production";
  if (enableSwagger) {
    const config = new DocumentBuilder()
      .setTitle("AVENZA API")
      .setDescription("Programmable B2B payments and financial operations")
      .setVersion("1.0")
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("api/docs", app, document);
  }

  // Fly/Render inject PORT; local default remains 3001
  const port = Number(process.env.PORT || process.env.API_PORT || 3001);
  await app.listen(port, "0.0.0.0");
  // eslint-disable-next-line no-console
  console.log(
    `AVENZA API listening on :${port} (chain=${process.env.XLAYER_CHAIN_ID || "unset"}, swagger=${enableSwagger})`,
  );
}

bootstrap();
