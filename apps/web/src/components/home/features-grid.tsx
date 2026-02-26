// components/home/features-grid.tsx
import { Award, Baby, Calendar, Clock, Shield, Users } from 'lucide-react';

const features = [
  {
    title: 'Child-Friendly Environment',
    description: 'Our clinic is designed to make children feel comfortable and at ease.',
    icon: Baby
  },
  {
    title: 'Minimal Wait Times',
    description: 'We respect your time with efficient scheduling and minimal waiting.',
    icon: Clock
  },
  {
    title: 'Secure Patient Portal',
    description: 'Access records, schedule appointments, and message providers online.',
    icon: Shield
  },
  {
    title: 'Experienced Team',
    description: 'Board-certified pediatricians with years of experience.',
    icon: Users
  },
  {
    title: 'Flexible Scheduling',
    description: 'Early morning and evening appointments available.',
    icon: Calendar
  },
  {
    title: 'Award-Winning Care',
    description: 'Recognized for excellence in pediatric healthcare.',
    icon: Award
  }
];

export function FeaturesGrid() {
  return (
    <div className='grid gap-6 md:grid-cols-3'>
      {features.map(feature => {
        const Icon = feature.icon;
        return (
          <div
            className='flex gap-4'
            key={feature.title}
          >
            <div className='shrink-0'>
              <div className='rounded-lg bg-primary/10 p-3'>
                <Icon className='h-5 w-5 text-primary' />
              </div>
            </div>
            <div>
              <h3 className='font-semibold'>{feature.title}</h3>
              <p className='text-muted-foreground text-sm'>{feature.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
