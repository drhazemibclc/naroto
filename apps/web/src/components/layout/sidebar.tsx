'use client';

import { Calendar, FileText, LayoutDashboard, LogOut, Menu, Pill, Settings, TrendingUp, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const navItems = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard
  },
  {
    label: 'Patients',
    href: '/dashboard/patients',
    icon: Users
  },
  {
    label: 'Medical Records',
    href: '/dashboard/medical-records',
    icon: FileText
  },
  {
    label: 'Growth Charts',
    href: '/dashboard/growth-charts',
    icon: TrendingUp
  },
  {
    label: 'Prescriptions',
    href: '/dashboard/prescriptions',
    icon: Pill
  },
  {
    label: 'Appointments',
    href: '/dashboard/appointments',
    icon: Calendar
  },
  {
    label: 'Settings',
    href: '/dashboard/settings',
    icon: Settings
  }
];

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile Menu */}
      <Sheet
        onOpenChange={setOpen}
        open={open}
      >
        <SheetTrigger
          asChild
          className='lg:hidden'
        >
          <Button
            size='icon'
            variant='ghost'
          >
            <Menu className='h-5 w-5' />
          </Button>
        </SheetTrigger>
        <SheetContent
          className='w-64'
          side='left'
        >
          <nav className='flex flex-col gap-2 py-4'>
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href);

              return (
                <Link
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 font-medium text-sm transition-colors',
                    isActive ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'
                  )}
                  href={item.href}
                  key={item.href}
                  onClick={() => setOpen(false)}
                >
                  <Icon className='h-4 w-4' />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar */}
      <aside className='hidden w-64 border-r bg-muted/40 lg:flex lg:flex-col'>
        <div className='flex h-16 items-center border-b px-6'>
          <h1 className='font-bold text-xl'>PediClinic</h1>
        </div>

        <nav className='flex-1 space-y-2 p-4'>
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href);

            return (
              <Link
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 font-medium text-sm transition-colors',
                  isActive ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'
                )}
                href={item.href}
                key={item.href}
              >
                <Icon className='h-4 w-4' />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className='border-t p-4'>
          <Button
            className='w-full bg-transparent'
            size='sm'
            variant='outline'
          >
            <LogOut className='mr-2 h-4 w-4' />
            Logout
          </Button>
        </div>
      </aside>
    </>
  );
}
