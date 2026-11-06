'use client';

import { Building2, ClipboardList, House, Tablet, UserRound, UsersRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/cn';
import type { NavItem } from '@/lib/navigation';

const ICONS: Readonly<Record<string, LucideIcon>> = {
  '/': House,
  '/pesquisas': ClipboardList,
  '/clientes': Building2,
  '/dispositivos': Tablet,
  '/usuarios': UsersRound,
  '/minha-conta': UserRound,
};

export function NavLinks({ items }: { items: readonly NavItem[] }) {
  const pathname = usePathname();
  return (
    <ul className="flex gap-1 md:flex-col">
      {items.map((item) => {
        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
        const Icon = ICONS[item.href] ?? House;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                // The red bar on the active item is the "linha AZ" of the panel.
                'relative flex h-11 items-center gap-3 rounded-sm px-3 text-sm font-semibold whitespace-nowrap transition-colors',
                'before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-pill before:bg-sidebar-accent before:opacity-0 before:transition-opacity',
                active
                  ? 'bg-sidebar-hover text-sidebar-foreground before:opacity-100'
                  : 'text-sidebar-muted-foreground hover:bg-sidebar-hover hover:text-sidebar-foreground',
              )}
            >
              <Icon aria-hidden className="size-[18px] shrink-0" strokeWidth={1.75} />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
