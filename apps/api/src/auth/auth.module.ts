import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET is required in production");
    }
    return "dev-insecure-jwt-secret-change-me-32";
  }
  return secret;
}

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: jwtSecret(),
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN as `${number}d`) || "7d" },
    }),
  ],
  providers: [AuthService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
