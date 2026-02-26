// app/page.tsx

import {
  ArrowRight,
  Award,
  Baby,
  Calendar,
  Clock,
  Heart,
  Mail,
  MapPin,
  Phone,
  Shield,
  Star,
  Users
} from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';

import { DevAsciiArt } from '@/components/home/dev-art';
import { FeaturesGrid } from '@/components/home/features-grid';
import { QuickActions } from '@/components/home/quick-actions';
import { ServicesShowcase } from '@/components/home/services-showcase';
import { StatsCards } from '@/components/home/stats-cards';
import { SystemHealthBanner } from '@/components/home/system-health';
import { Testimonials } from '@/components/home/testimonials';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default async function HomePage() {
  return (
    <div className='flex min-h-screen flex-col'>
      <DevAsciiArt />
      {/* Hero Section */}
      <section className='relative overflow-hidden bg-linear-to-b from-primary/5 to-background py-20 md:py-32'>
        <div className='absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent' />

        <div className='container mx-auto px-4'>
          <div className='grid items-center gap-12 lg:grid-cols-2'>
            <div className='space-y-6'>
              <div className='inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-primary'>
                <Heart className='h-4 w-4' />
                <span className='font-medium text-sm'>Compassionate Care for Little Ones</span>
              </div>

              <h1 className='font-bold text-4xl leading-tight tracking-tight md:text-5xl lg:text-6xl'>
                Your Child's Health Is Our{' '}
                <span className='bg-linear-to-r from-primary to-primary/60 bg-clip-text text-transparent'>
                  Top Priority
                </span>
              </h1>

              <p className='max-w-xl text-lg text-muted-foreground'>
                Welcome to Pediatric Clinic – where we provide expert, compassionate healthcare for children from birth
                through adolescence. Our team of specialists is here to support your family every step of the way.
              </p>

              <div className='flex flex-wrap gap-4'>
                <Button
                  asChild
                  className='gap-2'
                  size='lg'
                >
                  <Link href='/dashboard'>
                    Access Portal <ArrowRight className='h-4 w-4' />
                  </Link>
                </Button>
                <Button
                  asChild
                  size='lg'
                  variant='outline'
                >
                  <Link href='/services'>Our Services</Link>
                </Button>
              </div>

              {/* Trust Indicators */}
              <div className='flex flex-wrap items-center gap-6 pt-6'>
                <div className='flex items-center gap-2'>
                  <Shield className='h-5 w-5 text-primary' />
                  <span className='font-medium text-sm'>HIPAA Compliant</span>
                </div>
                <div className='flex items-center gap-2'>
                  <Award className='h-5 w-5 text-primary' />
                  <span className='font-medium text-sm'>Board Certified</span>
                </div>
                <div className='flex items-center gap-2'>
                  <Star className='h-5 w-5 fill-primary text-primary' />
                  <span className='font-medium text-sm'>4.9/5 Rating</span>
                </div>
              </div>
            </div>

            {/* Hero Image */}
            <div className='relative hidden lg:block'>
              <div className='relative aspect-square overflow-hidden rounded-2xl bg-linear-to-br from-primary/20 to-secondary/20'>
                <div className="absolute inset-0 bg-[url('/hero-pattern.svg')] opacity-10" />
                <div className='absolute inset-0 flex items-center justify-center'>
                  <Baby className='h-48 w-48 text-primary/40' />
                </div>
              </div>

              {/* Floating Stats Cards */}
              <div className='absolute top-1/2 -left-8 animate-float rounded-lg bg-background p-4 shadow-lg'>
                <div className='flex items-center gap-3'>
                  <div className='rounded-full bg-green-100 p-2 dark:bg-green-900'>
                    <Users className='h-4 w-4 text-green-600 dark:text-green-300' />
                  </div>
                  <div>
                    <p className='font-bold text-2xl'>5,000+</p>
                    <p className='text-muted-foreground text-xs'>Happy Families</p>
                  </div>
                </div>
              </div>

              <div className='absolute -right-8 -bottom-8 animate-float-delayed rounded-lg bg-background p-4 shadow-lg'>
                <div className='flex items-center gap-3'>
                  <div className='rounded-full bg-blue-100 p-2 dark:bg-blue-900'>
                    <Calendar className='h-4 w-4 text-blue-600 dark:text-blue-300' />
                  </div>
                  <div>
                    <p className='font-bold text-2xl'>24/7</p>
                    <p className='text-muted-foreground text-xs'>Appointments</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section - Server Component with Suspense */}
      <section className='border-y bg-muted/50 py-12'>
        <div className='container mx-auto px-4'>
          <Suspense fallback={<StatsCardsSkeleton />}>
            <StatsCards />
          </Suspense>
        </div>
      </section>

      {/* Features/Services Section */}
      <section className='py-20'>
        <div className='container mx-auto px-4'>
          <div className='mb-12 text-center'>
            <h2 className='mb-4 font-bold text-3xl'>Comprehensive Pediatric Care</h2>
            <p className='mx-auto max-w-2xl text-muted-foreground'>
              From routine checkups to specialized care, we offer a full range of pediatric services in a warm,
              child-friendly environment.
            </p>
          </div>

          <Suspense fallback={<ServicesGridSkeleton />}>
            <ServicesShowcase />
          </Suspense>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className='bg-primary/5 py-20'>
        <div className='container mx-auto px-4'>
          <div className='mb-12 text-center'>
            <h2 className='mb-4 font-bold text-3xl'>Why Families Trust Us</h2>
            <p className='mx-auto max-w-2xl text-muted-foreground'>
              We combine medical expertise with a compassionate approach to make every visit positive for both children
              and parents.
            </p>
          </div>

          <FeaturesGrid />
        </div>
      </section>

      {/* Testimonials */}
      <section className='py-20'>
        <div className='container mx-auto px-4'>
          <div className='mb-12 text-center'>
            <h2 className='mb-4 font-bold text-3xl'>What Families Say</h2>
            <p className='mx-auto max-w-2xl text-muted-foreground'>
              Don't just take our word for it – hear from the families we've had the privilege to care for.
            </p>
          </div>

          <Suspense fallback={<TestimonialsSkeleton />}>
            <Testimonials />
          </Suspense>
        </div>
      </section>

      {/* Quick Actions for Staff/Patients */}
      <section className='border-y bg-muted/30 py-12'>
        <div className='container mx-auto px-4'>
          <div className='mb-8 flex items-center justify-between'>
            <div>
              <h2 className='font-bold text-2xl'>Quick Access</h2>
              <p className='text-muted-foreground'>Common tasks and resources</p>
            </div>
            <Button
              asChild
              variant='ghost'
            >
              <Link
                className='gap-2'
                href='/dashboard'
              >
                View All <ArrowRight className='h-4 w-4' />
              </Link>
            </Button>
          </div>

          <QuickActions />
        </div>
      </section>

      {/* System Health Banner - For staff/authenticated users */}
      <Suspense fallback={null}>
        <SystemHealthBanner />
      </Suspense>

      {/* CTA Section */}
      <section className='bg-linear-to-r from-primary to-primary/80 py-16 text-primary-foreground'>
        <div className='container mx-auto px-4 text-center'>
          <h2 className='mb-4 font-bold text-3xl'>Ready to Get Started?</h2>
          <p className='mx-auto mb-8 max-w-2xl text-primary-foreground/90'>
            Join thousands of families who trust us with their children's health. Schedule your first appointment today.
          </p>
          <div className='flex flex-wrap justify-center gap-4'>
            <Button
              asChild
              size='lg'
              variant='secondary'
            >
              <Link href='/appointments/new'>Book Appointment</Link>
            </Button>
            <Button
              asChild
              className='border-primary-foreground/20 bg-transparent text-primary-foreground hover:bg-primary-foreground/10'
              size='lg'
              variant='outline'
            >
              <Link href='/contact'>Contact Us</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Contact Info Bar */}
      <div className='border-t bg-background py-4'>
        <div className='container mx-auto flex flex-wrap items-center justify-between gap-4 px-4 text-sm'>
          <div className='flex items-center gap-2'>
            <Phone className='h-4 w-4 text-muted-foreground' />
            <span>Emergency: (555) 123-4567</span>
          </div>
          <div className='flex items-center gap-2'>
            <Mail className='h-4 w-4 text-muted-foreground' />
            <span>info@pediatricclinic.com</span>
          </div>
          <div className='flex items-center gap-2'>
            <MapPin className='h-4 w-4 text-muted-foreground' />
            <span>123 Healthcare Ave, Medical District</span>
          </div>
          <div className='flex items-center gap-2'>
            <Clock className='h-4 w-4 text-muted-foreground' />
            <span>Mon-Fri: 8am-6pm | Sat: 9am-2pm</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Skeletons for Suspense boundaries
function StatsCardsSkeleton() {
  return (
    <div className='grid gap-4 md:grid-cols-4'>
      {[1, 2, 3, 4].map(i => (
        <Card key={i}>
          <CardHeader className='pb-2'>
            <div className='h-4 w-24 animate-pulse rounded bg-muted' />
          </CardHeader>
          <CardContent>
            <div className='h-8 w-16 animate-pulse rounded bg-muted' />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ServicesGridSkeleton() {
  return (
    <div className='grid gap-6 md:grid-cols-2 lg:grid-cols-3'>
      {[1, 2, 3, 4, 5, 6].map(i => (
        <Card
          className='h-48 animate-pulse'
          key={i}
        >
          <CardContent className='p-6'>
            <div className='mb-4 h-12 w-12 rounded-full bg-muted' />
            <div className='h-4 w-3/4 rounded bg-muted' />
            <div className='mt-2 h-3 w-full rounded bg-muted' />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TestimonialsSkeleton() {
  return (
    <div className='grid gap-6 md:grid-cols-3'>
      {[1, 2, 3].map(i => (
        <Card
          className='h-48 animate-pulse'
          key={i}
        >
          <CardContent className='p-6'>
            <div className='mb-4 flex gap-1'>
              {[1, 2, 3, 4, 5].map(j => (
                <div
                  className='h-4 w-4 rounded-full bg-muted'
                  key={j}
                />
              ))}
            </div>
            <div className='space-y-2'>
              <div className='h-3 w-full rounded bg-muted' />
              <div className='h-3 w-5/6 rounded bg-muted' />
              <div className='h-3 w-4/6 rounded bg-muted' />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
