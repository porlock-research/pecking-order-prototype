'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';

const NAV_ITEMS = [
  { href: '/admin', label: 'Games', icon: '🎮' },
  { href: '/admin/personas', label: 'Personas', icon: '🎭' },
  { href: '/admin/signups', label: 'Signups', icon: '📋' },
  { href: '/admin/tools', label: 'Tools', icon: '🔧' },
];

function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  const crumbs: Array<{ label: string; href: string }> = [];
  let href = '';
  for (const seg of segments) {
    href += `/${seg}`;
    const label = seg === 'admin' ? 'Admin'
      : seg === 'games' ? 'Games'
      : seg === 'personas' ? 'Personas'
      : seg === 'signups' ? 'Signups'
      : seg === 'tools' ? 'Tools'
      : seg === 'inspector' ? 'Inspector'
      : seg;
    crumbs.push({ label, href });
  }

  return (
    <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
      {crumbs.map((crumb, i) => (
        <span key={crumb.href} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-muted-foreground/50">/</span>}
          {i === crumbs.length - 1 ? (
            <span className="text-foreground font-medium">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className="hover:text-foreground transition-colors">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}

function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const isActive = item.href === '/admin'
          ? pathname === '/admin' || pathname.startsWith('/admin/games/')
          : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground'
            )}
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Mobile header */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background px-4 lg:hidden">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" className="lg:hidden">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-4">
            <SheetTitle className="text-lg font-bold mb-4">Pecking Order</SheetTitle>
            <SidebarNav />
          </SheetContent>
        </Sheet>
        <Breadcrumbs />
      </header>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex lg:w-56 lg:flex-col lg:fixed lg:inset-y-0 border-r bg-background">
          <div className="flex h-14 items-center px-4 border-b">
            <Link href="/admin" className="text-lg font-bold tracking-tight">
              Pecking Order
            </Link>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <SidebarNav />
          </div>
          <div className="p-3 border-t">
            <p className="text-xs text-muted-foreground">Admin Dashboard</p>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 lg:pl-56">
          <div className="hidden lg:flex h-14 items-center gap-4 border-b px-6">
            <Breadcrumbs />
          </div>
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
