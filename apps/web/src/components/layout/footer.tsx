import { Baby, Heart } from 'lucide-react';
import Link from 'next/link';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className='border-t bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60'>
      <div className='container mx-auto px-4 py-8 md:px-6'>
        <div className='grid grid-cols-1 gap-8 md:grid-cols-4'>
          {/* Brand */}
          <div className='space-y-3'>
            <div className='flex items-center gap-2'>
              <Baby className='h-6 w-6 text-primary' />
              <span className='font-bold'>Pediatric Clinic</span>
            </div>
            <p className='text-muted-foreground text-sm'>
              Providing expert care for your child's health and development since 2020.
            </p>
          </div>

          {/* Quick Links */}
          <div className='space-y-3'>
            <h3 className='font-semibold'>Quick Links</h3>
            <ul className='space-y-2 text-muted-foreground text-sm'>
              <li>
                <Link
                  className='hover:text-primary'
                  href='/about'
                >
                  About Us
                </Link>
              </li>
              <li>
                <Link
                  className='hover:text-primary'
                  href='/services'
                >
                  Services
                </Link>
              </li>
              <li>
                <Link
                  className='hover:text-primary'
                  href='/contact'
                >
                  Contact
                </Link>
              </li>
              <li>
                <Link
                  className='hover:text-primary'
                  href='/privacy'
                >
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div className='space-y-3'>
            <h3 className='font-semibold'>Contact</h3>
            <ul className='space-y-2 text-muted-foreground text-sm'>
              <li>123 Healthcare Ave</li>
              <li>Medical District</li>
              <li>Phone: (555) 123-4567</li>
              <li>Email: info@pediatricclinic.com</li>
            </ul>
          </div>

          {/* Hours */}
          <div className='space-y-3'>
            <h3 className='font-semibold'>Hours</h3>
            <ul className='space-y-2 text-muted-foreground text-sm'>
              <li>Mon-Fri: 8:00 AM - 6:00 PM</li>
              <li>Saturday: 9:00 AM - 2:00 PM</li>
              <li>Sunday: Closed</li>
              <li>24/7 Emergency: (555) 123-9999</li>
            </ul>
          </div>
        </div>

        <div className='mt-8 border-t pt-4 text-center text-muted-foreground text-sm'>
          <p>
            © {currentYear} Pediatric Clinic. All rights reserved. Made with{' '}
            <Heart className='inline h-3 w-3 text-red-500' /> for children's health.
          </p>
        </div>
      </div>
    </footer>
  );
}
