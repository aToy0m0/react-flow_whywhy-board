import { NextResponse } from 'next/server';
import { createSuperAdmin } from '@/lib/superAdmin';

export async function POST(request: Request) {
  try {
    let body: unknown;
    if (request.headers.get('content-type')?.includes('application/json')) {
      body = await request.json().catch(() => undefined);
    }

    let payload:
      | {
          email?: string;
          password?: string;
          tenantSlug?: string;
          tenantName?: string;
        }
      | undefined;

    if (body && typeof body === 'object' && body !== null) {
      const record = body as Record<string, unknown>;
      payload = {
        email: typeof record.email === 'string' ? record.email : undefined,
        password: typeof record.password === 'string' ? record.password : undefined,
        tenantSlug: typeof record.tenantSlug === 'string' ? record.tenantSlug : undefined,
        tenantName: typeof record.tenantName === 'string' ? record.tenantName : undefined,
      };
    }

    const result = await createSuperAdmin(payload);
    return NextResponse.json({
      ok: true,
      created: result.created,
      updated: result.updated,
      email: result.email,
      message: result.created
        ? 'Super admin user created'
        : result.updated
        ? 'Super admin password updated'
        : 'Super admin user already exists',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, hint: 'Send a POST request to initialize the super admin user.' });
}
