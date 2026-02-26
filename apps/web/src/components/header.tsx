'use client';

import {
  Activity,
  Baby,
  Bell,
  Calendar,
  FileText,
  FlaskConical,
  HeartPulse,
  Home,
  LayoutDashboard,
  Menu,
  Pill,
  Search,
  Stethoscope,
  Syringe,
  Users,
  X
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

import { ModeToggle } from './mode-toggle';
import UserMenu from './user-menu';

// Types for navigation
interface NavLink {
  badge?: number;
  disabled?: boolean;
  icon: React.ElementType;
  label: string;
  to: string;
}

interface NavCategory {
  links: NavLink[];
  title: string;
}

// Navigation links organized by category
const mainLinks: NavLink[] = [
  { label: 'Home', to: '/', icon: Home },
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard }
];

const patientLinks: NavLink[] = [
  { label: 'Patients', to: '/dashboard/patients', icon: Users },
  { label: 'Appointments', to: '/dashboard/appointments', icon: Calendar },
  { label: 'Medical Records', to: '/dashboard/medical-records', icon: FileText }
];

const clinicalLinks: NavLink[] = [
  { label: 'Growth Charts', to: '/dashboard/growth', icon: Activity },
  { label: 'Immunizations', to: '/dashboard/immunizations', icon: Syringe },
  { label: 'Prescriptions', to: '/dashboard/prescriptions', icon: Pill },
  { label: 'Lab Tests', to: '/dashboard/lab', icon: FlaskConical }
];

const publicLinks: NavLink[] = [
  { label: 'About', to: '/about', icon: Stethoscope },
  { label: 'Services', to: '/services', icon: HeartPulse },
  { label: 'Contact', to: '/contact', icon: Users }
];

// Navigation categories for mobile
const dashboardNavCategories: NavCategory[] = [
  { title: 'Main', links: mainLinks },
  { title: 'Patients', links: patientLinks },
  { title: 'Clinical', links: clinicalLinks }
];

export default function Header() {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const pathname = usePathname();

  // Check if we're in a public route or dashboard
  const isPublicRoute =
    pathname?.startsWith('/about') ||
    pathname?.startsWith('/services') ||
    pathname?.startsWith('/contact') ||
    pathname?.startsWith('/privacy') ||
    pathname?.startsWith('/terms');

  // Mock notification count - replace with real data
  const notificationCount = 3;

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Handle search navigation
      window.location.href = `/search?q=${encodeURIComponent(searchQuery)}`;
      setSearchQuery('');
      setIsSearchOpen(false);
    }
  };

  if (!mounted) return null;

  return (
    <header className='sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60'>
      <div className='container flex h-16 items-center justify-between px-4 md:px-6'>
        {/* Logo Section */}
        <div className='flex items-center gap-2'>
          <Link
            aria-label='Pediatric Clinic Home'
            className='flex items-center gap-2.5 transition-opacity hover:opacity-80'
            href='/'
          >
            <div className='relative'>
              <Baby className='h-7 w-7 text-primary' />
              <span className='absolute -top-1 -right-1 flex h-3 w-3'>
                <span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75' />
                <span className='relative inline-flex h-3 w-3 rounded-full bg-primary' />
              </span>
            </div>
            <div className='flex flex-col'>
              <span className='font-bold text-lg leading-tight'>Pediatric Clinic</span>
              <span className='text-[10px] text-muted-foreground leading-tight'>Expert Care for Children</span>
            </div>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className='hidden lg:flex lg:items-center lg:gap-6'>
          {isPublicRoute ? (
            // Public navigation
            <div className='flex items-center gap-6'>
              {publicLinks.map(({ to, label, icon: Icon }) => (
                <Link
                  className={cn(
                    'flex items-center gap-1.5 font-medium text-sm transition-colors hover:text-primary',
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
          ) : (
            // Dashboard navigation
            <div className='flex items-center gap-8'>
              {/* Main section */}
              <div className='flex items-center gap-4'>
                {mainLinks.map(({ to, label, icon: Icon }) => (
                  <Link
                    className={cn(
                      'flex items-center gap-1.5 font-medium text-sm transition-colors hover:text-primary',
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

              <Separator
                className='h-6'
                orientation='vertical'
              />

              {/* Patients section */}
              <div className='flex items-center gap-4'>
                {patientLinks.map(({ to, label, icon: Icon }) => (
                  <Link
                    className={cn(
                      'flex items-center gap-1.5 font-medium text-sm transition-colors hover:text-primary',
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

              <Separator
                className='h-6'
                orientation='vertical'
              />

              {/* Clinical section */}
              <div className='flex items-center gap-4'>
                {clinicalLinks.map(({ to, label, icon: Icon }) => (
                  <Link
                    className={cn(
                      'flex items-center gap-1.5 font-medium text-sm transition-colors hover:text-primary',
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
            </div>
          )}
        </nav>

        {/* Right side actions */}
        <div className='flex items-center gap-1 md:gap-2'>
          {/* Search Toggle (Mobile) */}
          <Button
            aria-label='Toggle search'
            className='lg:hidden'
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            size='icon'
            variant='ghost'
          >
            {isSearchOpen ? <X className='h-5 w-5' /> : <Search className='h-5 w-5' />}
          </Button>

          {/* Desktop Search */}
          <form
            className='hidden lg:block'
            onSubmit={handleSearch}
          >
            <div className='relative'>
              <Search className='absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground' />
              <Input
                className='w-64 pl-8'
                onChange={e => setSearchQuery(e.target.value)}
                placeholder='Search patients, appointments...'
                type='search'
                value={searchQuery}
              />
            </div>
          </form>

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label='Notifications'
                className='relative'
                size='icon'
                variant='ghost'
              >
                <Bell className='h-5 w-5' />
                {notificationCount > 0 && (
                  <Badge
                    className='absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs'
                    variant='destructive'
                  >
                    {notificationCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align='end'
              className='w-80'
            >
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className='max-h-96 overflow-y-auto'>
                {/* Notification items would go here */}
                <DropdownMenuItem className='cursor-pointer'>
                  <div className='flex flex-col gap-1'>
                    <p className='font-medium text-sm'>New appointment</p>
                    <p className='text-muted-foreground text-xs'>John Doe scheduled for tomorrow</p>
                  </div>
                </DropdownMenuItem>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem className='justify-center text-center text-primary text-sm'>
                View all notifications
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Theme Toggle */}
          <ModeToggle />

          {/* User Menu */}
          <UserMenu />

          {/* Mobile Menu Trigger */}
          <Sheet
            onOpenChange={setIsOpen}
            open={isOpen}
          >
            <SheetTrigger asChild>
              <Button
                aria-label='Open menu'
                className='lg:hidden'
                size='icon'
                variant='ghost'
              >
                <Menu className='h-5 w-5' />
              </Button>
            </SheetTrigger>
            <SheetContent
              className='w-full sm:max-w-sm'
              side='right'
            >
              <SheetHeader>
                <SheetTitle className='flex items-center gap-2'>
                  <Baby className='h-5 w-5 text-primary' />
                  <span>Menu</span>
                </SheetTitle>
              </SheetHeader>

              {/* Mobile Search */}
              <form
                className='mt-4'
                onSubmit={handleSearch}
              >
                <div className='relative'>
                  <Search className='absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground' />
                  <Input
                    className='w-full pl-8'
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder='Search...'
                    type='search'
                    value={searchQuery}
                  />
                </div>
              </form>

              <nav className='mt-6 flex flex-col gap-6'>
                {isPublicRoute ? (
                  // Public navigation
                  <div className='space-y-2'>
                    {publicLinks.map(({ to, label, icon: Icon }) => (
                      <Link
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2 font-medium text-sm transition-colors hover:bg-accent',
                          pathname === to ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
                        )}
                        href={to}
                        key={to}
                        onClick={() => setIsOpen(false)}
                      >
                        <Icon className='h-4 w-4' />
                        {label}
                      </Link>
                    ))}
                  </div>
                ) : (
                  // Dashboard navigation
                  dashboardNavCategories.map(category => (
                    <div
                      className='space-y-2'
                      key={category.title}
                    >
                      <h3 className='px-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider'>
                        {category.title}
                      </h3>
                      {category.links.map(({ to, label, icon: Icon }) => (
                        <Link
                          className={cn(
                            'flex items-center gap-3 rounded-lg px-3 py-2 font-medium text-sm transition-colors hover:bg-accent',
                            pathname?.startsWith(to) ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
                          )}
                          href={to}
                          key={to}
                          onClick={() => setIsOpen(false)}
                        >
                          <Icon className='h-4 w-4' />
                          {label}
                        </Link>
                      ))}
                    </div>
                  ))
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Mobile Search Bar (Collapsible) */}
      {isSearchOpen && (
        <div className='border-t p-4 lg:hidden'>
          <form onSubmit={handleSearch}>
            <div className='relative'>
              <Search className='absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground' />
              <Input
                autoFocus
                className='w-full pl-8'
                onChange={e => setSearchQuery(e.target.value)}
                placeholder='Search patients, appointments...'
                type='search'
                value={searchQuery}
              />
            </div>
          </form>
        </div>
      )}
    </header>
  );
}
