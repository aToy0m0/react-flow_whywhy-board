'use client';

import { usePathname } from 'next/navigation';
import AppNav from './AppNav';
import { SessionInfo } from '@/types/session';

export default function AppNavWrapper({
  session,
  onNavStateChange,
}: {
  session: SessionInfo | null;
  onNavStateChange?: (visible: boolean) => void;
}) {
  const pathname = usePathname();
  const showNav = !/^\/tenants\/[^/]+\/boards\/[^/]+$/.test(pathname);

  // 通知（初回のみ）
  onNavStateChange?.(showNav);

  if (!showNav) return null;
  return <AppNav session={session} />;
}
