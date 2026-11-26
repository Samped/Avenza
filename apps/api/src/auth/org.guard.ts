import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { roleHasPermission, type OrgRole } from "@avenza/shared";
import { PrismaService } from "../prisma/prisma.service";
import { PERMISSIONS_KEY } from "./permissions.decorator";

@Injectable()
export class OrgGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const orgId =
      req.params.orgId ||
      req.params.organizationId ||
      req.headers["x-organization-id"];
    if (!orgId) throw new ForbiddenException("Organization required");
    if (!req.user?.userId) throw new ForbiddenException();

    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId: req.user.userId,
        },
      },
    });
    if (!membership || membership.status !== "active") {
      throw new ForbiddenException("Not a member of this organization");
    }

    req.user.organizationId = orgId;
    req.user.role = membership.role;

    const needed = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (needed?.length) {
      const ok = needed.every((p) => roleHasPermission(membership.role as OrgRole, p));
      if (!ok) throw new ForbiddenException("Insufficient permissions");
    }
    return true;
  }
}
