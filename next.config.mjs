/**
 * Use separate dist directories for dev/prod to avoid conflicts.
 * - dev: .next-dev
 * - prod: .next (default)
 */
export default function nextConfig(phase) {
  const base = {
    reactStrictMode: true,
    experimental: {
      typedRoutes: true,
    },
  };

  // next passes a phase string like 'phase-development-server'
  if (phase === 'phase-development-server') {
    return { ...base, distDir: '.next-dev' };
  }

  return { ...base, distDir: '.next' };
}
