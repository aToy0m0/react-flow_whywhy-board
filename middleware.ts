export { default } from 'next-auth/middleware';

export const config = {
  matcher: [
    '/',
    '/init/:path*',
    '/manage/:path*',
    '/tenants/:path*',
    // '/api/tenants/:path*', // API routes handle their own auth
  ],
};
