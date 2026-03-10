import { redirect } from 'next/navigation';
import { isSuperAdmin } from '@/lib/super-admin';
import AdminShell from './AdminShell';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const allowed = await isSuperAdmin();
  if (!allowed) {
    redirect('/');
  }

  return <AdminShell>{children}</AdminShell>;
}
