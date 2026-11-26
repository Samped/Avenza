import type { MemberRole } from "@prisma/client";

export type AuthUser = {
  userId: string;
  email: string;
  fullName: string;
  organizationId?: string;
  role?: MemberRole;
};
