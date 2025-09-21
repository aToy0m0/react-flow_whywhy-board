import type { DefaultSession } from 'next-auth';
import type { JWT } from 'next-auth/jwt';

declare module 'next-auth' {
  type Role = 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'MEMBER';

  interface Session {
    user: DefaultSession['user'] & {
      id: string;
      role: Role;
      tenantId: string;
    };
  }

  interface User {
    id: string;
    email: string;
    role: Role;
    tenantId: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'MEMBER';
    tenantId?: string;
  }
}
