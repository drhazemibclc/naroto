/** biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: <seed> */

import { faker } from '@faker-js/faker';
import {
  type Appointment,
  AppointmentStatus,
  ChartType,
  type Clinic,
  DevelopmentStatus,
  type Diagnosis,
  type Doctor,
  DosageUnit,
  DrugRoute,
  FeedingType,
  Gender,
  type Immunization,
  JOBTYPE,
  type MedicalRecords,
  NotificationType,
  type Patient,
  type Payment,
  PaymentMethod,
  PaymentStatus,
  type Prisma,
  ReminderMethod,
  ReminderStatus,
  type Service,
  ServiceCategory,
  type Staff,
  Status,
  type User,
  type UserRole
} from '@generated/browser';

import type { PrismaSeedClient } from '../seed';

// Configuration
const CONFIG = {
  totalUsers: 10,
  totalClinics: 8,
  totalDoctors: 20,
  totalPatients: 10,
  totalStaff: 15,
  totalAppointments: 20,
  totalMedicalRecords: 10,
  totalPrescriptions: 5,
  totalServices: 25,
  totalPayments: 20,
  totalNotifications: 10,
  totalImmunizations: 8,
  totalDrugs: 3,
  totalExpenses: 5,
  totalExpenseCategories: 8,
  totalExpenseSubcategories: 20,
  totalRatings: 8,
  totalVitalSigns: 20,
  totalFeedingLogs: 6,
  totalDevelopmentalChecks: 4,
  totalDevelopmentalMilestones: 12,
  totalUserSavedFilters: 3
};

// Helper functions
const getRandomEnumValue = <T>(enumObj: Record<string, T>): T => {
  const enumValues = Object.values(enumObj) as T[];
  if (enumValues.length === 0) {
    throw new Error('Enum object has no values');
  }
  const index = Math.floor(Math.random() * enumValues.length);
  const value = enumValues[index];
  if (value === undefined) {
    throw new Error('Failed to pick a random enum value');
  }
  return value;
};

const getRandomSubset = <T>(array: T[], count: number): T[] => {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, shuffled.length));
};

const weightedRandom = <T>(items: Array<{ item: T; weight: number }>): T => {
  const total = items.reduce((sum, { weight }) => sum + weight, 0);
  let random = Math.random() * total;

  if (items.length === 0) {
    throw new Error('weightedRandom called with empty items');
  }

  for (const { item, weight } of items) {
    if (random < weight) return item;
    random -= weight;
  }

  const fallbackItem = items[0];
  if (fallbackItem === undefined) {
    throw new Error('weightedRandom: items[0] is undefined');
  }
  return fallbackItem.item;
};

// Time helper functions
const randomTime = (): string => {
  const hours = faker.number.int({ min: 8, max: 17 }).toString().padStart(2, '0');
  const minutes = faker.helpers.arrayElement(['00', '15', '30', '45']);
  return `${hours}:${minutes}`;
};

// Safe date-between helper

// Generate realistic date of birth based on patient type
const generateDateOfBirth = (patientType: 'adult' | 'child' | 'infant'): Date => {
  switch (patientType) {
    case 'infant':
      return faker.date.birthdate({ min: 0, max: 2, mode: 'age' });
    case 'child':
      return faker.date.birthdate({ min: 2, max: 18, mode: 'age' });
    default: // adult
      return faker.date.birthdate({ min: 18, max: 90, mode: 'age' });
  }
};

// Helper function to safely delete data
const safeDeleteMany = async <T>(deleteFn: () => Promise<T>): Promise<void> => {
  try {
    await deleteFn();
  } catch (err: unknown) {
    const errCode = err instanceof Error && 'code' in err ? String(err.code) : 'unknown';
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errCode === 'P2021' || errMsg.includes('does not exist')) {
      return;
    }
    throw err;
  }
};

// Function to clear all data in proper order (respecting foreign key constraints)
const clearAllData = async (prisma: PrismaSeedClient) => {
  console.log('🗑️ Clearing existing data in proper order...');

  // Clear data in reverse order of dependencies
  const clearOperations = [
    // Start with models that have many relations and could cause conflicts
    () => prisma.auditLog.deleteMany({}), // Has nullable relation to User
    () => prisma.clinicMember.deleteMany({}), // Bridge table, user/clinic
    () => prisma.doseGuideline.deleteMany({}),
    () => prisma.expense.deleteMany({}),
    () => prisma.feedingLog.deleteMany({}),
    () => prisma.file.deleteMany({}), // Depends on User, Folder
    () => prisma.folder.deleteMany({}), // Depends on User
    () => prisma.guardian.deleteMany({}), // Depends on Patient, User
    () => prisma.immunization.deleteMany({}),
    () => prisma.labTest.deleteMany({}),
    () => prisma.medicalRecordAccess.deleteMany({}), // Depends on MedicalRecords, User
    () => prisma.notification.deleteMany({}),
    () => prisma.patientBill.deleteMany({}),
    () => prisma.payment.deleteMany({}),
    () => prisma.prescribedItem.deleteMany({}),
    () => prisma.prescription.deleteMany({}),
    () => prisma.rating.deleteMany({}),
    () => prisma.reminder.deleteMany({}),
    () => prisma.session.deleteMany({}),
    () => prisma.account.deleteMany({}),
    () => prisma.twoFactor.deleteMany({}),
    () => prisma.userQuota.deleteMany({}), // Depends on User
    () => prisma.vitalSigns.deleteMany({}),
    () => prisma.workingDays.deleteMany({}),
    () => prisma.diagnosis.deleteMany({}),
    () => prisma.growthRecord.deleteMany({}),
    () => prisma.developmentalMilestone.deleteMany({}),
    () => prisma.developmentalCheck.deleteMany({}),
    () => prisma.medicalRecords.deleteMany({}),
    () => prisma.appointment.deleteMany({}),
    () => prisma.patient.deleteMany({}), // Depends on User, Clinic
    () => prisma.staff.deleteMany({}), // Depends on User, Clinic
    () => prisma.doctor.deleteMany({}), // Depends on User, Clinic

    // Now tables that are depended upon
    () => prisma.user.deleteMany({}),
    () => prisma.service.deleteMany({}),
    () => prisma.drug.deleteMany({}),
    () => prisma.expenseSubCategory.deleteMany({}),
    () => prisma.expenseCategory.deleteMany({}),
    () => prisma.clinicSetting.deleteMany({}),
    () => prisma.systemSettings.deleteMany({}),
    () => prisma.feature.deleteMany({}),
    () => prisma.clinic.deleteMany({}),

    // Standalone or rarely connected
    () => prisma.verification.deleteMany({}),
    () => prisma.todo.deleteMany({}),
    () => prisma.settings.deleteMany({}),
    () => prisma.wHOGrowthStandard.deleteMany({}),
    () => prisma.vaccineSchedule.deleteMany({}),
    () => prisma.configStore.deleteMany({})
  ];

  for (const operation of clearOperations) {
    await safeDeleteMany(operation);
  }
};

// Create realistic clinics
async function createClinics(prisma: PrismaSeedClient) {
  console.log('🏥 Creating clinics...');
  const clinics = [];
  const clinicNames = [
    'City Medical Center',
    'Community Health Clinic',
    'Family Care Hospital',
    'Pediatric Specialists',
    'General Healthcare Clinic',
    'Metropolitan Hospital',
    'Sunrise Medical Center',
    "Children's Health Center"
  ];

  for (const name of clinicNames) {
    const clinic = await prisma.clinic.create({
      data: {
        id: faker.string.uuid(),
        name,
        email: faker.internet.email({
          firstName: (name.split(' ')[0] ?? 'clinic').toLowerCase()
        }),
        timezone: faker.helpers.arrayElement(['UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo']),
        address: faker.location.streetAddress(),
        phone: faker.phone.number(),
        deletedAt: null,
        isDeleted: false
      }
    });
    clinics.push(clinic);

    // Create clinic settings
    await prisma.clinicSetting.create({
      data: {
        id: faker.string.uuid(),
        clinicId: clinic.id,
        openingTime: '08:00',
        closingTime: '17:00',
        workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
        defaultAppointmentDuration: faker.helpers.arrayElement([15, 30, 45, 60]),
        requireEmergencyContact: faker.datatype.boolean()
      }
    });
  }

  return clinics;
}

// Create realistic users with different roles
async function createUsers(prisma: PrismaSeedClient) {
  console.log('👥 Creating users...');
  const users = [];

  // Create admin users
  for (let i = 0; i < 5; i++) {
    const user = await prisma.user.create({
      data: {
        id: faker.string.uuid(),
        name: faker.person.fullName(),
        email: `admin${i + 1}@mediclinic.com`,
        emailVerified: true,
        image: faker.image.avatar(),
        role: 'ADMIN',
        banned: false,
        isAdmin: true,
        twoFactorEnabled: i === 0,
        createdAt: faker.date.past({ years: 2 })
      }
    });
    users.push(user);
  }

  // Create doctors (as users)
  for (let i = 0; i < CONFIG.totalDoctors; i++) {
    const user = await prisma.user.create({
      data: {
        id: faker.string.uuid(),
        name: `Dr. ${faker.person.fullName()}`,
        email: faker.internet.email({
          firstName: faker.person.firstName(),
          lastName: faker.person.lastName()
        }),
        emailVerified: faker.datatype.boolean(0.8),
        image: faker.image.avatar(),
        role: 'DOCTOR',
        banned: false,
        isAdmin: false,
        createdAt: faker.date.past({ years: 2 })
      }
    });
    users.push(user);
  }

  // Create staff users
  for (let i = 0; i < CONFIG.totalStaff; i++) {
    const user = await prisma.user.create({
      data: {
        id: faker.string.uuid(),
        name: faker.person.fullName(),
        email: faker.internet.email(),
        emailVerified: faker.datatype.boolean(0.9),
        image: faker.image.avatar(),
        role: 'STAFF',
        banned: false,
        isAdmin: false,
        createdAt: faker.date.past({ years: 1 })
      }
    });
    users.push(user);
  }

  // Create patient users
  for (let i = 0; i < CONFIG.totalPatients; i++) {
    const user = await prisma.user.create({
      data: {
        id: faker.string.uuid(),
        name: faker.person.fullName(),
        email: faker.internet.email(),
        emailVerified: faker.datatype.boolean(0.7),
        image: faker.image.avatar(),
        role: 'PATIENT',
        banned: false,
        banReason: null,
        banExpires: null,
        isAdmin: false,
        createdAt: faker.date.past({ years: 1 })
      }
    });
    users.push(user);
  }

  return users;
}

// Associate users with clinics
async function associateUsersWithClinics(prisma: PrismaSeedClient, users: User[], clinics: Clinic[]) {
  console.log('🔗 Associating users with clinics...');

  for (const user of users) {
    const userClinics = getRandomSubset(clinics, faker.number.int({ min: 1, max: 3 }));
    for (const clinic of userClinics) {
      await prisma.clinicMember.create({
        data: {
          userId: user.id,
          clinicId: clinic.id,
          role: user.role?.toUpperCase() as UserRole,
          createdAt: faker.date.past({ years: 1 })
        }
      });
    }
  }
}

// Create doctors with realistic data
async function createDoctors(prisma: PrismaSeedClient, users: User[], clinics: Clinic[]) {
  console.log('👨‍⚕️ Creating doctors...');
  const doctors = [];
  const doctorUsers = users.filter(user => user.role === 'DOCTOR');

  const specialties = [
    'Pediatrics',
    'Cardiology',
    'Dermatology',
    'Neurology',
    'Orthopedics',
    'Gynecology',
    'Psychiatry',
    'General Medicine',
    'Surgery',
    'Oncology',
    'Endocrinology',
    'Gastroenterology',
    'Pulmonology',
    'Rheumatology',
    'Urology'
  ];

  for (let i = 0; i < Math.min(CONFIG.totalDoctors, doctorUsers.length); i++) {
    const user = doctorUsers[i];
    if (!user) continue;

    const clinic = faker.helpers.arrayElement(clinics);
    const specialty = faker.helpers.arrayElement(specialties);

    const doctor = await prisma.doctor.create({
      data: {
        id: faker.string.uuid(),
        email: user.email ?? '',
        name: user.name,
        userId: user.id,
        clinicId: clinic.id,
        specialty,
        licenseNumber: faker.string.alphanumeric(10).toUpperCase(),
        phone: faker.phone.number(),
        address: faker.location.streetAddress(),
        department: faker.helpers.arrayElement(['Emergency', 'Outpatient', 'Surgery', 'ICU', 'Pediatrics']),
        img: faker.image.avatar(),
        colorCode: faker.color.rgb(),
        availabilityStatus: weightedRandom([
          { item: 'AVAILABLE', weight: 0.6 },
          { item: 'UNAVAILABLE', weight: 0.2 }
        ]),
        availableFromWeekDay: faker.number.int({ min: 1, max: 5 }),
        availableToWeekDay: faker.number.int({ min: 1, max: 5 }),
        availableFromTime: '08:00',
        availableToTime: '18:00',
        type: getRandomEnumValue(JOBTYPE),
        appointmentPrice: faker.number.float({
          min: 80,
          max: 300,
          fractionDigits: 2
        }),
        status: weightedRandom([
          { item: Status.ACTIVE, weight: 0.85 },
          { item: Status.INACTIVE, weight: 0.1 },
          { item: Status.DORMANT, weight: 0.05 }
        ]),
        isActive: faker.datatype.boolean(0.9),
        role: 'DOCTOR'
      }
    });
    doctors.push(doctor);

    // Create working days
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const workingDays = getRandomSubset(days, faker.number.int({ min: 4, max: 6 }));

    for (const day of workingDays) {
      await prisma.workingDays.create({
        data: {
          doctorId: doctor.id,
          day,
          clinicId: clinic.id,
          startTime: faker.helpers.arrayElement(['08:00', '09:00', '10:00']),
          endTime: faker.helpers.arrayElement(['16:00', '17:00', '18:00'])
        }
      });
    }
  }

  return doctors;
}

// Create staff members
async function createStaff(prisma: PrismaSeedClient, users: User[], clinics: Clinic[]) {
  console.log('👨‍💼 Creating staff...');
  const staff = [];
  const staffUsers = users.filter(user => user.role === 'STAFF');

  for (let i = 0; i < Math.min(CONFIG.totalStaff, staffUsers.length); i++) {
    const user = staffUsers[i];
    if (!user) continue;

    const clinic = faker.helpers.arrayElement(clinics);

    const staffMember = await prisma.staff.create({
      data: {
        id: faker.string.uuid(),
        email: user.email ?? '',
        name: user.name,
        phone: faker.phone.number(),
        userId: user.id,
        clinicId: clinic.id,
        address: faker.location.streetAddress(),
        department: faker.helpers.arrayElement(['Administration', 'Nursing', 'Laboratory', 'Pharmacy', 'Reception']),
        createdAt: faker.date.past({ years: 5 }),
        updatedAt: faker.date.past({ years: 5 }),
        img: faker.image.avatar(),
        licenseNumber: faker.string.alphanumeric(8).toUpperCase(),
        colorCode: faker.color.rgb(),
        hireDate: faker.date.past({ years: 5 }),
        salary: faker.number.float({
          min: 30_000,
          max: 80_000,
          fractionDigits: 2
        }),
        role: 'STAFF',
        status: weightedRandom([
          { item: Status.ACTIVE, weight: 0.9 },
          { item: Status.INACTIVE, weight: 0.1 }
        ]),
        isActive: faker.datatype.boolean(0.95)
      }
    });
    staff.push(staffMember);
  }

  return staff;
}

// Create patients with realistic data
async function createPatients(prisma: PrismaSeedClient, users: User[], clinics: Clinic[]) {
  console.log('👤 Creating patients...');
  const patients = [];
  const patientUsers = users.filter(user => user.role === 'PATIENT');

  for (let i = 0; i < Math.min(CONFIG.totalPatients, patientUsers.length); i++) {
    const user = patientUsers[i];
    if (!user) continue;

    const clinic = faker.helpers.arrayElement(clinics);

    const dateOfBirth = generateDateOfBirth('child');

    const patient = await prisma.patient.create({
      data: {
        id: faker.string.uuid(),
        clinicId: clinic.id,
        firstName: user.name.split(' ')[0] ?? '',
        lastName: user.name.split(' ').slice(1).join(' '),
        email: user.email ?? '',
        phone: faker.phone.number(),
        emergencyContactNumber: faker.phone.number(),
        emergencyContactName: faker.person.fullName(),
        relation: faker.helpers.arrayElement(['Spouse', 'Parent', 'Sibling', 'Friend']),
        userId: user.id,
        dateOfBirth,
        gender: getRandomEnumValue(Gender),
        bloodGroup: faker.helpers.arrayElement(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-', null]),
        address: faker.location.streetAddress(),
        allergies: faker.datatype.boolean(0.3) ? faker.lorem.words(faker.number.int({ min: 1, max: 3 })) : null,
        medicalConditions: faker.datatype.boolean(0.4) ? faker.lorem.words(faker.number.int({ min: 1, max: 5 })) : null,
        medicalHistory: faker.datatype.boolean(0.2) ? faker.lorem.paragraph() : null,
        image: faker.image.avatar(),
        colorCode: faker.color.rgb(),
        role: 'PATIENT',
        status: weightedRandom([
          { item: Status.ACTIVE, weight: 0.85 },
          { item: Status.INACTIVE, weight: 0.1 },
          { item: Status.DORMANT, weight: 0.05 }
        ]),
        isActive: faker.datatype.boolean(0.9),
        deletedAt: faker.datatype.boolean(0.05) ? faker.date.past() : null,
        isDeleted: faker.datatype.boolean(0.05),
        createdById: users.find(u => u.role === 'ADMIN')?.id || users[0]?.id || '',
        createdAt: faker.date.past({ years: 1 })
      }
    });
    patients.push(patient);
  }

  return patients;
}

// Create services
async function createServices(prisma: PrismaSeedClient, clinics: Clinic[]) {
  console.log('🩺 Creating services...');
  const services = [];

  const serviceData = [
    {
      name: 'General Consultation',
      category: ServiceCategory.CONSULTATION,
      price: 50.0,
      duration: 30
    },
    {
      name: 'Specialist Consultation',
      category: ServiceCategory.CONSULTATION,
      price: 80.0,
      duration: 45
    },
    {
      name: 'Emergency Visit',
      category: ServiceCategory.CONSULTATION,
      price: 120.0,
      duration: 60
    },
    {
      name: 'Blood Test',
      category: ServiceCategory.LAB_TEST,
      price: 15.0,
      duration: 15
    },
    {
      name: 'Urine Test',
      category: ServiceCategory.LAB_TEST,
      price: 10.0,
      duration: 10
    },
    {
      name: 'X-Ray',
      category: ServiceCategory.LAB_TEST,
      price: 35.0,
      duration: 30
    },
    {
      name: 'MRI Scan',
      category: ServiceCategory.LAB_TEST,
      price: 200.0,
      duration: 60
    },
    {
      name: 'Flu Vaccine',
      category: ServiceCategory.VACCINATION,
      price: 20.0,
      duration: 20
    },
    {
      name: 'COVID-19 Vaccine',
      category: ServiceCategory.VACCINATION,
      price: 0.0,
      duration: 30
    },
    {
      name: 'Childhood Immunization',
      category: ServiceCategory.VACCINATION,
      price: 15.0,
      duration: 25
    },
    {
      name: 'Minor Surgery',
      category: ServiceCategory.PROCEDURE,
      price: 150.0,
      duration: 60
    },
    {
      name: 'Suture Removal',
      category: ServiceCategory.PROCEDURE,
      price: 25.0,
      duration: 15
    },
    {
      name: 'Physical Therapy',
      category: ServiceCategory.OTHER,
      price: 45.0,
      duration: 45
    },
    {
      name: 'Counseling Session',
      category: ServiceCategory.OTHER,
      price: 60.0,
      duration: 50
    },
    {
      name: 'Medication Review',
      category: ServiceCategory.PHARMACY,
      price: 30.0,
      duration: 20
    },
    {
      name: 'Diagnostic Imaging',
      category: ServiceCategory.DIAGNOSIS,
      price: 90.0,
      duration: 40
    },
    {
      name: 'Ultrasound',
      category: ServiceCategory.DIAGNOSIS,
      price: 75.0,
      duration: 30
    }
  ];

  for (const s of serviceData) {
    const clinic = faker.helpers.arrayElement(clinics);
    const created = await prisma.service.create({
      data: {
        id: faker.string.uuid(),
        serviceName: s.name,
        description: faker.lorem.sentence(),
        price: s.price,
        category: s.category,
        duration: s.duration,
        isAvailable: faker.datatype.boolean(0.9),
        clinicId: clinic.id,
        icon: faker.helpers.arrayElement(['🩺', '💉', '🩸', '🧪', '📋', '🩹', '💊']),
        color: faker.color.rgb(),
        createdAt: faker.date.past({ years: 1 })
      }
    });
    services.push(created);
  }

  return services;
}

// Create appointments
async function createAppointments(
  prisma: PrismaSeedClient,
  patients: Patient[],
  doctors: Doctor[],
  services: Service[]
) {
  console.log('📅 Creating appointments...');
  const appointments = [];

  for (let i = 0; i < CONFIG.totalAppointments; i++) {
    const patient = faker.helpers.arrayElement(patients);
    const doctor = faker.helpers.arrayElement(doctors);
    const service = faker.helpers.arrayElement(services);
    const clinic = doctor.clinicId
      ? { id: doctor.clinicId }
      : {
          id: faker.helpers.arrayElement([...new Set(patients.map(p => p.clinicId))])
        };

    const status = weightedRandom([
      { item: AppointmentStatus.SCHEDULED, weight: 0.4 },
      { item: AppointmentStatus.COMPLETED, weight: 0.4 },
      { item: AppointmentStatus.CANCELLED, weight: 0.15 },
      { item: AppointmentStatus.PENDING, weight: 0.05 }
    ]);

    let appointmentDate: Date;
    if (status === AppointmentStatus.COMPLETED) {
      appointmentDate = faker.date.past({ years: 1 });
    } else if (status === AppointmentStatus.SCHEDULED) {
      appointmentDate = faker.date.future({ years: 0.5 });
    } else {
      appointmentDate = faker.date.between({
        from: faker.date.past({ years: 1 }),
        to: faker.date.future({ years: 0.5 })
      });
    }

    const appointment = await prisma.appointment.create({
      data: {
        id: faker.string.uuid(),
        patientId: patient.id,
        doctorId: doctor.id,
        serviceId: service.id,
        doctorSpecialty: doctor.specialty,
        appointmentDate,
        appointmentPrice: doctor.appointmentPrice,
        clinicId: clinic.id,
        time: randomTime(),
        status,
        type: weightedRandom([
          { item: 'CONSULTATION', weight: 0.5 },
          { item: 'VACCINATION', weight: 0.5 },
          { item: 'PROCEDURE', weight: 0.5 },
          { item: 'EMERGENCY', weight: 0.3 },
          { item: 'CHECKUP', weight: 0.3 },
          { item: 'FOLLOW_UP', weight: 0.1 },
          { item: 'FEEDING_SESSION', weight: 0.1 }
        ]),
        note: faker.datatype.boolean(0.7) ? faker.lorem.sentence() : null,
        reason: faker.datatype.boolean(0.8) ? faker.lorem.sentence() : null,
        createdAt: faker.date.past({ years: 1 }),
        deletedAt: null,
        isDeleted: null
      }
    });
    appointments.push(appointment);

    // Create reminders for upcoming appointments
    if (status === AppointmentStatus.SCHEDULED && appointmentDate > new Date()) {
      await createReminder(prisma, appointment);
    }
  }

  return appointments;
}

// Create reminder for appointment
const createReminder = async (prisma: PrismaSeedClient, appointment: Appointment) => {
  if (faker.datatype.boolean(0.6)) {
    await prisma.reminder.create({
      data: {
        id: faker.string.uuid(),
        appointmentId: appointment.id,
        method: getRandomEnumValue(ReminderMethod),
        sentAt: faker.date.recent(),
        status: weightedRandom([
          { item: ReminderStatus.SENT, weight: 0.8 },
          { item: ReminderStatus.FAILED, weight: 0.1 },
          { item: ReminderStatus.PENDING, weight: 0.1 }
        ])
      }
    });
  }
};

// Create medical records and related data

async function createMedicalRecords(
  prisma: PrismaSeedClient,
  patients: Patient[],
  appointments: Appointment[],
  services: Service[]
) {
  console.log('📋 Creating medical records & related data...');
  const medicalRecords = [];

  // Use only completed appointments for medical records
  const completedAppointments = appointments.filter(a => a.status === AppointmentStatus.COMPLETED);

  for (const appointment of getRandomSubset(completedAppointments, CONFIG.totalMedicalRecords)) {
    const patient = patients.find(p => p.id === appointment.patientId);
    if (!patient) continue;

    const medicalRecord = await prisma.medicalRecords.create({
      data: {
        id: faker.string.uuid(),
        patientId: appointment.patientId ?? '',
        appointmentId: appointment.id,
        doctorId: appointment.doctorId,
        treatmentPlan: faker.datatype.boolean(0.8) ? faker.lorem.paragraph() : null,
        labRequest: faker.datatype.boolean(0.5) ? faker.lorem.sentence() : null,
        clinicId: appointment.clinicId ?? '',
        diagnosis: faker.datatype.boolean(0.7) ? faker.lorem.words(faker.number.int({ min: 1, max: 3 })) : null,
        symptoms: faker.datatype.boolean(0.8) ? faker.lorem.words(faker.number.int({ min: 1, max: 5 })) : null,
        notes: faker.datatype.boolean(0.6) ? faker.lorem.paragraph() : null,
        attachments: faker.datatype.boolean(0.3) ? faker.system.filePath() : null,
        followUpDate: faker.datatype.boolean(0.4) ? faker.date.future({ years: 0.5 }) : null,
        createdAt: appointment.appointmentDate,
        deletedAt: null,
        isDeleted: null
      }
    });
    medicalRecords.push(medicalRecord);

    try {
      // Create encounter
      const encounter = await createDiagnosis(prisma, medicalRecord, appointment);
      // Create vital signs
      if (faker.datatype.boolean(0.8)) {
        await createVitalSigns(prisma, patient, medicalRecord, encounter);
      }

      if (faker.datatype.boolean(0.4)) {
        await createLabTest(prisma, medicalRecord, services);
      }
    } catch (error) {
      console.error('Failed to create related data for medical record:', medicalRecord.id, error);
      throw error;
    }
  }

  return medicalRecords;
}

// Create encounter
const createDiagnosis = async (prisma: PrismaSeedClient, medicalRecord: MedicalRecords, appointment: Appointment) => {
  return await prisma.diagnosis.create({
    data: {
      id: faker.string.uuid(),
      clinicId: medicalRecord.clinicId,
      appointmentId: medicalRecord.appointmentId,
      patientId: medicalRecord.patientId,
      doctorId: medicalRecord.doctorId || appointment.doctorId,
      date: appointment.appointmentDate,
      type: weightedRandom([
        { item: 'Initial', weight: 0.4 },
        { item: 'Follow-up', weight: 0.4 },
        { item: 'Emergency', weight: 0.1 },
        { item: 'Consultation', weight: 0.1 }
      ]),
      diagnosis: medicalRecord.diagnosis,
      treatment: medicalRecord.treatmentPlan,
      notes: medicalRecord.notes,
      medicalId: medicalRecord.id,
      symptoms: medicalRecord.symptoms ?? '',
      prescribedMedications: faker.datatype.boolean(0.5) ? faker.lorem.words(3) : null,
      followUpPlan: faker.datatype.boolean(0.6) ? faker.lorem.sentence() : null,
      createdAt: appointment.appointmentDate,
      deletedAt: null,
      isDeleted: null
    }
  });
};

// Create vital signs
const createVitalSigns = async (
  prisma: PrismaSeedClient,
  patient: Patient,
  medicalRecord: MedicalRecords,
  encounter: Diagnosis
) => {
  const ageDays = Math.floor((Date.now() - patient.dateOfBirth.getTime()) / (1000 * 60 * 60 * 24));
  const ageMonths = Math.floor(ageDays / 30);

  const vitalSignsData: Prisma.VitalSignsCreateInput = {
    id: faker.string.uuid(),
    encounter: { connect: { id: encounter.id } },
    patient: { connect: { id: patient.id } },
    medical: { connect: { id: medicalRecord.id } },

    recordedAt: encounter.date ?? medicalRecord.createdAt,

    gender: patient.gender,
    ageDays,
    ageMonths,

    notes: null,

    bodyTemperature: null,
    systolic: null,
    diastolic: null,
    heartRate: null,
    respiratoryRate: null,
    oxygenSaturation: null
  };
  const growthRecordData: Prisma.GrowthRecordCreateInput = {
    id: faker.string.uuid(),
    patient: { connect: { id: patient.id } },
    recordedAt: encounter.date ?? medicalRecord.createdAt,
    height: null,
    weight: null,
    bmi: null,
    date: encounter.date ?? medicalRecord.createdAt,
    headCircumference: null,
    notes: null
  };

  // Add vitals based on patient age
  if (ageMonths < 24) {
    // Infant/child
    vitalSignsData.bodyTemperature = faker.number.float({
      min: 36.5,
      max: 37.5,
      fractionDigits: 1
    });
    growthRecordData.height = faker.number.float({
      min: 45,
      max: 100,
      fractionDigits: 1
    });
    growthRecordData.weight = faker.number.float({
      min: 2.5,
      max: 20,
      fractionDigits: 2
    });
    growthRecordData.headCircumference = faker.number.float({
      min: 30,
      max: 50,
      fractionDigits: 1
    });
  } else {
    // Adult
    vitalSignsData.bodyTemperature = faker.number.float({
      min: 36.0,
      max: 37.5,
      fractionDigits: 1
    });
    growthRecordData.height = faker.number.float({
      min: 150,
      max: 200,
      fractionDigits: 1
    });
    growthRecordData.weight = faker.number.float({
      min: 45,
      max: 120,
      fractionDigits: 1
    });
    vitalSignsData.systolic = faker.number.int({ min: 100, max: 140 });
    vitalSignsData.diastolic = faker.number.int({ min: 60, max: 90 });
    growthRecordData.bmi = faker.number.float({
      min: 18,
      max: 35,
      fractionDigits: 1
    });

    vitalSignsData.heartRate = faker.number.int({ min: 60, max: 100 });
    vitalSignsData.systolic = faker.number.int({ min: 120, max: 140 });
    vitalSignsData.respiratoryRate = faker.number.int({ min: 12, max: 20 });
    vitalSignsData.oxygenSaturation = faker.number.int({ min: 95, max: 100 });

    // Calculate WHO percentiles for children
    const height = growthRecordData.height;
    const weight = growthRecordData.weight;

    if (height > 0 && weight > 0) {
      growthRecordData.bmi = weight / (height / 100) ** 2;
      growthRecordData.weightForAgeZ = faker.number.float({
        min: -2,
        max: 2,
        fractionDigits: 3
      });
      growthRecordData.heightForAgeZ = faker.number.float({
        min: -2,
        max: 2,
        fractionDigits: 3
      });
      growthRecordData.bmiForAgeZ = faker.number.float({
        min: -2,
        max: 2,
        fractionDigits: 3
      });
      growthRecordData.hcForAgeZ = growthRecordData.headCircumference
        ? faker.number.float({ min: -2, max: 2, fractionDigits: 3 })
        : null;
    }

    vitalSignsData.notes = faker.datatype.boolean(0.3) ? faker.lorem.sentence() : null;

    return prisma.vitalSigns.create({
      data: vitalSignsData
    });
  }
  return prisma.growthRecord.create({
    data: growthRecordData
  });
};

// Create lab test
const createLabTest = async (prisma: PrismaSeedClient, medicalRecord: MedicalRecords, services: Service[]) => {
  return await prisma.labTest.create({
    data: {
      id: faker.string.uuid(),
      serviceId: faker.helpers.arrayElement(services).id,
      recordId: medicalRecord.id,
      testDate: faker.date.between({
        from: medicalRecord.createdAt,
        to: new Date()
      }),
      result: faker.helpers.arrayElement(['Normal', 'Abnormal', 'Pending', 'Inconclusive']),
      status: faker.helpers.arrayElement(['COMPLETED', 'PENDING', 'CANCELLED', 'REVIEWED']),
      notes: faker.datatype.boolean(0.5) ? faker.lorem.sentence() : null,
      createdAt: medicalRecord.createdAt
    }
  });
};

// Create drugs and prescriptions
const createDrugsAndPrescriptions = async (
  prisma: PrismaSeedClient,
  medicalRecords: MedicalRecords[],
  patients: Patient[],
  doctors: Doctor[]
) => {
  console.log('💊 Creating drugs and prescriptions...');

  // Create drugs
  const drugs = [];
  const drugNames = [
    'Amoxicillin',
    'Ibuprofen',
    'Paracetamol',
    'Aspirin',
    'Lisinopril',
    'Metformin',
    'Atorvastatin',
    'Levothyroxine',
    'Albuterol',
    'Omeprazole',
    'Losartan',
    'Sertraline',
    'Simvastatin',
    'Hydrochlorothiazide',
    'Prednisone',
    'Amlodipine',
    'Metoprolol',
    'Gabapentin',
    'Warfarin',
    'Furosemide'
  ];

  for (const drugName of drugNames) {
    const drug = await prisma.drug.create({
      data: {
        id: faker.string.uuid(),
        name: drugName,
        createdAt: faker.date.past({ years: 2 })
      }
    });
    drugs.push(drug);

    // Create dose guidelines for some drugs
    if (faker.datatype.boolean(0.6)) {
      await prisma.doseGuideline.create({
        data: {
          id: faker.string.uuid(),
          drugId: drug.id,
          route: getRandomEnumValue(DrugRoute),
          clinicalIndication: faker.lorem.words(3),
          minDosePerKg: faker.number.float({
            min: 1,
            max: 10,
            fractionDigits: 2
          }),
          maxDosePerKg: faker.number.float({
            min: 10,
            max: 50,
            fractionDigits: 2
          }),
          doseUnit: getRandomEnumValue(DosageUnit),
          frequencyDays: faker.helpers.arrayElement(['Once daily', 'Twice daily', 'Every 6 hours']),
          maxDosePer24h: faker.number.float({
            min: 100,
            max: 1000,
            fractionDigits: 2
          }),
          createdAt: faker.date.past({ years: 1 })
        }
      });
    }
  }

  // Create prescriptions
  const prescriptions = [];
  const prescriptionMedicalRecords = getRandomSubset(medicalRecords, CONFIG.totalPrescriptions);

  for (const medicalRecord of prescriptionMedicalRecords) {
    const patient = patients.find(p => p.id === medicalRecord.patientId);
    if (!patient) continue;

    const encounter = await prisma.diagnosis.findUnique({
      where: { medicalId: medicalRecord.id }
    });
    if (!encounter) continue;

    const prescription = await prisma.prescription.create({
      data: {
        id: faker.string.uuid(),
        medicalRecordId: medicalRecord.id,
        doctorId: medicalRecord.doctorId ?? doctors[0]?.id ?? '',
        patientId: patient.id,
        encounterId: encounter.id,
        medicationName: faker.helpers.arrayElement(drugNames),
        instructions: faker.datatype.boolean(0.7) ? faker.lorem.sentence() : null,
        issuedDate: medicalRecord.createdAt,
        endDate: faker.date.future({ years: 0.5 }),
        status: faker.helpers.arrayElement(['active', 'completed', 'cancelled']),
        clinicId: medicalRecord.clinicId,
        createdAt: medicalRecord.createdAt
      }
    });
    prescriptions.push(prescription);

    // Create prescribed items
    if (faker.datatype.boolean(0.8)) {
      const drug = faker.helpers.arrayElement(drugs);
      await prisma.prescribedItem.create({
        data: {
          id: faker.string.uuid(),
          prescriptionId: prescription.id,
          drugId: drug.id,
          frequency: faker.helpers.arrayElement(['Once daily', 'Twice daily', 'Three times daily', 'Every 6 hours']),
          duration: faker.helpers.arrayElement(['7 days', '10 days', '14 days', '30 days', 'Until finished']),

          dosageValue: faker.number.float({
            min: 1,
            max: 100,
            fractionDigits: 2
          }),
          dosageUnit: getRandomEnumValue(DosageUnit),
          instructions: prescription.instructions,
          createdAt: prescription.createdAt
        }
      });
    }
  }

  return { drugs, prescriptions };
};

// Create payments
const createPayments = async (
  prisma: PrismaSeedClient,
  appointments: Appointment[],
  patients: Patient[],
  services: Service[]
) => {
  console.log('💰 Creating payments...');
  const payments = [];

  const paymentAppointments = getRandomSubset(appointments, CONFIG.totalPayments);

  for (const appointment of paymentAppointments) {
    const patient = patients.find(p => p.id === appointment.patientId);
    if (!patient) continue;

    const totalAmount = faker.number.float({
      min: 50,
      max: 500,
      fractionDigits: 2
    });
    const amountPaid = faker.datatype.boolean(0.8)
      ? totalAmount
      : faker.number.float({ min: 0, max: totalAmount, fractionDigits: 2 });

    const status =
      amountPaid >= totalAmount ? PaymentStatus.PAID : amountPaid > 0 ? PaymentStatus.PARTIAL : PaymentStatus.UNPAID;

    const payment = await prisma.payment.create({
      data: {
        id: faker.string.uuid(),
        clinicId: appointment.clinicId,
        patientId: appointment.patientId,
        appointmentId: appointment.id,
        billDate: appointment.appointmentDate,
        paymentDate:
          status === PaymentStatus.PAID
            ? faker.date.between({
                from: appointment.appointmentDate > new Date() ? appointment.createdAt : appointment.appointmentDate,
                to: new Date()
              })
            : null,
        discount: faker.datatype.boolean(0.2) ? faker.number.float({ min: 5, max: 50, fractionDigits: 2 }) : null,
        totalAmount,
        amountPaid,
        amount: totalAmount,
        status,
        insurance: faker.datatype.boolean(0.3) ? faker.company.name() : null,
        insuranceId: faker.datatype.boolean(0.2) ? faker.string.alphanumeric(10) : null,
        serviceDate: appointment.appointmentDate,
        dueDate: faker.date.future({ years: 0.5 }),
        paidDate:
          status === PaymentStatus.PAID
            ? faker.date.between({
                from: appointment.appointmentDate > new Date() ? appointment.createdAt : appointment.appointmentDate,
                to: new Date()
              })
            : null,
        notes: faker.datatype.boolean(0.3) ? faker.lorem.sentence() : null,
        paymentMethod: getRandomEnumValue(PaymentMethod),
        receiptNumber: faker.number.int({ min: 1000, max: 9999 }),
        createdAt: appointment.appointmentDate,
        deletedAt: null,
        isDeleted: null
      }
    });
    payments.push(payment);

    // Create patient bills
    if (faker.datatype.boolean(0.6)) {
      await createPatientBill(prisma, payment, services);
    }
  }

  return payments;
};

// Create patient bill
const createPatientBill = async (prisma: PrismaSeedClient, payment: Payment, services: Service[]) => {
  const serviceCount = faker.number.int({ min: 1, max: 3 });

  for (let i = 0; i < serviceCount; i++) {
    await prisma.patientBill.create({
      data: {
        id: faker.string.uuid(),
        billId: payment.id,
        serviceId: faker.helpers.arrayElement(services).id,
        serviceDate: faker.date.recent(),
        quantity: faker.number.int({ min: 1, max: 5 }),
        unitCost: faker.number.float({ min: 10, max: 200, fractionDigits: 2 }),
        totalCost: faker.number.float({
          min: 10,
          max: 1000,
          fractionDigits: 2
        }),
        createdAt: payment.createdAt
      }
    });
  }
};

// Create notifications
const createNotifications = async (prisma: PrismaSeedClient, users: User[]) => {
  console.log('🔔 Creating notifications...');
  const notifications = [];

  for (let i = 0; i < CONFIG.totalNotifications; i++) {
    const user = faker.helpers.arrayElement(users);

    const notification = await prisma.notification.create({
      data: {
        id: faker.string.uuid(),
        userId: user.id,
        title: faker.lorem.words(3),
        message: faker.lorem.sentence(),
        type: getRandomEnumValue(NotificationType),
        read: faker.datatype.boolean(0.3),
        createdAt: faker.date.past({ years: 0.5 })
      }
    });
    notifications.push(notification);
  }

  return notifications;
};

// Create immunizations
const createImmunizations = async (prisma: PrismaSeedClient, patients: Patient[], staff: Staff[]) => {
  console.log('💉 Creating immunizations...');
  const immunizations: Immunization[] = [];

  const vaccines = [
    'Hepatitis B',
    'Rotavirus',
    'Diphtheria',
    'Tetanus',
    'Pertussis',
    'Haemophilus influenzae',
    'Pneumococcal',
    'Polio',
    'Influenza',
    'Measles',
    'Mumps',
    'Rubella',
    'Varicella',
    'Hepatitis A',
    'HPV'
  ];

  for (let i = 0; i < CONFIG.totalImmunizations; i++) {
    const patient = faker.helpers.arrayElement(patients);
    const administeringStaff = faker.helpers.arrayElement(staff);

    const immunization = await prisma.immunization.create({
      data: {
        id: faker.string.uuid(),
        patientId: patient.id,
        vaccine: faker.helpers.arrayElement(vaccines),
        date: faker.date.past({ years: 2 }),
        dose: faker.helpers.arrayElement(['1st dose', '2nd dose', 'Booster', 'Single dose']),
        lotNumber: faker.string.alphanumeric(10).toUpperCase(),
        administeredByStaffId: administeringStaff?.id || null,
        notes: faker.datatype.boolean(0.3) ? faker.lorem.sentence() : null,
        createdAt: faker.date.past({ years: 2 })
      }
    });
    immunizations.push(immunization);
  }

  return immunizations;
};

// Create feeding logs (for pediatric patients)
const createFeedingLogs = async (prisma: PrismaSeedClient, patients: Patient[]) => {
  console.log('🍼 Creating feeding logs...');
  const feedingLogs = [];
  const pediatricCandidates = patients.filter(patient => {
    const age = new Date().getFullYear() - patient.dateOfBirth.getFullYear();
    return age < 2;
  });
  const pediatricPatients = pediatricCandidates.slice(
    0,
    Math.min(CONFIG.totalFeedingLogs / 3, pediatricCandidates.length)
  );

  for (const patient of pediatricPatients) {
    const logCount = faker.number.int({ min: 3, max: 10 });

    for (let i = 0; i < logCount; i++) {
      const feedingLog = await prisma.feedingLog.create({
        data: {
          id: faker.string.uuid(),
          patientId: patient.id,
          date: faker.date.recent({ days: 30 }),
          type: getRandomEnumValue(FeedingType),
          duration: faker.number.int({ min: 10, max: 40 }),
          amount: faker.datatype.boolean(0.5) ? faker.number.float({ min: 30, max: 200, fractionDigits: 1 }) : null,
          breast: faker.datatype.boolean(0.5) ? faker.helpers.arrayElement(['Left', 'Right', 'Both']) : null,
          notes: faker.datatype.boolean(0.2) ? faker.lorem.sentence() : null
        }
      });
      feedingLogs.push(feedingLog);
    }
  }

  return feedingLogs;
};

// Create developmental checks
const createDevelopmentalChecks = async (prisma: PrismaSeedClient, patients: Patient[]) => {
  console.log('📊 Creating developmental checks...');
  const developmentalChecks = [];

  const pediatricCandidates = patients.filter(patient => {
    const age = new Date().getFullYear() - patient.dateOfBirth.getFullYear();
    return age < 5;
  });
  const pediatricPatients = pediatricCandidates.slice(
    0,
    Math.min(CONFIG.totalDevelopmentalChecks, pediatricCandidates.length)
  );

  for (const patient of pediatricPatients) {
    const check = await prisma.developmentalCheck.create({
      data: {
        patientId: patient.id,
        checkDate: faker.date.past({ years: 1 }),
        ageMonths: faker.number.int({ min: 1, max: 60 }),
        motorSkills: getRandomEnumValue(DevelopmentStatus),
        languageSkills: getRandomEnumValue(DevelopmentStatus),
        socialSkills: getRandomEnumValue(DevelopmentStatus),
        cognitiveSkills: getRandomEnumValue(DevelopmentStatus),
        milestonesMet: faker.lorem.words(5),
        milestonesPending: faker.lorem.words(3),
        concerns: faker.datatype.boolean(0.3) ? faker.lorem.sentence() : null,
        recommendations: faker.datatype.boolean(0.5) ? faker.lorem.sentence() : null,
        createdAt: faker.date.past({ years: 1 })
      }
    });
    developmentalChecks.push(check);

    // Create developmental milestones
    const milestoneCount = faker.number.int({ min: 2, max: 5 });
    for (let i = 0; i < milestoneCount; i++) {
      await prisma.developmentalMilestone.create({
        data: {
          patientId: patient.id,
          milestone: faker.lorem.words(3),
          ageAchieved: faker.helpers.arrayElement(['2 months', '6 months', '1 year', '18 months', '2 years']),
          dateRecorded: check.checkDate,
          notes: faker.datatype.boolean(0.3) ? faker.lorem.sentence() : null,
          createdBy: faker.person.fullName(),
          createdAt: check.checkDate
        }
      });
    }
  }

  return developmentalChecks;
};

// Create ratings
const createRatings = async (prisma: PrismaSeedClient, doctors: Doctor[], patients: Patient[]) => {
  console.log('⭐ Creating ratings...');
  for (const doctor of doctors) {
    if (!faker.datatype.boolean(0.7)) continue;

    const ratingCount = faker.number.int({ min: 1, max: 5 });

    for (let i = 0; i < ratingCount; i++) {
      const patient = faker.helpers.arrayElement(patients);

      await prisma.rating.create({
        data: {
          staffId: doctor.id,
          patientId: patient.id,
          rating: faker.number.int({ min: 1, max: 5 }),
          comment: faker.datatype.boolean(0.7) ? faker.lorem.sentence() : null,
          createdAt: faker.date.past({ years: 1 })
        }
      });
    }
  }
};

// Create expense categories and expenses
const createExpenses = async (prisma: PrismaSeedClient, clinics: Clinic[]) => {
  console.log('📈 Creating expenses...');

  // Create expense categories
  const categories = [];
  const categoryNames = [
    'Payroll',
    'Medical Supplies',
    'Facility',
    'Utilities',
    'Insurance',
    'Marketing',
    'Equipment',
    'Professional Services',
    'Other'
  ];

  for (const name of categoryNames) {
    const category = await prisma.expenseCategory.create({
      data: {
        id: faker.string.uuid(),
        name,
        color: faker.color.rgb()
      }
    });
    categories.push(category);
  }

  // Create expense subcategories
  const subcategories = [];
  const subcategoryData = [
    { name: 'Doctor Salaries', category: 'Payroll' },
    { name: 'Nurse Salaries', category: 'Payroll' },
    { name: 'Admin Salaries', category: 'Payroll' },
    { name: 'Medications', category: 'Medical Supplies' },
    { name: 'Surgical Supplies', category: 'Medical Supplies' },
    { name: 'Diagnostic Equipment', category: 'Medical Supplies' },
    { name: 'Rent/Mortgage', category: 'Facility' },
    { name: 'Maintenance', category: 'Facility' },
    { name: 'Cleaning', category: 'Facility' },
    { name: 'Electricity', category: 'Utilities' },
    { name: 'Water', category: 'Utilities' },
    { name: 'Internet', category: 'Utilities' },
    { name: 'Malpractice Insurance', category: 'Insurance' },
    { name: 'Health Insurance', category: 'Insurance' },
    { name: 'Advertising', category: 'Marketing' },
    { name: 'Website', category: 'Marketing' },
    { name: 'Medical Equipment', category: 'Equipment' },
    { name: 'Office Equipment', category: 'Equipment' },
    { name: 'Legal Fees', category: 'Professional Services' },
    { name: 'Accounting', category: 'Professional Services' }
  ];

  for (const subcat of subcategoryData) {
    const category = categories.find(c => c.name === subcat.category);
    if (!category) continue;

    const subcategory = await prisma.expenseSubCategory.create({
      data: {
        id: faker.string.uuid(),
        name: subcat.name,
        color: faker.color.rgb(),
        categoryId: category.id
      }
    });
    subcategories.push(subcategory);
  }

  // Create expenses
  const expenses = [];
  for (let i = 0; i < CONFIG.totalExpenses; i++) {
    const clinic = faker.helpers.arrayElement(clinics);
    const subcategory = faker.helpers.arrayElement(subcategories);

    const expense = await prisma.expense.create({
      data: {
        id: faker.string.uuid(),
        clinicId: clinic.id,
        subCategoryId: subcategory.id,
        amount: faker.number.float({ min: 100, max: 10_000, fractionDigits: 2 }),
        date: faker.date.past({ years: 1 }),
        description: faker.lorem.sentence(),
        createdAt: faker.date.past({ years: 1 })
      }
    });
    expenses.push(expense);
  }

  return { categories, subcategories, expenses };
};

// Create user saved filters

// Create audit logs
const createAuditLogs = async (prisma: PrismaSeedClient, users: User[], clinics: Clinic[]) => {
  console.log('📝 Creating audit logs...');
  const auditLogs = [];

  const actions = ['CREATE', 'UPDATE', 'DELETE', 'VIEW', 'EXPORT'];
  const models = ['Patient', 'Appointment', 'MedicalRecord', 'Prescription', 'Payment', 'User'];
  const levels = ['info', 'fatal', 'debug', 'warn', 'trace'];
  for (let i = 0; i < 50; i++) {
    const user = faker.helpers.arrayElement(users);
    const clinic = faker.helpers.arrayElement(clinics);

    const auditLog = await prisma.auditLog.create({
      data: {
        userId: user.id,
        clinicId: clinic.id,
        level: faker.helpers.arrayElement(levels),
        timestamp: faker.date.recent(),
        recordId: faker.string.uuid(),
        action: faker.helpers.arrayElement(actions),
        model: faker.helpers.arrayElement(models),
        createdAt: faker.date.past({ years: 0.5 })
      }
    });
    auditLogs.push(auditLog);
  }

  return auditLogs;
};

// Create WHO growth standards (sample data)
const createWHOGrowthStandards = async (prisma: PrismaSeedClient) => {
  console.log('📏 Creating WHO growth standards...');
  const standards = [];

  for (let ageMonths = 0; ageMonths <= 60; ageMonths += 6) {
    for (const gender of [Gender.MALE, Gender.FEMALE]) {
      for (const chartType of [ChartType.WFA, ChartType.HFA, ChartType.HcFA]) {
        const standard = await prisma.wHOGrowthStandard.create({
          data: {
            id: faker.string.uuid(),
            ageInMonths: ageMonths,
            ageDays: ageMonths * 30,
            gender,
            chartType,
            lValue: faker.number.float({ min: -2, max: 2, fractionDigits: 3 }),
            mValue: faker.number.float({ min: 5, max: 50, fractionDigits: 3 }),
            sValue: faker.number.float({
              min: 0.1,
              max: 0.3,
              fractionDigits: 3
            }),
            sd0: faker.number.float({ min: 5, max: 50, fractionDigits: 2 }),
            sd1neg: faker.number.float({ min: 4, max: 48, fractionDigits: 2 }),
            sd1pos: faker.number.float({ min: 6, max: 52, fractionDigits: 2 }),
            sd2neg: faker.number.float({ min: 3, max: 46, fractionDigits: 2 }),
            sd2pos: faker.number.float({ min: 7, max: 54, fractionDigits: 2 }),
            sd3neg: faker.number.float({ min: 2, max: 44, fractionDigits: 2 }),
            sd3pos: faker.number.float({ min: 8, max: 56, fractionDigits: 2 }),
            sd4neg: faker.number.float({ min: 1, max: 42, fractionDigits: 2 }),
            sd4pos: faker.number.float({ min: 9, max: 58, fractionDigits: 2 }),
            createdAt: faker.date.past({ years: 2 })
          }
        });
        standards.push(standard);
      }
    }
  }

  return standards;
};

// Create vaccine schedules
const createVaccineSchedules = async (prisma: PrismaSeedClient) => {
  console.log('📋 Creating vaccine schedules...');
  const schedules = [];

  const vaccineData = [
    {
      name: 'Hepatitis B',
      recommendedAge: 'Birth',
      dosesRequired: 3,
      ageInDaysMin: 0,
      ageInDaysMax: 365
    },
    {
      name: 'Rotavirus',
      recommendedAge: '2 months',
      dosesRequired: 3,
      ageInDaysMin: 60,
      ageInDaysMax: 240
    },
    {
      name: 'Diphtheria',
      recommendedAge: '2 months',
      dosesRequired: 5,
      ageInDaysMin: 60,
      ageInDaysMax: 1825
    },
    {
      name: 'Tetanus',
      recommendedAge: '2 months',
      dosesRequired: 5,
      ageInDaysMin: 60,
      ageInDaysMax: 1825
    },
    {
      name: 'Pertussis',
      recommendedAge: '2 months',
      dosesRequired: 5,
      ageInDaysMin: 60,
      ageInDaysMax: 1825
    },
    {
      name: 'Haemophilus influenzae',
      recommendedAge: '2 months',
      dosesRequired: 4,
      ageInDaysMin: 60,
      ageInDaysMax: 540
    },
    {
      name: 'Pneumococcal',
      recommendedAge: '2 months',
      dosesRequired: 4,
      ageInDaysMin: 60,
      ageInDaysMax: 540
    },
    {
      name: 'Polio',
      recommendedAge: '2 months',
      dosesRequired: 4,
      ageInDaysMin: 60,
      ageInDaysMax: 1825
    },
    {
      name: 'Influenza',
      recommendedAge: '6 months',
      dosesRequired: 2,
      ageInDaysMin: 180,
      ageInDaysMax: 3650
    },
    {
      name: 'Measles',
      recommendedAge: '12 months',
      dosesRequired: 2,
      ageInDaysMin: 365,
      ageInDaysMax: 1825
    }
  ];

  for (const vaccine of vaccineData) {
    const schedule = await prisma.vaccineSchedule.upsert({
      where: {
        vaccineName_recommendedAge: {
          vaccineName: vaccine.name,
          recommendedAge: vaccine.recommendedAge
        }
      },
      update: {
        // optional: update fields if you want reseeding to refresh data
      },
      create: {
        dosesRequired: vaccine.dosesRequired,
        vaccineName: vaccine.name,
        recommendedAge: vaccine.recommendedAge,
        minimumInterval: faker.number.int({ min: 30, max: 180 }),
        isMandatory: faker.datatype.boolean(0.8),
        ageInDaysMin: vaccine.ageInDaysMin,
        ageInDaysMax: vaccine.ageInDaysMax,
        createdAt: faker.date.past({ years: 2 })
      }
    });
    schedules.push(schedule);
  }

  return schedules;
};

// Main seed function
async function runSeed(prisma: PrismaSeedClient) {
  try {
    console.log('🌱 Starting comprehensive seed process...');

    // Clear existing data
    await clearAllData(prisma);

    // Create basic entities
    const clinics = await createClinics(prisma);
    const users = await createUsers(prisma);
    await associateUsersWithClinics(prisma, users, clinics);

    const doctors = await createDoctors(prisma, users, clinics);
    const staff = await createStaff(prisma, users, clinics);
    const patients = await createPatients(prisma, users, clinics);
    const services = await createServices(prisma, clinics);

    // Create appointments and related data
    const appointments = await createAppointments(prisma, patients, doctors, services);
    const medicalRecords = await createMedicalRecords(prisma, patients, appointments, services);

    // Create additional data
    const { drugs, prescriptions } = await createDrugsAndPrescriptions(prisma, medicalRecords, patients, doctors);
    const payments = await createPayments(prisma, appointments, patients, services);
    const notifications = await createNotifications(prisma, users);
    const immunizations = await createImmunizations(prisma, patients, staff);
    const feedingLogs = await createFeedingLogs(prisma, patients);
    const developmentalChecks = await createDevelopmentalChecks(prisma, patients);
    const { expenses } = await createExpenses(prisma, clinics);
    await createRatings(prisma, doctors, patients);
    const auditLogs = await createAuditLogs(prisma, users, clinics);
    const whoStandards = await createWHOGrowthStandards(prisma);
    const vaccineSchedules = await createVaccineSchedules(prisma);

    // Create some sample files
    console.log('📁 Creating sample files...');
    for (let i = 0; i < 10; i++) {
      await prisma.file.create({
        data: {
          id: faker.string.uuid(),
          userId: faker.helpers.arrayElement(users).id,
          mimeType: faker.system.mimeType(),
          size: faker.number.int({ min: 1000, max: 5_000_000 }),
          filename: faker.system.fileName(),
          slug: faker.lorem.slug(),
          createdAt: faker.date.past({ years: 1 })
        }
      });
    }

    console.log('\n🎉 Seed completed successfully!');
    console.log('📊 Summary of created data:');
    console.log(`🏥 Clinics: ${clinics.length}`);
    console.log(`👥 Users: ${users.length}`);
    console.log(`👨‍⚕️ Doctors: ${doctors.length}`);
    console.log(`👨‍💼 Staff: ${staff.length}`);
    console.log(`👤 Patients: ${patients.length}`);
    console.log(`🩺 Services: ${services.length}`);
    console.log(`📅 Appointments: ${appointments.length}`);
    console.log(`📋 Medical Records: ${medicalRecords.length}`);
    console.log(`💊 Drugs: ${drugs.length}`);
    console.log(`💊 Prescriptions: ${prescriptions.length}`);
    console.log(`💰 Payments: ${payments.length}`);
    console.log(`🔔 Notifications: ${notifications.length}`);
    console.log(`💉 Immunizations: ${immunizations.length}`);
    console.log(`🍼 Feeding Logs: ${feedingLogs.length}`);
    console.log(`📊 Developmental Checks: ${developmentalChecks.length}`);
    console.log(`📈 Expenses: ${expenses.length}`);
    console.log(`📝 Audit Logs: ${auditLogs.length}`);
    console.log(`📏 WHO Growth Standards: ${whoStandards.length}`);
    console.log(`📋 Vaccine Schedules: ${vaccineSchedules.length}`);
  } catch (error) {
    console.error('❌ Error during seed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// runSeed is exported
export default runSeed;
