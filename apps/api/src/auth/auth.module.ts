import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";

@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
          if (process.env.NODE_ENV === "production") {
            throw new Error("JWT_SECRET is required in production");
          }
          return {
            secret: "dev-insecure-jwt-secret-change-me-32",
            signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN as `${number}d`) || "7d" },
          };
        }
        return {
          secret,
          signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN as `${number}d`) || "7d" },
        };
      },
    }),
  ],
  providers: [AuthService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
