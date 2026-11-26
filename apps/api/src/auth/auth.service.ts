import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { RegisterSchema, LoginSchema } from "@avenza/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(body: unknown) {
    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const existing = await this.prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
    if (existing) throw new ConflictException("Email already registered");

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: parsed.data.email.toLowerCase(),
        passwordHash,
        fullName: parsed.data.fullName,
      },
    });
    return this.tokenFor(user.id, user.email, user.fullName);
  }

  async login(body: unknown) {
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const user = await this.prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
    if (!user) throw new UnauthorizedException("Invalid credentials");
    const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException("Invalid credentials");
    return this.tokenFor(user.id, user.email, user.fullName);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          where: { status: "active" },
          include: { organization: true },
        },
      },
    });
    if (!user) throw new UnauthorizedException();
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      organizations: user.memberships.map((m) => ({
        id: m.organization.id,
        legalName: m.organization.legalName,
        role: m.role,
        status: m.organization.status,
      })),
    };
  }

  private tokenFor(userId: string, email: string, fullName: string) {
    const accessToken = this.jwt.sign({ sub: userId, email, fullName });
    return { accessToken, user: { id: userId, email, fullName } };
  }
}
