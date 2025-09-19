export { default } from 'next-auth/middleware';

export const config = {
  matcher: [
    '/:tenantId/board/:path*',
    '/manage/:path*',
    '/:tenantId/manage/:path*',
    '/login',
    '/admin/:path*',
    '/docs/:path*',
    '/api/tenants/:path*',
  ],
};
