// components/home/services-showcase.tsx
import { Activity, Baby, Heart, Pill, Stethoscope, Syringe } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const services = [
  {
    title: 'Well-Child Visits',
    description: 'Regular checkups to monitor growth, development, and overall health.',
    icon: Baby,
    href: '/services/well-child',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100 dark:bg-blue-900/20'
  },
  {
    title: 'Immunizations',
    description: 'Stay up-to-date with recommended vaccines following CDC guidelines.',
    icon: Syringe,
    href: '/services/immunizations',
    color: 'text-green-600',
    bgColor: 'bg-green-100 dark:bg-green-900/20'
  },
  {
    title: 'Sick Visits',
    description: 'Prompt care for common childhood illnesses like colds, flu, and infections.',
    icon: Stethoscope,
    href: '/services/sick-visits',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100 dark:bg-purple-900/20'
  },
  {
    title: 'Developmental Screenings',
    description: 'Early detection of developmental delays and behavioral concerns.',
    icon: Activity,
    href: '/services/developmental',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100 dark:bg-orange-900/20'
  },
  {
    title: 'Chronic Condition Management',
    description: 'Ongoing care for asthma, allergies, diabetes, and other conditions.',
    icon: Heart,
    href: '/services/chronic-care',
    color: 'text-red-600',
    bgColor: 'bg-red-100 dark:bg-red-900/20'
  },
  {
    title: 'Prescriptions',
    description: 'Safe and effective medication management for your child.',
    icon: Pill,
    href: '/services/prescriptions',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-100 dark:bg-indigo-900/20'
  }
];

export async function ServicesShowcase() {
  return (
    <div className='grid gap-6 md:grid-cols-2 lg:grid-cols-3'>
      {services.map(service => {
        const Icon = service.icon;
        return (
          <Card
            className='group transition-shadow hover:shadow-lg'
            key={service.title}
          >
            <CardHeader>
              <div className={`mb-4 w-fit rounded-lg p-3 ${service.bgColor}`}>
                <Icon className={`h-6 w-6 ${service.color}`} />
              </div>
              <CardTitle className='text-xl'>{service.title}</CardTitle>
              <CardDescription>{service.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                asChild
                className='px-0'
                variant='link'
              >
                <Link href={service.href}>Learn more →</Link>
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
