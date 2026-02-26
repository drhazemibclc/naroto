// components/layout/header.tsx
'use client';

import {
  Activity,
  Baby,
  Calendar,
  FileText,
  FlaskConical,
  Home,
  LayoutDashboard,
  Menu,
  Pill,
  Syringe,
  Users
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

import { ModeToggle } from './mode-toggle';
import UserMenu from './user-menu';

// Navigation links organized by category
const mainLinks = [
  { label: 'Home', to: '/', icon: Home },
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard }
] as const;

const patientLinks = [
  { label: 'Patients', to: '/dashboard/patients', icon: Users },
  { label: 'Appointments', to: '/dashboard/appointments', icon: Calendar },
  {
    label: 'Medical Records',
    to: '/dashboard/medical-records',
    icon: FileText
  }
] as const;

const clinicalLinks = [
  { label: 'Growth Charts', to: '/dashboard/growth', icon: Activity },
  { label: 'Immunizations', to: '/dashboard/immunizations', icon: Syringe },
  { label: 'Prescriptions', to: '/dashboard/prescriptions', icon: Pill },
  { label: 'Lab Tests', to: '/dashboard/lab', icon: FlaskConical }
] as const;

const publicLinks = [
  { label: 'About', to: '/about' },
  { label: 'Services', to: '/services' },
  { label: 'Contact', to: '/contact' }
] as const;

export default function Header() {
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  // Check if we're in a public route or dashboard
  const isPublicRoute =
    pathname?.startsWith('/about') ||
    pathname?.startsWith('/services') ||
    pathname?.startsWith('/contact') ||
    pathname?.startsWith('/privacy') ||
    pathname?.startsWith('/terms');
  // Wait until after mounting so we know we're on the client
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className='sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60'>
      <div className='container flex h-16 items-center justify-between px-4 md:px-6'>
        {/* Logo */}
        <Link
          className='flex items-center gap-2 font-bold text-xl'
          href='/'
        >
          <Baby className='h-6 w-6 text-primary' />
          <span className='hidden sm:inline-block'>Pediatric Clinic</span>
          <span className='sm:hidden'>Clinic</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className='hidden md:flex md:items-center md:gap-6'>
          {isPublicRoute ? (
            // Public navigation
            <div className='flex gap-6'>
              {publicLinks.map(({ to, label }) => (
                <Link
                  className={cn(
                    'font-medium text-sm transition-colors hover:text-primary',
                    pathname === to ? 'text-primary' : 'text-muted-foreground'
                  )}
                  href={to}
                  key={to}
                >
                  {label}
                </Link>
              ))}
            </div>
          ) : (
            // Dashboard navigation
            <>
              <div className='flex gap-4'>
                {mainLinks.map(({ to, label, icon: Icon }) => (
                  <Link
                    className={cn(
                      'flex items-center gap-1 font-medium text-sm transition-colors hover:text-primary',
                      pathname === to ? 'text-primary' : 'text-muted-foreground'
                    )}
                    href={to}
                    key={to}
                  >
                    <Icon className='h-4 w-4' />
                    {label}
                  </Link>
                ))}
              </div>

              <div className='flex gap-4 border-l pl-4'>
                {patientLinks.map(({ to, label, icon: Icon }) => (
                  <Link
                    className={cn(
                      'flex items-center gap-1 font-medium text-sm transition-colors hover:text-primary',
                      pathname?.startsWith(to) ? 'text-primary' : 'text-muted-foreground'
                    )}
                    href={to}
                    key={to}
                  >
                    <Icon className='h-4 w-4' />
                    {label}
                  </Link>
                ))}
              </div>

              <div className='flex gap-4 border-l pl-4'>
                {clinicalLinks.map(({ to, label, icon: Icon }) => (
                  <Link
                    className={cn(
                      'flex items-center gap-1 font-medium text-sm transition-colors hover:text-primary',
                      pathname?.startsWith(to) ? 'text-primary' : 'text-muted-foreground'
                    )}
                    href={to}
                    key={to}
                  >
                    <Icon className='h-4 w-4' />
                    {label}
                  </Link>
                ))}
              </div>
            </>
          )}
        </nav>

        {/* Right side actions */}
        <div className='flex items-center gap-2'>
          <ModeToggle />
          <UserMenu />

          {/* Mobile Menu */}
          {mounted && (
            <Sheet
              onOpenChange={setIsOpen}
              open={isOpen}
            >
              <SheetTrigger
                asChild
                className='md:hidden'
              >
                <Button
                  size='icon'
                  variant='ghost'
                >
                  <Menu className='h-5 w-5' />
                  <span className='sr-only'>Toggle menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent
                className='w-75 sm:w-100'
                side='right'
              >
                <div className='flex flex-col gap-6 py-4'>
                  <Link
                    className='flex items-center gap-2 font-bold text-xl'
                    href='/'
                    onClick={() => setIsOpen(false)}
                  >
                    <Baby className='h-6 w-6 text-primary' />
                    Pediatric Clinic
                  </Link>

                  <nav className='flex flex-col gap-4'>
                    {isPublicRoute ? (
                      publicLinks.map(({ to, label }) => (
                        <Link
                          className='flex items-center gap-3 rounded-lg px-3 py-2 font-medium text-sm hover:bg-accent'
                          href={to}
                          key={to}
                          onClick={() => setIsOpen(false)}
                        >
                          {label}
                        </Link>
                      ))
                    ) : (
                      <>
                        <div className='space-y-2'>
                          <h3 className='font-semibold text-muted-foreground text-xs uppercase'>Main</h3>
                          {mainLinks.map(({ to, label, icon: Icon }) => (
                            <Link
                              className='flex items-center gap-3 rounded-lg px-3 py-2 font-medium text-sm hover:bg-accent'
                              href={to}
                              key={to}
                              onClick={() => setIsOpen(false)}
                            >
                              <Icon className='h-4 w-4' />
                              {label}
                            </Link>
                          ))}
                        </div>

                        <div className='space-y-2'>
                          <h3 className='font-semibold text-muted-foreground text-xs uppercase'>Patients</h3>
                          {patientLinks.map(({ to, label, icon: Icon }) => (
                            <Link
                              className='flex items-center gap-3 rounded-lg px-3 py-2 font-medium text-sm hover:bg-accent'
                              href={to}
                              key={to}
                              onClick={() => setIsOpen(false)}
                            >
                              <Icon className='h-4 w-4' />
                              {label}
                            </Link>
                          ))}
                        </div>

                        <div className='space-y-2'>
                          <h3 className='font-semibold text-muted-foreground text-xs uppercase'>Clinical</h3>
                          {clinicalLinks.map(({ to, label, icon: Icon }) => (
                            <Link
                              className='flex items-center gap-3 rounded-lg px-3 py-2 font-medium text-sm hover:bg-accent'
                              href={to}
                              key={to}
                              onClick={() => setIsOpen(false)}
                            >
                              <Icon className='h-4 w-4' />
                              {label}
                            </Link>
                          ))}
                        </div>
                      </>
                    )}
                  </nav>
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>
    </header>
  );
}
