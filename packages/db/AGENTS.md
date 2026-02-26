I'll help you convert this Drizzle documentation to Prisma for your Turborepo setup. Here's the updated documentation for your Prisma package:

## UPDATED DOCUMENTATION FOR PRISMA PACKAGE

# DATABASE - Prisma ORM Layer

## OVERVIEW

PostgreSQL database managed via Prisma ORM. Single source of truth for schema definitions, type-safe database client, and migrations.

## STRUCTURE

```
packages/database/
├── prisma/
│   ├── schema.prisma        # Main schema definition
│   ├── migrations/          # Auto-generated migration files
│   └── seeds/               # Seed data for development
│       ├── index.ts
│       ├── users.ts
│       ├── patients.ts
│       └── ...
├── src/
│   ├── client.ts            # Prisma client singleton
│   ├── repositories/        # Data access layer (CRUD operations)
│   │   ├── index.ts
│   │   ├── patient.repository.ts
│   │   ├── appointment.repository.ts
│   │   └── ...
│   ├── extensions/          # Prisma client extensions
│   │   ├── soft-delete.ts
│   │   ├── audit-log.ts
│   │   └── ...
│   └── types/               # Additional type definitions
│       ├── index.ts
│       └── ...
├── package.json
└── tsconfig.json
```

## WHERE TO LOOK

| Task                          | Location                                           |
| ----------------------------- | -------------------------------------------------- |
| Add/modify table/model        | `prisma/schema.prisma`                             |
| Add relations                 | `prisma/schema.prisma` (defined in models)        |
| Generate Prisma Client        | Run `pnpm db:generate`                             |
| Create migration              | Run `pnpm db:migrate`                              |
| Add CRUD operations           | `src/repositories/<entity>.repository.ts`          |
| Add seed data                 | `prisma/seeds/`                                    |
| Add Prisma extensions         | `src/extensions/`                                  |
| Use DB in your code           | Import `prisma` from `@repo/database/client`       |

## PATTERNS

### Schema Definition (schema.prisma)

```prisma
// packages/database/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
  binaryTargets = ["native"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Models
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  role          Role      @default(USER)
  phone         String?
  avatar        String?
  emailVerified Boolean   @default(false)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  // Relations
  doctorPatients Patient[] @relation("DoctorPatients")
  appointments   Appointment[]
  households     HouseholdMember[]
  activities     ActivityLog[]

  @@map("users")
}

model Patient {
  id               String        @id @default(cuid())
  firstName        String
  lastName         String
  dateOfBirth      DateTime
  gender           Gender?
  bloodType        String?
  allergies        String[]
  chronicConditions String[]
  medications      String[]
  emergencyContact String?
  emergencyPhone   String?
  insuranceProvider String?
  insuranceNumber  String?
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt
  deletedAt        DateTime?     @map("deleted_at") // For soft deletes
  
  // Relations
  doctorId         String?
  doctor           User?         @relation("DoctorPatients", fields: [doctorId], references: [id])
  appointments     Appointment[]
  medicalRecords   MedicalRecord[]
  vitalSigns       VitalSign[]
  immunizations    Immunization[]
  growthRecords    GrowthRecord[]
  householdId      String?
  household        Household?    @relation(fields: [householdId], references: [id])

  @@map("patients")
  @@index([doctorId])
  @@index([householdId])
}

model Appointment {
  id            String    @id @default(cuid())
  title         String
  description   String?
  startTime     DateTime
  endTime       DateTime
  status        AppointmentStatus @default(SCHEDULED)
  type          AppointmentType
  notes         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  // Relations
  patientId     String
  patient       Patient   @relation(fields: [patientId], references: [id])
  doctorId      String
  doctor        User      @relation(fields: [doctorId], references: [id])
  createdById   String
  createdBy     User      @relation("CreatedAppointments", fields: [createdById], references: [id])
  vitals        VitalSign[]

  @@map("appointments")
  @@index([patientId])
  @@index([doctorId])
  @@index([startTime])
}

// Enums
enum Role {
  ADMIN
  DOCTOR
  NURSE
  STAFF
  USER
}

enum Gender {
  MALE
  FEMALE
  OTHER
}

enum AppointmentStatus {
  SCHEDULED
  CONFIRMED
  IN_PROGRESS
  COMPLETED
  CANCELLED
  NO_SHOW
}

enum AppointmentType {
  CHECKUP
  FOLLOW_UP
  VACCINATION
  EMERGENCY
  CONSULTATION
  PROCEDURE
}
```

### Prisma Client Singleton

```typescript
// packages/database/src/client.ts
import { PrismaClient } from '@prisma/client'
import { logger } from '@repo/logger'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'error', 'warn']
    : ['error'],
  errorFormat: 'pretty',
})

// Middleware for logging
prisma.$use(async (params, next) => {
  const before = Date.now()
  const result = await next(params)
  const after = Date.now()
  
  logger.debug({
    model: params.model,
    action: params.action,
    duration: after - before,
  }, 'Prisma query executed')
  
  return result
})

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

### Repository Pattern

Repositories encapsulate all database queries:

```typescript
// packages/database/src/repositories/patient.repository.ts
import { prisma } from '../client'
import type { Patient, Prisma } from '@prisma/client'

type PatientWithRelations = Prisma.PatientGetPayload<{
  include: { 
    doctor: true, 
    appointments: true,
    vitalSigns: { take: 5, orderBy: { recordedAt: 'desc' } }
  }
}>

export const patientRepository = {
  // Find by ID with optional includes
  async findById(id: string, include?: Prisma.PatientInclude) {
    return prisma.patient.findUnique({
      where: { id, deletedAt: null }, // Soft delete filter
      include,
    })
  },

  // Find all with pagination and filters
  async findAll(params: {
    skip?: number
    take?: number
    where?: Prisma.PatientWhereInput
    orderBy?: Prisma.PatientOrderByWithRelationInput
    include?: Prisma.PatientInclude
  }) {
    const { skip, take, where, orderBy, include } = params
    return prisma.patient.findMany({
      skip,
      take,
      where: { ...where, deletedAt: null },
      orderBy: orderBy || { lastName: 'asc' },
      include,
    })
  },

  // Create new patient
  async create(data: Prisma.PatientCreateInput) {
    return prisma.patient.create({
      data,
      include: {
        doctor: true,
      },
    })
  },

  // Update patient
  async update(id: string, data: Prisma.PatientUpdateInput) {
    return prisma.patient.update({
      where: { id },
      data,
    })
  },

  // Soft delete
  async softDelete(id: string) {
    return prisma.patient.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
  },

  // Hard delete (admin only)
  async hardDelete(id: string) {
    return prisma.patient.delete({
      where: { id },
    })
  },

  // Find patients by doctor
  async findByDoctor(doctorId: string, params: { skip?: number; take?: number }) {
    return prisma.patient.findMany({
      where: { doctorId, deletedAt: null },
      skip: params.skip,
      take: params.take,
      orderBy: { lastName: 'asc' },
    })
  },

  // Search patients
  async search(query: string, limit = 10) {
    return prisma.patient.findMany({
      where: {
        OR: [
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
          { emergencyContact: { contains: query, mode: 'insensitive' } },
        ],
        deletedAt: null,
      },
      take: limit,
      include: {
        doctor: {
          select: { id: true, name: true, email: true },
        },
      },
    })
  },

  // Get patient count
  async count(where?: Prisma.PatientWhereInput) {
    return prisma.patient.count({
      where: { ...where, deletedAt: null },
    })
  },
}
```

### Repository Index

```typescript
// packages/database/src/repositories/index.ts
export { patientRepository } from './patient.repository'
export { appointmentRepository } from './appointment.repository'
export { userRepository } from './user.repository'
export { medicalRecordRepository } from './medical-record.repository'
export { vitalSignRepository } from './vital-sign.repository'
export { immunizationRepository } from './immunization.repository'
export { householdRepository } from './household.repository'
```

### Prisma Extensions

```typescript
// packages/database/src/extensions/soft-delete.ts
import { Prisma } from '@prisma/client'

export const softDeleteExtension = Prisma.defineExtension({
  name: 'soft-delete',
  model: {
    $allModels: {
      async softDelete<T>(this: T, id: string) {
        const context = Prisma.getExtensionContext(this)
        return (context as any).update({
          where: { id },
          data: { deletedAt: new Date() },
        })
      },
      async findActive<T>(this: T, args: any) {
        const context = Prisma.getExtensionContext(this)
        return (context as any).findMany({
          ...args,
          where: { ...args?.where, deletedAt: null },
        })
      },
    },
  },
})

// packages/database/src/extensions/audit-log.ts
export const auditLogExtension = Prisma.defineExtension({
  name: 'audit-log',
  query: {
    $allModels: {
      async create({ model, args, query }) {
        const result = await query(args)
        // Log creation to activity log table
        await prisma.activityLog.create({
          data: {
            action: 'CREATE',
            entityType: model,
            entityId: result.id,
            userId: args.data.userId,
            metadata: args.data,
          },
        })
        return result
      },
      async update({ model, args, query }) {
        const before = await prisma[model.toLowerCase()].findUnique({
          where: args.where,
        })
        const result = await query(args)
        // Log update with diff
        await prisma.activityLog.create({
          data: {
            action: 'UPDATE',
            entityType: model,
            entityId: result.id,
            userId: args.data.userId,
            metadata: { before, after: result },
          },
        })
        return result
      },
    },
  },
})
```

### Database Package Entry Point

```typescript
// packages/database/src/index.ts
export { prisma } from './client'

// Export repositories
export * from './repositories'

// Export types
export * from '@prisma/client'
export type { 
  PatientWithRelations,
  AppointmentWithRelations,
  // ... other custom types
} from './types'

// Export extensions
export { softDeleteExtension, auditLogExtension } from './extensions'

// Utility function for database health check
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`
    return true
  } catch (error) {
    return false
  }
}
```

### Package.json

```json
{
  "name": "@repo/database",
  "version": "0.0.1",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./client": "./src/client.ts"
  },
  "scripts": {
    "db:generate": "prisma generate",
    "db:push": "prisma db push --skip-generate",
    "db:migrate": "prisma migrate dev",
    "db:deploy": "prisma migrate deploy",
    "db:reset": "prisma migrate reset --force",
    "db:seed": "tsx prisma/seeds/index.ts",
    "db:studio": "prisma studio",
    "clean": "rm -rf .turbo node_modules dist"
  },
  "dependencies": {
    "@prisma/client": "^5.10.0",
    "@repo/logger": "workspace:*"
  },
  "devDependencies": {
    "prisma": "^5.10.0",
    "tsx": "^4.7.0",
    "@types/node": "^20.11.0"
  }
}
```

### Seed Script

```typescript
// packages/database/prisma/seeds/index.ts
import { PrismaClient } from '@prisma/client'
import { seedUsers } from './users'
import { seedPatients } from './patients'
import { seedAppointments } from './appointments'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')
  
  await seedUsers(prisma)
  await seedPatients(prisma)
  await seedAppointments(prisma)
  
  console.log('✅ Seeding complete')
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

## KEY TABLES (Pediatric Clinic Focus)

| Table                    | Purpose                                    |
| ------------------------ | ------------------------------------------ |
| `users`                  | Staff accounts (doctors, nurses, admins)   |
| `patients`               | Patient demographics and medical info      |
| `appointments`           | Scheduled visits and follow-ups            |
| `medical_records`        | Clinical notes, diagnoses, prescriptions   |
| `vital_signs`            | Growth metrics, vitals at each visit       |
| `immunizations`          | Vaccination records and schedules          |
| `growth_records`         | Height/weight tracking over time           |
| `households`             | Family groups for sharing access           |
| `activity_logs`          | Audit trail for compliance                 |

## USAGE IN TURBOREPO APPS

### In Next.js App (apps/web)

```typescript
// apps/web/app/api/patients/route.ts
import { prisma, patientRepository } from '@repo/database'

export async function GET() {
  const patients = await patientRepository.findAll({
    take: 20,
    include: {
      doctor: true,
      vitalSigns: { take: 1, orderBy: { recordedAt: 'desc' } },
    },
  })
  
  return Response.json(patients)
}
```

### In tRPC Router

```typescript
// packages/trpc/src/server/routers/patient.ts
import { patientRepository } from '@repo/database'
import { protectedProcedure, router } from '../trpc'
import { z } from 'zod'

export const patientRouter = router({
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return patientRepository.findById(input.id, {
        doctor: true,
        appointments: {
          orderBy: { startTime: 'desc' },
          take: 5,
        },
      })
    }),
})
```

## ANTI-PATTERNS

- ❌ Direct `prisma` queries in tRPC routers or components (use repositories)
- ❌ Manually editing migration files (auto-generated by Prisma)
- ❌ Hard-deleting data without soft delete option
- ❌ Ignoring `deletedAt` filters in queries
- ❌ Not using transactions for multi-table operations
- ❌ Exposing raw database errors to clients
- ❌ Forgetting to run `prisma generate` after schema changes

## MIGRATION COMMANDS

```bash
# Development
pnpm db:migrate --name add_patient_fields  # Create and apply migration
pnpm db:generate                            # Generate Prisma Client
pnpm db:studio                              # Open Prisma Studio

# Production
pnpm db:deploy                               # Apply migrations in production
pnpm db:generate                             # Generate client in production build
```

## TIPS

1. **Always use repositories** - Keeps your data access layer consistent and testable
2. **Soft deletes** - Use `deletedAt` instead of hard deletes for compliance
3. **Index important fields** - Add `@@index` for frequently queried fields
4. **Use Prisma's type safety** - Leverage generated types for compile-time safety
5. **Batch operations** - Use `createMany`, `updateMany` for performance
6. **Transactions** - Use `prisma.$transaction()` for atomic operations
7. **Query logging** - Enable in development to debug performance

This documentation is tailored for your pediatric clinic management system and follows Prisma best practices within a Turborepo monorepo structure.