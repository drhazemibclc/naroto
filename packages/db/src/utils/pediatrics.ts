import type { Service } from '@generated/browser';

// utils/pediatric-services.ts
export const PEDIATRIC_SERVICE_RECOMMENDATIONS = [
  {
    name: 'Child Vaccination Package',
    category: 'VACCINATION',
    price: 150.0,
    duration: 30,
    description: 'Complete child immunization schedule including MMR, DTaP, Polio, and Hepatitis B',
    isAvailable: true,
    icon: 'syringe',
    color: '#10b981'
  },
  {
    name: 'Growth & Development Check',
    category: 'CONSULTATION',
    price: 80.0,
    duration: 45,
    description: 'Comprehensive growth assessment using WHO standards and developmental screening',
    isAvailable: true,
    icon: 'activity',
    color: '#3b82f6'
  },
  {
    name: 'Pediatric Blood Test',
    category: 'LAB_TEST',
    price: 65.0,
    duration: 15,
    description: 'Complete blood count and pediatric-specific tests',
    isAvailable: true,
    icon: 'microscope',
    color: '#8b5cf6'
  },
  {
    name: 'Newborn Screening',
    category: 'LAB_TEST',
    price: 120.0,
    duration: 20,
    description: 'Essential screening tests for newborns',
    isAvailable: true,
    icon: 'baby',
    color: '#f59e0b'
  }
];

export const getPediatricServiceStats = (services: Service[]) => {
  const pediatricServices = services.filter(
    s => s.category && ['VACCINATION', 'CONSULTATION', 'LAB_TEST'].includes(s.category)
  );

  return {
    total: services.length,
    pediatric: pediatricServices.length,
    percentage: services.length > 0 ? (pediatricServices.length / services.length) * 100 : 0,
    byCategory: {
      VACCINATION: pediatricServices.filter(s => s.category === 'VACCINATION').length,
      CONSULTATION: pediatricServices.filter(s => s.category === 'CONSULTATION').length,
      LAB_TEST: pediatricServices.filter(s => s.category === 'LAB_TEST').length
    }
  };
};
