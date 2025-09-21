'use client';

import { useState } from 'react';
import AppNavWrapper from '@/components/AppNavWrapper';
import { SessionInfo } from '@/types/session';

export default function ClientLayout({
  children,
  sessionInfo,
}: {
  children: React.ReactNode;
  sessionInfo: SessionInfo | null;
}) {
  const [showNav, setShowNav] = useState(true);

  return (
    <>
      <AppNavWrapper session={sessionInfo} onNavStateChange={setShowNav} />
      <div className={showNav ? 'pt-16' : ''}>{children}</div>
    </>
  );
}
