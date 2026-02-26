// components/home/testimonials.tsx
import { Star } from 'lucide-react';
import { useId } from 'react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';

const testimonials = [
  {
    name: 'Sarah Johnson',
    role: 'Mother of 2',
    content:
      'Dr. Smith and the entire staff are amazing. They truly care about my children and always take time to answer all my questions.',
    rating: 5,
    initials: 'SJ'
  },
  {
    name: 'Michael Chen',
    role: 'Father of 3',
    content:
      "The best pediatric care we've ever experienced. The online portal makes scheduling so easy, and wait times are minimal.",
    rating: 5,
    initials: 'MC'
  },
  {
    name: 'Emily Rodriguez',
    role: 'Mother of 1',
    content:
      'I love how they make my daughter feel comfortable during visits. The doctors are patient, kind, and incredibly knowledgeable.',
    rating: 5,
    initials: 'ER'
  }
];
export function Testimonials() {
  const componentId = useId();

  return (
    <div className='grid gap-6 md:grid-cols-3'>
      {testimonials.map(testimonial => (
        <Card key={testimonial.name}>
          <CardContent className='p-6'>
            <div className='mb-4 flex gap-1'>
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  className={`h-4 w-4 ${i < testimonial.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted'}`}
                  key={`${componentId}-star-${testimonial.name}-${i}`}
                />
              ))}
            </div>
            <p className='mb-4 text-sm'>{testimonial.content}</p>
            <div className='flex items-center gap-3'>
              <Avatar>
                <AvatarFallback className='bg-primary/10 text-primary'>{testimonial.initials}</AvatarFallback>
              </Avatar>
              <div>
                <p className='font-medium text-sm'>{testimonial.name}</p>
                <p className='text-muted-foreground text-xs'>{testimonial.role}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
