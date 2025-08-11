import { AuthGuard } from '@/components/auth-guard';
import type { ReactNode } from 'react';

export default function HistoryLayout({ children }: { children: ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
