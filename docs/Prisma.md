---
# Specify the following for Cursor rules
description: Guidelines for migrating an app to Prisma ORM v7
alwaysApply: false
---

# Prisma v6 → v7 Migration Assistant

**Role:** You are a precise, changeset-oriented code migration assistant. Apply the steps below to upgrade a project from **Prisma ORM v6** to **Prisma ORM v7** with minimal disruption. Work in small, re-viewable steps and explain each change briefly. If something is unclear, assume sensible defaults that keep the app compiling and retaining functionality.

## Ground Rules

- Never introduce Prisma Accelerate or HTTP/WebSocket drivers on your own.
- Do **not** remove Prisma Accelerate automatically.
- **If Accelerate is in use with Caching**, preserve it and print guidance about future changes.
- **If Accelerate is used without Caching**, *suggest* switching to Direct TCP + adapter.
- Always **load env variables explicitly** using `dotenv` (`import 'dotenv/config'`), unless the runtime is pnpm (then skip `dotenv`).
- Keep TypeScript **ESM** compatible, and avoid CommonJS requires.
- Favor additive, reversible edits; do not remove user logic.
- If the schema uses **MongoDB**, stop and output a clear message to remain on Prisma v6 for now.

---

## 0) Detect Context & Plan

1. Identify:
    - Package manager and scripts.
    - Database: Postgres, SQLite, MySQL, SQL Server (MongoDB = halt).
    - Whether `@prisma/client` is imported from `node_modules` or a generated path.
    - Whether the project uses **Prisma Accelerate**, and if so:
        - Check if **Caching** is enabled:
            - Look for `withAccelerate({ cache: ... })`
            - Look for `PRISMA_ACCELERATE_CACHE_*` environment variables
            - Look for `accelerate:` block in config (if any)
2. In the migration plan output:
    - If Accelerate + Caching is detected →
      **Print a message: “Prisma Accelerate Caching detected — Prisma recommends keeping Accelerate for caching scenarios.”**
    - If Accelerate without Caching →
      **Print: “Accelerate detected but caching is not enabled. In Prisma v7, Direct TCP + adapters are recommended unless caching is required.”**
    - If no Accelerate → continue normally.

> **Do not modify or remove Accelerate code paths. Only describe recommendations.**

---

## 1) Dependencies

- Upgrade/install:
    - Dev: `prisma@latest` (7.0.0), `tsx`, `dotenv` (skip if pnpm).
    - Runtime: `@prisma/client@latest` (7.0.0).
    - **One** database adapter that matches the datasource:
        - Postgres: `@prisma/adapter-ppg`
        - SQLite: `@prisma/adapter-better-sqlite3`
        - MySQL/mariaDB: `@prisma/adapter-mariadb`
        - D1: `@prisma/adapter-d1`
        - PlanetScale: `@prisma/adapter-planetscale`
        - MSSQL: `@prisma/adapter-mssql`
        - CockroachDB: `@prisma/adapter-pg`
        - Neon: `@prisma/adapter-neon`

- **Do not remove Accelerate packages automatically.**
- If Accelerate + Caching is detected, print:
    ```
    Prisma Accelerate Caching detected — keeping Accelerate is recommended.
    ```
- If Accelerate is present but caching is not:
    ```
    Accelerate detected without caching — Prisma v7 suggests adopting Direct TCP with a database adapter for best performance.
    ```
- Eliminate no user code; only output informational guidance.

> Produce installation commands based on the repo’s package manager.

---

## 2) Prisma Schema Changes

- In `schema.prisma`:

  - `generator client`:

    ```diff
    - provider = "prisma-client-js"
    + provider = "prisma-client"
      output   = "./generated"
    ```

  - Remove any `previewFeatures = ["driverAdapters"]` and any `engineType` attributes.

  - Update the `datasource db` block:

    - **Goal:** keep the existing `provider` value, but **remove any `url = …` entry**.

    - Example (for illustration only — do not insert comments into the user's schema):

      - Before:

        ```prisma
        datasource db {
          provider = "postgresql"
          url      = env("DATABASE_URL")
        }
        ```

      - After:

        ```prisma
        datasource db {
          provider = "postgresql"
        }
        ```

    - Rules:

      - Preserve the existing `provider` value exactly as-is (e.g. `"postgresql"`, `"mysql"`, `"sqlite"`, etc.).
      - Remove only the `url = ...` line from the `datasource db` block.
      - Preserve any other properties on the datasource (for example: `shadowDatabaseUrl`, `relationMode`, `schemas`, `extensions`, `directUrl`, etc.).
      - Do **not** add explanatory comments into the schema; comments in this prompt are hints for you, not code to emit.

- After edits, run `prisma generate`.

---

## 3) Introduce prisma.config.ts Create **prisma.config.ts** at repo root (or prisma.config.mjs), centralizing Prisma CLI config and env management:

```tsx
import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Prefer DIRECT TCP via DATABASE_URL
    url: env('DATABASE_URL'),
    // Optionally support shadow DB if present:
    // shadowDatabaseUrl: env('SHADOW_DATABASE_URL'),
  },
})
```

- Remove any prisma.seed from package.json (the config above replaces it).

---

## 4) ESM & TS Baseline - Ensure **package.json**:
```json
    {
      "type": "module",
      "scripts": {
        "dev": "tsx src/index.ts",
        "generate": "prisma generate",
        "migrate": "prisma migrate dev",
        "build": "tsc -p tsconfig.json"
      }
    }
```

- Ensure **tsconfig.json** supports ESM:

```json
    {
      "compilerOptions": {
        "module": "ESNext",
        "moduleResolution": "Node",
        "target": "ES2023",
        "strict": true,
        "esModuleInterop": true
      }
    }
```
---

## 5) Refactor Client Import & Construction

If Prisma Accelerate is detected:

- If caching is enabled → **preserve the existing Accelerate setup**.
- If caching is not enabled → **suggest** switching to Direct TCP with an adapter, but do not make changes automatically.

Continue generating examples using Direct TCP, but **do not replace or remove the user's Accelerate setup**.

---

## 6) Seeding Script Update - Ensure prisma/seed.ts uses the same **adapter** and **dotenv** import as runtime:

```tsx
    import 'dotenv/config'
    import { PrismaClient } from '../generated/prisma/client.js'
    import { PrismaPg } from '@prisma/adapter-pg'

    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
    const prisma = new PrismaClient({ adapter })

    // seed…
```
- Set seed command via prisma.config.ts (no package.json#prisma.seed).

---

## 7) Middleware → Extensions

- If prisma.$use middleware exists, inform users that the API has been removed

---

## 8) Accelerate Messaging

### 🟩 If Accelerate Caching is detected

```
Prisma Accelerate Caching detected.
Prisma v7 fully supports caching scenarios via Accelerate.
Your existing Accelerate setup will be preserved.
```

### 🟨 If Accelerate is present but caching is NOT detected

```
Prisma Accelerate detected without caching.

Prisma recommends using Direct TCP with a database adapter in v7 for
optimal performance unless caching is required.

Consider migrating from Accelerate → Direct TCP if caching is not needed.
(No code changes were applied automatically.)
```

### 🟦 If Accelerate is not detected at all

```
Direct TCP is the recommended default for Prisma v7.
Your project will be migrated accordingly using the appropriate adapter.
```

---

## 9) Scripts & CI
- Verify scripts:
    - "generate": "prisma generate"
    - "migrate": "prisma migrate dev"
    - "dev"/"start" run with ESM and ensure dotenv/config is effective.
- In CI, ensure Node **≥ 20.19** and TypeScript **≥ 5.4**.

---
## 10) Run & Verify

1. prisma generate → should succeed and emit client to ./generated.
2. prisma migrate dev → runs against DATABASE_URL (direct TCP).
3. tsx prisma/seed.ts → inserts sample record(s) cleanly.
4. App boot: instantiate PrismaClient with adapter; confirm queries work.
5. If **P1017 / connection** errors: - Confirm DATABASE_URL and network reachability. - Confirm import 'dotenv/config' executes early.
6. If **module resolution** errors: - Confirm "type": "module", ESM imports, and re-generate client.

---

## 11) CLI Flag Changes

### `--schema` and `--url` flags removed from `prisma db execute`

The `--schema` and `--url` flags have been removed from `prisma db execute`. Configure your database connection in `prisma.config.ts` instead.

**Before (v6):**
```bash
# Using --schema
prisma db execute --file ./script.sql --schema prisma/schema.prisma

# Using --url
prisma db execute --file ./script.sql --url "$DATABASE_URL"
```

**After (v7):**
```bash
prisma db execute --file ./script.sql
```

The database URL is now read from `prisma.config.ts`.

### `prisma migrate diff` options changed

Several options have been removed and replaced:

| Removed Option             | Replacement                  |
|---------------------------|------------------------------|
| `--from-url`              | `--from-config-datasource`   |
| `--to-url`                | `--to-config-datasource`     |
| `--from-schema-datasource`| `--from-config-datasource`   |
| `--to-schema-datasource`  | `--to-config-datasource`     |
| `--shadow-database-url`   | Configure in `prisma.config.ts` |

**Before (v6):**
```bash
prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema schema.prisma \
  --script
```

**After (v7):**
```bash
prisma migrate diff \
  --from-config-datasource \
  --to-schema schema.prisma \
  --script
```

### Migration Action

- Update any scripts or CI pipelines that use `prisma db execute --schema` or `prisma db execute --url`.
- Update any scripts using `prisma migrate diff` with `--from-url`, `--to-url`, `--from-schema-datasource`, `--to-schema-datasource`, or `--shadow-database-url`.
- Configure your database connection in `prisma.config.ts` instead.

---

## Safety Checks & Edge Cases
- **MongoDB provider** detected → stop and recommend staying on Prisma 6 until v7 MongoDB support returns.
- **Multiple entrypoints** (workers, scripts, tests): apply the same client/adapter/dotenv pattern everywhere.
- **Typed SQL** or custom extensions: keep as-is; ensure they compile after client re-generation.
- Preserve existing output path if the project uses custom locations.

---

## 11) Mapped Enum Breaking Change

In Prisma v7, the generated TypeScript enum values now use `@map` values instead of schema names.

### Example

Given this schema:
```prisma
enum SuggestionStatus {
  PENDING  @map("pending")
  ACCEPTED @map("accepted")
  REJECTED @map("rejected")
}
```

**v6 generated enum:**
```ts
export const SuggestionStatus = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED'
} as const
```

**v7 generated enum:**
```ts
export const SuggestionStatus = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected'
} as const
```

### Known Bug (as of v7.2.0)

⚠️ **There is a known bug** where using mapped enum values with Prisma Client operations causes runtime errors. The TypeScript types expect mapped values, but the engine expects schema names. Track this at [GitHub #28591](https://github.com/prisma/prisma/issues/28591).

### Temporary Workarounds

1. **Use schema names as string literals** (causes TS error but works at runtime):
   ```ts
   await prisma.suggestion.create({
     data: {
       status: "PENDING" as any, // Use schema name, not mapped value
     },
   });
   ```

2. **Remove `@map` from enum values** temporarily if you don't strictly need different database values:
   ```prisma
   // Before: with @map directives
   enum SuggestionStatus {
     PENDING  @map("pending")
     ACCEPTED @map("accepted")
     REJECTED @map("rejected")
   }

   // After: without @map directives
   enum SuggestionStatus {
     PENDING
     ACCEPTED
     REJECTED
   }
   ```
   With this change, both the schema names and the database values will be `PENDING`, `ACCEPTED`, and `REJECTED`.

### Migration Action

- Inform users about this breaking change if their schema uses `@map` on enum values.
- Warn about the current bug and suggest workarounds until it's fixed.

---

## Deliverables

- A short **CHANGELOG** summary in the PR body:
    - Dependency bumps and added adapter
    - Schema generator change
    - New `prisma.config.ts`
    - Runtime refactor to adapter + optional Accelerate messaging
    - ESM/TS config updates
    - Seed script updates
    - No automatic removal of Accelerate
    - CLI flag changes (`--schema` and `--url` removal from `db execute`, `migrate diff` option changes)
    - Mapped enum breaking change warning (if applicable)
generator client {
  provider               = "prisma-client"
  output                 = "./generated"
  moduleFormat           = "esm"
  engineType             = "client"
  // Optional: Explicitly target the pnpm runtime
  runtime                = "pnpm"
  importFileExtension    = "ts"
  generatedFileExtension = "ts"
  previewFeatures        = ["views", "schemaEngineDriverAdapters", "relationJoins", "postgresqlExtensions"]
}

datasource db {
  provider = "postgresql"
}

model Settings {
  id        String   @id @default(cuid())
  key       String   @unique
  value     String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("settings")
}

model User {
  id               String            @id @default(cuid())
  name             String            @db.VarChar(255)
  email            String            @unique @db.VarChar(255)
  image            String?           @db.VarChar(512)
  emailVerified    Boolean           @default(false)
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @default(now()) @updatedAt
  role             UserRole?
  banned           Boolean?          @default(false)
  banReason        String?
  banExpires       DateTime?
  twoFactorEnabled Boolean?          @default(false)
  deletedAt        DateTime?
  isDeleted        Boolean?          @default(false)
  timezone         String?           @default("UTC")
  language         String?           @default("en")
  // Admin and security fields
  isAdmin          Boolean?          @default(false)
  phone            String?
  // Relations
  sessions         Session[]
  accounts         Account[]
  usersToClinics   ClinicMember[]
  clinics          Clinic[]          @relation("UserClinics") // conceptual; actual m‑n via ClinicMember
  patients         Patient[]         @relation("PatientUser")
  doctors          Doctor[]
  staffs           Staff[]
  notifications    Notification[]
  userSavedFilters UserSavedFilter[]
  auditLogs        AuditLog[]
  createdPatients  Patient[]         @relation("PatientCreatedBy")
  guardians        Guardian[]

  @@index([emailVerified])
  @@index([banned])
  @@index([isDeleted])
  @@index([role, createdAt])
  @@index([createdAt(sort: Desc)])
  @@map("user")
}

model Session {
  id        String   @id @default(cuid())
  expiresAt DateTime
  token     String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  ipAddress String?
  userAgent String?
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  impersonatedBy String?

  @@unique([token])
  @@index([userId])
  @@map("session")
}

model Account {
  id                    String    @id @default(cuid())
  accountId             String
  providerId            String
  userId                String
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  accessToken           String?
  refreshToken          String?
  idToken               String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  password              String?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  @@index([userId])
  @@map("account")
}

model Verification {
  id         String   @id @default(cuid())
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([identifier])
  @@map("verification")
}

model Notification {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  title     String
  message   String
  type      String    @default("info") // info, success, warning, error
  read      Boolean   @default(false)
  readAt    DateTime?
  createdAt DateTime  @default(now())

  @@index([userId, read])
  @@map("notifications")
}

model AuditLog {
  id     String  @id @default(cuid())
  userId String?
  user   User?   @relation(fields: [userId], references: [id], onDelete: SetNull)
  action String

  details    String?
  resource   String?
  resourceId String?
  metadata   Json?
  ipAddress  String?
  userAgent  String?
  createdAt  DateTime @default(now())
  recordId   String?  @map("record_id")
  model      String
  userid     String?
  clinic     Clinic?  @relation(fields: [clinicid], references: [id])

  clinicid  String?
  updatedAt DateTime @updatedAt @map("updated_at")

  @@index([userId])
  @@index([clinicid])
  @@index([createdAt])
  @@map("audit_logs")
}

model SystemSettings {
  id                   String    @id @default("system") // Singleton: only one row exists
  theme                String    @default("default") // Active theme name (default, bubblegum, ocean, forest)
  maintenanceMode      Boolean   @default(false)
  maintenanceMessage   String?
  maintenanceStartedAt DateTime?
  maintenanceEndTime   DateTime? // Optional scheduled end time
  updatedAt            DateTime  @updatedAt
  updatedBy            String? // User ID who last updated the settings

  @@map("system_settings")
}

model Clinic {
  id        String    @id @default(uuid())
  name      String    @unique
  email     String?   @db.Text
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  timezone  String?   @default("UTC")
  address   String?
  phone     String?   @db.Text
  deletedAt DateTime?
  isDeleted Boolean?  @default(false)

  // Relations
  doctors          Doctor[]
  patients         Patient[]
  appointments     Appointment[]
  usersToClinics   ClinicMember[]
  medicalRecords   MedicalRecords[]
  clinicSettings   ClinicSetting[]
  prescriptions    Prescription[]
  payments         Payment[]
  encounters       Diagnosis[]
  services         Service[]
  // expenses         Expense[]
  userSavedFilters UserSavedFilter[]
  auditLogs        AuditLog[]
  staffs           Staff[]
  users            User[]            @relation("UserClinics")

  @@index([isDeleted])
  @@map("clinics")
}

model ClinicMember {
  userId    String    @map("user_id")
  clinicId  String    @map("clinic_id")
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @default(now()) @updatedAt @map("updated_at")
  role      UserRole?

  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  clinic Clinic @relation(fields: [clinicId], references: [id], onDelete: Cascade)

  @@id([userId, clinicId])
  @@map("users_to_clinics")
}

model Doctor {
  id                   String    @id @default(uuid())
  email                String?   @db.VarChar(255)
  name                 String
  userId               String?   @unique
  clinicId             String?   @map("clinic_id")
  specialty            String    @db.Text
  licenseNumber        String?
  phone                String?   @db.Text
  address              String?
  department           String?
  img                  String?
  colorCode            String?
  availabilityStatus   String?
  availableFromWeekDay Int?      @map("available_from_week_day")
  availableToWeekDay   Int?      @map("available_to_week_day")
  isActive             Boolean?
  status               Status?
  availableFromTime    String?   @map("available_from_time")
  availableToTime      String?   @map("available_to_time")
  type                 JOBTYPE   @default(FULL)
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt
  appointmentPrice     Decimal   @map("appointment_price") @db.Decimal(10, 2)
  role                 UserRole?
  deletedAt            DateTime?
  isDeleted            Boolean?  @default(false)

  user           User?            @relation(fields: [userId], references: [id], onDelete: Cascade)
  clinic         Clinic?          @relation(fields: [clinicId], references: [id], onDelete: Cascade)
  workingDays    WorkingDays[]
  appointments   Appointment[]
  encounter      Diagnosis[]
  Prescription   Prescription[]
  medicalRecords MedicalRecords[]
  ratings        Rating[]

  @@index([clinicId, isActive])
  @@index([specialty, clinicId])
  @@index([isDeleted])
  @@map("doctors")
}

model WorkingDays {
  id        Int    @id @default(autoincrement())
  doctorId  String
  day       String
  startTime String
  endTime   String

  doctor Doctor @relation(fields: [doctorId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([doctorId, day])
}

model Staff {
  id    String  @id @default(uuid())
  email String? @db.VarChar(255)
  name  String
  phone String? @db.Text

  userId String? @unique
  user   User?   @relation(fields: [userId], references: [id], onDelete: Cascade)

  clinicId String?
  clinic   Clinic? @relation(fields: [clinicId], references: [id])

  address       String
  department    String?
  img           String?
  licenseNumber String?
  colorCode     String?
  hireDate      DateTime? @default(now()) @db.Date
  salary        Float?

  role   UserRole
  status Status?  @default(ACTIVE)

  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?
  isActive  Boolean?

  immunizations Immunization[] @relation("AdministeredByStaff")

  @@index([deletedAt])
}

model Payment {
  id            String        @id @default(uuid())
  clinicId      String?
  clinic        Clinic?       @relation(fields: [clinicId], references: [id])
  billId        String?
  patientId     String?
  appointmentId String        @unique
  billDate      DateTime
  paymentDate   DateTime?     @db.Date
  discount      Decimal?      @db.Decimal(10, 2)
  totalAmount   Decimal?      @db.Decimal(10, 2)
  amountPaid    Decimal?      @db.Decimal(10, 2)
  patient       Patient?      @relation(fields: [patientId], references: [id], onDelete: Cascade)
  appointment   Appointment?  @relation(fields: [appointmentId], references: [id], onDelete: Cascade)
  amount        Decimal?      @db.Decimal(10, 2)
  status        PaymentStatus @default(PAID)
  insurance     String?
  insuranceId   String?
  serviceDate   DateTime?
  dueDate       DateTime?
  paidDate      DateTime?
  notes         String?
  deletedAt     DateTime?
  isDeleted     Boolean?      @default(false)
  paymentMethod PaymentMethod @default(CASH)
  receiptNumber Int           @default(autoincrement())

  bills     PatientBill[]
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt

  @@index([isDeleted]) // For filtering out deleted records
  @@index([patientId, status])
  @@index([status, dueDate])
  @@index([patientId, paymentDate])
}

model Reminder {
  id            String         @id @default(uuid())
  appointmentId String         @unique
  appointment   Appointment    @relation(fields: [appointmentId], references: [id], onDelete: Cascade)
  method        ReminderMethod
  sentAt        DateTime
  status        ReminderStatus
}

model PatientBill {
  id          String   @id @default(uuid())
  billId      String
  serviceId   String
  serviceDate DateTime
  quantity    Int
  unitCost    Decimal? @db.Decimal(10, 2)
  totalCost   Decimal? @db.Decimal(10, 2)
  service     Service  @relation(fields: [serviceId], references: [id])
  payment     Payment  @relation(fields: [billId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Service {
  id           String           @id @default(uuid())
  serviceName  String
  description  String
  price        Decimal          @db.Decimal(10, 2)
  labtest      LabTest[]
  bills        PatientBill[]
  category     ServiceCategory? // Optional categorization
  duration     Int? // Duration in minutes
  isAvailable  Boolean?         @default(true) // Whether the service is currently offered
  clinicId     String?
  clinic       Clinic?          @relation(fields: [clinicId], references: [id])
  icon         String?
  color        String?
  appointments Appointment[] // A service can be part of many appointments

  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?
  isDeleted Boolean?  @default(false)

  @@index([isDeleted]) // For filtering out deleted records
  @@index([serviceName])
}

model ClinicSetting {
  id       String @id @default(uuid())
  clinicId String @unique
  clinic   Clinic @relation(fields: [clinicId], references: [id], onDelete: Cascade)

  // Business hours
  openingTime String // "08:00"
  closingTime String // "17:00"
  workingDays String[] // ["MON", "TUE", "WED", "THU", "FRI"]

  // Medical settings
  defaultAppointmentDuration Int     @default(30) // minutes
  requireEmergencyContact    Boolean @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("clinic_settings")
}

model Prescription {
  id              String    @id @default(uuid())
  medicalRecordId String    @map("medical_record_id")
  doctorId        String? // Doctor who issued the prescription (optional if already linked via medicalRecord.doctor)
  patientId       String // Patient the prescription is for (redundant if linked via medicalRecord.patient, but ensures direct access)
  encounterId     String
  encounter       Diagnosis @relation(fields: [encounterId], references: [id])
  medicationName  String?   @map("medication_name")
  instructions    String?   @map("instructions") @db.Text // Special instructions
  issuedDate      DateTime  @default(now()) @map("issued_date") @db.Timestamp(3)
  endDate         DateTime? @map("end_date") @db.Timestamp(3) // When the prescription is valid until
  status          String    @default("active") // e.g., "active", "completed", "cancelled" - consider an enum

  // Relations
  medicalRecord MedicalRecords @relation(fields: [medicalRecordId], references: [id], onDelete: Cascade)
  doctor        Doctor?        @relation(fields: [doctorId], references: [id])
  patient       Patient        @relation(fields: [patientId], references: [id])
  clinicId      String?
  clinic        Clinic?        @relation(fields: [clinicId], references: [id])

  createdAt       DateTime         @default(now()) @db.Timestamp(3)
  updatedAt       DateTime         @updatedAt @db.Timestamp(3)
  prescribedItems PrescribedItem[]

  @@index([clinicId])
  @@map("prescriptions")
}

model WHOGrowthStandard {
  id              String          @id @default(uuid())
  ageInMonths     Int?            @map("age_in_months") // Renamed from ageDays for clarity, common in WHO standards
  ageDays         Int
  gender          Gender
  measurementType MeasurementType @map("measurement_type") // e.g., Weight-for-age, Height-for-age
  lValue          Float           @map("l_value") @db.DoublePrecision
  mValue          Float           @map("m_value") @db.DoublePrecision
  sValue          Float           @map("s_value") @db.DoublePrecision
  sd0             Float           @map("sd0") @db.DoublePrecision
  sd1neg          Float           @map("sd1neg") @db.DoublePrecision
  sd1pos          Float           @map("sd1pos") @db.DoublePrecision
  sd2neg          Float           @map("sd2neg") @db.DoublePrecision
  sd2pos          Float           @map("sd2pos") @db.DoublePrecision
  sd3neg          Float           @map("sd3neg") @db.DoublePrecision
  sd3pos          Float           @map("sd3pos") @db.DoublePrecision
  sd4neg          Float?          @map("sd4neg") @db.DoublePrecision
  sd4pos          Float?          @map("sd4pos") @db.DoublePrecision

  createdAt DateTime @default(now()) @db.Timestamp(3)
  updatedAt DateTime @updatedAt @db.Timestamp(3)

  @@map("who_growth_standards")
}

model Rating {
  id        Int      @id @default(autoincrement())
  staffId   String?  @map("staff_id")
  patientId String?  @map("patient_id")
  rating    Int
  comment   String?
  doctor    Doctor?  @relation(fields: [staffId], references: [id], onDelete: Cascade)
  patient   Patient? @relation(fields: [patientId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("rating")
}

model Drug {
  id         String          @id @default(uuid())
  name       String          @unique
  guidelines DoseGuideline[]
  createdAt  DateTime        @default(now())
  updatedAt  DateTime        @updatedAt

  prescribedItems PrescribedItem[]
}

model DoseGuideline {
  id                     String   @id @default(uuid())
  drugId                 String
  route                  String
  clinicalIndication     String
  minDosePerKg           Float?
  maxDosePerKg           Float?
  doseUnit               String?
  frequencyDays          String?
  gestationalAgeWeeksMin Float?
  gestationalAgeWeeksMax Float?
  postNatalAgeDaysMin    Float?
  postNatalAgeDaysMax    Float?
  maxDosePer24h          Float?
  stockConcentrationMgMl Float?
  finalConcentrationMgMl Float?
  minInfusionTimeMin     Int?
  compatibilityDiluent   String?
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt

  drug Drug @relation(fields: [drugId], references: [id])
}

model PrescribedItem {
  id             String     @id @default(uuid())
  prescriptionId String
  drugId         String
  dosageValue    Float
  dosageUnit     DosageUnit
  frequency      String // e.g., "Once a day", "Every 4 hours"
  duration       String // e.g., "7 days", "Until finished"
  instructions   String?    @db.Text
  drugRoute      DrugRoute?

  // Relations
  prescription Prescription @relation(fields: [prescriptionId], references: [id], onDelete: Cascade)
  drug         Drug         @relation(fields: [drugId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("prescribed_items")
}

model File {
  id        String   @id @default(uuid())
  key       String
  fileName  String   @map("file_name")
  url       String
  createdAt DateTime @default(now()) @map("created_at")

  @@map("files")
}

enum UserRole {
  ADMIN
  STAFF
  DOCTOR
  PATIENT
}

enum Status {
  ACTIVE
  INACTIVE
  DORMANT
}

enum JOBTYPE {
  FULL
  PART
}

enum Gender {
  MALE
  FEMALE
}

enum AppointmentStatus {
  PENDING
  SCHEDULED
  CANCELLED
  COMPLETED
  NO_SHOW
}

enum PaymentMethod {
  CASH
  CARD
  MOBILE
}

enum PaymentStatus {
  PAID
  UNPAID
  PARTIAL
  REFUNDED
}

enum ServiceCategory {
  CONSULTATION
  LAB_TEST
  VACCINATION
  PROCEDURE
  PHARMACY
  DIAGNOSIS
  OTHER
}

enum MeasurementType {
  WFA
  HFA
  HcFA
}

enum ReminderMethod {
  EMAIL
  SMS
}

enum ReminderStatus {
  SENT
  FAILED
  PENDING
}

enum NotificationType {
  APPOINTMENT_REMINDER
  BILLING
  GENERAL
  SECURITY
}

enum FeedingType {
  BREAST
  FORMULA
  MIXED
}

enum DevelopmentStatus {
  NORMAL
  DELAYED
  ADVANCED
  CONCERNING
}

enum ImmunizationStatus {
  COMPLETED
  PENDING
  DELAYED
  EXEMPTED
}

enum DosageUnit {
  MG
  ML
  TABLET
  MCG
  G
  IU
  DROP
  SPRAY
  PUFF
  UNIT
}

enum DrugRoute {
  IV
  PO
  IM
  SC
  TOPICAL
  INHALED
  RECTAL
  SUBLINGUAL
  BUCCAL
  TRANSDERMAL
}

// =======================
// Enums
// =======================

model Guardian {
  id        String  @id @default(uuid())
  patientId String
  userId    String
  relation  String // Mother, Father, Grandmother
  isPrimary Boolean @default(false)
  phone     String?
  email     String?

  patient Patient @relation(fields: [patientId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([patientId])
  @@index([userId])
}

enum LabStatus {
  PENDING
  COMPLETED
  REVIEWED
  CANCELLED
}

// =======================
// Patient
// =======================

model Patient {
  id                     String    @id @default(uuid())
  clinicId               String
  userId                 String    @unique
  email                  String?   @unique @db.VarChar(255)
  phone                  String?   @db.Text
  emergencyContactNumber String?   @db.Text
  firstName              String
  lastName               String
  dateOfBirth            DateTime
  gender                 Gender    @default(MALE)
  maritalStatus          String?
  nutritionalStatus      String?
  address                String?
  emergencyContactName   String?   @db.Text
  relation               String?
  allergies              String?   @db.Text
  medicalConditions      String?   @db.Text
  medicalHistory         String?   @db.Text
  image                  String?   @db.Text
  colorCode              String?
  role                   UserRole?
  status                 Status?   @default(ACTIVE)
  isActive               Boolean?  @default(true)
  deletedAt              DateTime?
  isDeleted              Boolean?  @default(false)
  createdById            String?
  updatedById            String?
  bloodGroup             String?   @db.Text
  createdAt              DateTime  @default(now())
  updatedAt              DateTime  @updatedAt

  // Relations
  clinic    Clinic @relation(fields: [clinicId], references: [id], onDelete: Cascade)
  user      User   @relation("PatientUser", fields: [userId], references: [id], onDelete: Cascade)
  createdBy User?  @relation("PatientCreatedBy", fields: [createdById], references: [id])

  appointments            Appointment[]
  medicalRecords          MedicalRecords[]
  encounters              Diagnosis[]
  immunizations           Immunization[]
  vitalSigns              VitalSigns[]
  feedingLogs             FeedingLog[]
  prescriptions           Prescription[]
  ratings                 Rating[]
  developmentalChecks     DevelopmentalCheck[]
  developmentalMilestones DevelopmentalMilestone[]
  growthRecords           GrowthRecord[]
  payments                Payment[]
  guardians               Guardian[]

  // Indexes
  @@index([clinicId, isActive, isDeleted, createdAt(sort: Desc)])
  @@index([dateOfBirth])
  @@index([clinicId, status])
  @@index([lastName, firstName])
  @@map("patients")
}

// =======================
// Appointment
// =======================
model Appointment {
  id               String             @id @default(uuid())
  patientId        String
  doctorId         String
  serviceId        String?
  doctorSpecialty  String?
  clinicId         String
  appointmentDate  DateTime
  time             String?
  appointmentPrice Decimal?           @map("appointment_price_in_cents") @db.Decimal(10, 2)
  status           AppointmentStatus? @default(PENDING)
  type             String
  note             String?
  reason           String?
  deletedAt        DateTime?
  isDeleted        Boolean?           @default(false)
  createdAt        DateTime           @default(now())
  updatedAt        DateTime           @updatedAt

  // Relations
  patient    Patient          @relation(fields: [patientId], references: [id], onDelete: Cascade)
  doctor     Doctor           @relation(fields: [doctorId], references: [id], onDelete: Cascade)
  clinic     Clinic           @relation(fields: [clinicId], references: [id], onDelete: Cascade)
  service    Service?         @relation(fields: [serviceId], references: [id])
  bills      Payment[]
  medical    MedicalRecords[]
  reminders  Reminder[]
  encounters Diagnosis[]

  // Indexes
  @@index([clinicId, appointmentDate, status])
  @@index([doctorId, appointmentDate, status])
  @@index([patientId, appointmentDate(sort: Desc)])
  @@index([isDeleted])
}

// =======================
// MedicalRecords
// =======================
model MedicalRecords {
  id            String    @id @default(uuid())
  patientId     String
  appointmentId String
  doctorId      String?
  clinicId      String
  diagnosis     String?
  symptoms      String?
  treatmentPlan String?
  labRequest    String?
  notes         String?
  attachments   String?
  followUpDate  DateTime?
  deletedAt     DateTime?
  isDeleted     Boolean?  @default(false)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relations
  patient       Patient?       @relation(fields: [patientId], references: [id], onDelete: Cascade)
  appointment   Appointment    @relation(fields: [appointmentId], references: [id], onDelete: Cascade)
  doctor        Doctor?        @relation(fields: [doctorId], references: [id], onDelete: SetNull)
  clinic        Clinic         @relation(fields: [clinicId], references: [id], onDelete: Cascade)
  labTest       LabTest[]
  immunizations Immunization[]
  prescriptions Prescription[]
  vitalSigns    VitalSigns[]
  encounter     Diagnosis[]

  @@unique([patientId, appointmentId])
  @@index([clinicId, followUpDate])
  @@index([patientId, createdAt(sort: Desc)])
  @@index([doctorId])
  @@index([isDeleted])
}

// =======================
// Diagnosis
// =======================
model Diagnosis {
  id                    String    @id @default(uuid())
  patientId             String
  doctorId              String
  clinicId              String?
  appointmentId         String?
  medicalId             String    @unique
  date                  DateTime  @default(now())
  type                  String?
  diagnosis             String?
  treatment             String?
  notes                 String?
  symptoms              String
  prescribedMedications String?
  followUpPlan          String?
  deletedAt             DateTime?
  isDeleted             Boolean?  @default(false)
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  // Relations
  patient       Patient        @relation(fields: [patientId], references: [id], onDelete: Cascade)
  doctor        Doctor         @relation(fields: [doctorId], references: [id], onDelete: Cascade)
  clinic        Clinic?        @relation(fields: [clinicId], references: [id])
  appointment   Appointment?   @relation(fields: [appointmentId], references: [id])
  medical       MedicalRecords @relation(fields: [medicalId], references: [id], onDelete: Cascade)
  vitalSigns    VitalSigns[]
  prescriptions Prescription[]

  @@index([clinicId, date])
  @@index([doctorId, date])
  @@index([patientId, date])
  @@index([isDeleted])
}

// =======================
// VitalSigns
// =======================
model VitalSigns {
  id               String   @id @default(uuid())
  patientId        String
  medicalId        String   @unique
  encounterId      String?  @unique
  growthRecordId   String?
  recordedAt       DateTime @default(now())
  bodyTemperature  Float?
  systolic         Int?
  diastolic        Int?
  heartRate        Int?
  respiratoryRate  Int?
  oxygenSaturation Int?
  gender           Gender?
  notes            String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  // Relations
  patient      Patient        @relation(fields: [patientId], references: [id], onDelete: Cascade)
  medical      MedicalRecords @relation(fields: [medicalId], references: [id], onDelete: Cascade)
  encounter    Diagnosis?     @relation(fields: [encounterId], references: [id], onDelete: Cascade)
  growthRecord GrowthRecord?  @relation(fields: [growthRecordId], references: [id], onDelete: SetNull)

  @@index([patientId, recordedAt])
  @@index([encounterId])
}

// =======================
// GrowthRecord
// =======================
model GrowthRecord {
  id                String   @id @default(uuid())
  patientId         String
  gender            Gender?
  ageDays           Int?
  ageMonths         Int?
  headCircumference Decimal? @db.Decimal(5, 2)
  bmi               Decimal? @db.Decimal(5, 2)
  weightForAgeZ     Decimal? @db.Decimal(4, 3)
  heightForAgeZ     Decimal? @db.Decimal(4, 3)
  bmiForAgeZ        Decimal? @db.Decimal(4, 3)
  hcForAgeZ         Decimal? @db.Decimal(4, 3)
  weight            Float?
  height            Float?
  notes             String?
  date              DateTime
  recordedAt        DateTime @default(now())
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  patient    Patient      @relation(fields: [patientId], references: [id], onDelete: Cascade)
  vitalSigns VitalSigns[]

  @@index([patientId, date])
}

// =======================
// Immunization
// =======================
model Immunization {
  id                    String    @id @default(uuid())
  patientId             String
  vaccine               String
  date                  DateTime
  dose                  String?
  lotNumber             String?
  administeredByStaffId String?
  notes                 String?
  createdAt             DateTime  @default(now())
  deletedAt             DateTime?
  isDeleted             Boolean?  @default(false)

  patient        Patient          @relation(fields: [patientId], references: [id], onDelete: Cascade)
  administeredBy Staff?           @relation("AdministeredByStaff", fields: [administeredByStaffId], references: [id])
  medicalRecords MedicalRecords[]

  @@index([patientId, vaccine, date])
  @@index([patientId, date])
}

// =======================
// LabTest
// =======================
model LabTest {
  id        String    @id @default(uuid())
  recordId  String
  serviceId String
  testDate  DateTime
  result    String
  status    LabStatus
  notes     String?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  medicalRecord MedicalRecords @relation(fields: [recordId], references: [id], onDelete: Cascade)
  service       Service        @relation(fields: [serviceId], references: [id])

  @@index([serviceId])
  @@index([recordId])
}

model FeedingLog {
  id        String      @id @default(uuid())
  patientId String
  patient   Patient     @relation(fields: [patientId], references: [id], onDelete: Cascade)
  date      DateTime    @default(now())
  type      FeedingType // Breast, Formula, Mixed
  duration  Int? // in minutes
  amount    Float? // in ml for formula
  breast    String? // Left, Right, Both
  notes     String?

  @@index([patientId, date])
}

model DevelopmentalMilestone {
  id           Int      @id @default(autoincrement())
  patientId    String
  milestone    String
  ageAchieved  String
  dateRecorded DateTime
  notes        String?
  createdBy    String?
  updatedBy    String?

  patient Patient @relation(fields: [patientId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model DevelopmentalCheck {
  id                Int               @id @default(autoincrement())
  patientId         String
  checkDate         DateTime
  ageMonths         Int
  motorSkills       DevelopmentStatus
  languageSkills    DevelopmentStatus
  socialSkills      DevelopmentStatus
  cognitiveSkills   DevelopmentStatus
  milestonesMet     String?
  milestonesPending String?
  concerns          String?
  recommendations   String?
  patient           Patient           @relation(fields: [patientId], references: [id], onDelete: Cascade)
  createdAt         DateTime          @default(now()) @map("createdAt")
  updatedAt         DateTime          @updatedAt @map("updatedAt")

  @@index([patientId, checkDate])
  @@index([ageMonths])
  @@map("developmental_check")
}

model VaccineSchedule {
  id              Int      @id @default(autoincrement())
  vaccineName     String   @map("vaccine_name")
  recommendedAge  String // e.g., "2 months", "4-6 years" @map("recommended_age")
  dosesRequired   Int      @map("doses_required")
  minimumInterval Int? // minimum days between doses @map("minimum_interval")
  isMandatory     Boolean  @default(true) @map("is_mandatory")
  description     String?
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  ageInDaysMin    Int?
  ageInDaysMax    Int?

  @@unique([vaccineName, recommendedAge])
  @@index([ageInDaysMin, ageInDaysMax])
  @@map("vaccine_schedule")
}

// =========== DASHBOARD VIEWS ===========

// view ClinicDashboardMV {
//   clinicId   String
//   clinicName String

//   // Appointment stats
//   totalAppointments     Int
//   todayAppointments     Int
//   upcomingAppointments  Int
//   completedAppointments Int

//   // Patient stats
//   totalPatients        Int
//   activePatients       Int
//   newPatientsThisMonth Int

//   // Financial stats
//   monthlyRevenue  Float
//   pendingPayments Float
//   totalRevenue    Float

//   // Doctor stats
//   activeDoctors       Int
//   averageDoctorRating Float

//   // Pediatric-specific stats
//   immunizationsDue    Int
//   growthChecksPending Int

//   // Staff stats
//   totalStaff Int

//   updatedAt DateTime
// }

// // =========== PATIENT OVERVIEW VIEW ===========

// view PatientOverviewMV {
//   patientId           String
//   patientPublicId     String
//   fullName            String
//   dateOfBirth         DateTime?
//   ageMonths           Int?
//   gender              String?
//   bloodGroup          String?
//   medicalRecordNumber String

//   // Contact info
//   phone   String?
//   email   String?
//   address String?

//   // Medical info
//   allergies            String?
//   medicalConditions    String?
//   primaryCarePhysician String?

//   // Appointment stats
//   totalAppointments    Int
//   lastAppointmentDate  DateTime?
//   upcomingAppointments Int

//   // Medical stats
//   totalDiagnosis      Int
//   totalPrescriptions  Int
//   activePrescriptions Int

//   // Immunization stats
//   totalImmunizations   Int
//   pendingImmunizations Int

//   // Growth stats
//   lastWeight      Float?
//   lastHeight      Float?
//   lastGrowthCheck DateTime?

//   // Guardian info
//   primaryGuardian String?
//   guardianPhone   String?

//   clinicId  String
//   updatedAt DateTime
// }

// // =========== DOCTOR PERFORMANCE VIEW ===========

// view DoctorPerformanceMV {
//   doctorId          String
//   doctorPublicId    String
//   name              String
//   specialty         String?
//   email             String?
//   phone             String?
//   rating            Float?
//   yearsOfExperience Int?

//   // Appointment stats
//   totalAppointments     Int
//   appointmentsThisMonth Int
//   completedAppointments Int
//   cancellationRate      Float

//   // Patient stats
//   totalPatients        Int
//   newPatientsThisMonth Int

//   // Revenue stats
//   totalRevenue   Float
//   monthlyRevenue Float

//   // Prescription stats
//   totalPrescriptions  Int
//   activePrescriptions Int

//   // Rating stats
//   averagePatientRating Float
//   totalRatings         Int

//   // Schedule stats
//   averagePatientsPerDay Float
//   utilizationRate       Float

//   clinicId  String
//   updatedAt DateTime
// }

// // =========== FINANCIAL OVERVIEW VIEW ===========

// view FinancialOverviewMV {
//   clinicId   String
//   clinicName String

//   // Revenue by month
//   currentMonthRevenue  Float
//   previousMonthRevenue Float

//   // Revenue by category
//   consultationRevenue Float
//   procedureRevenue    Float
//   labRevenue          Float
//   vaccinationRevenue  Float

//   // Payment status
//   totalRevenue  Float
//   paidAmount    Float
//   pendingAmount Float

//   // Expense breakdown
//   totalExpenses         Float
//   payrollExpenses       Float
//   medicalSupplyExpenses Float
//   facilityExpenses      Float

//   // Net profit
//   netProfit    Float
//   profitMargin Float

//   // Top revenue sources
//   topService String?
//   topDoctor  String?

//   updatedAt DateTime
// }

// // =========== APPOINTMENT SCHEDULE VIEW ===========

// view AppointmentScheduleMV {
//   appointmentId       String
//   appointmentPublicId String
//   date                DateTime
//   startTime           String?
//   durationMinutes     Int?
//   status              String
//   type                String?
//   reason              String?

//   // Patient info
//   patientId        String
//   patientPublicId  String
//   patientName      String
//   patientAgeMonths Int?
//   patientGender    String?
//   patientPhone     String?

//   // Doctor info
//   doctorId        String
//   doctorPublicId  String
//   doctorName      String
//   doctorSpecialty String?
//   doctorColorCode String?

//   // Service info
//   serviceId       String?
//   serviceName     String?
//   serviceCategory String?
//   servicePrice    Float?

//   // Billing info
//   paymentStatus String?
//   totalAmount   Float?
//   amountPaid    Float?

//   clinicId  String
//   updatedAt DateTime
// }

// // =========== PATIENT GROWTH CHART VIEW ===========

// view PatientGrowthChartMV {
//   patientId       String
//   patientPublicId String
//   fullName        String
//   gender          String?
//   dateOfBirth     DateTime?

//   // Growth records
//   ageDays   Int?
//   ageMonths Int?

//   // Measurements
//   weight            Float?
//   height            Float?
//   headCircumference Float?
//   bmi               Float?

//   // WHO Percentiles
//   weightForAgeZ Float?
//   heightForAgeZ Float?
//   hcForAgeZ     Float?

//   // WHO Percentile classifications
//   weightPercentile String?
//   heightPercentile String?
//   growthStatus     String?
//   recordedBy       String?
//   notes            String?
//   recordedAt       DateTime
//   clinicId         String
//   updatedAt        DateTime
// }

// // =========== IMMUNIZATION SCHEDULE VIEW ===========

// view ImmunizationScheduleMV {
//   patientId       String
//   patientPublicId String
//   fullName        String
//   dateOfBirth     DateTime?
//   ageMonths       Int?

//   // Immunization info
//   immunizationId     String
//   vaccineName        String
//   doseNumber         Int?
//   totalDoses         Int?
//   administrationDate DateTime?
//   nextDueDate        DateTime?
//   status             String

//   // Schedule info
//   recommendedAgeDays Int?
//   isMandatory        Boolean?
//   description        String?

//   // Timing
//   daysOverdue  Int?
//   daysUntilDue Int?
//   isOverdue    Boolean

//   // Admin info
//   administeringDoctor String?
//   manufacturer        String?
//   batchNumber         String?
//   notes               String?

//   clinicId  String
//   updatedAt DateTime
// }

// // =========== MEDICAL RECORDS VIEW ===========

// view MedicalRecordsMV {
//   medicalRecordId       String
//   medicalRecordPublicId String

//   // Patient info
//   patientId             String
//   patientPublicId       String
//   patientName           String
//   patientAgeAtDiagnosis Int?

//   // Doctor info
//   doctorId        String
//   doctorPublicId  String
//   doctorName      String
//   doctorSpecialty String?

//   // Diagnosis info
//   encounterId   String?
//   encounterDate DateTime?
//   encounterType String?
//   diagnosis     String?
//   treatment     String?

//   // Appointment info
//   appointmentId     String?
//   appointmentDate   DateTime?
//   appointmentReason String?

//   // SOAP Notes
//   subjective String?
//   objective  String?
//   assessment String?
//   plan       String?

//   // Medical data
//   symptoms       String?
//   medications    String?
//   followUpDate   DateTime?
//   isConfidential Boolean?

//   // Vital signs at time of encounter
//   temperature      Float?
//   heartRate        Int?
//   systolic         Int?
//   diastolic        Int?
//   respiratoryRate  Int?
//   oxygenSaturation Float?
//   weight           Float?
//   height           Float?

//   // Prescriptions from this encounter
//   prescriptionCount Int

//   // Lab tests from this encounter
//   labTestCount Int

//   clinicId  String
//   updatedAt DateTime
// }

// // =========== NOTIFICATIONS VIEW ===========

// view NotificationsMV {
//   notificationId       String
//   notificationPublicId String

//   // User info
//   userId String

//   // Notification content
//   type    String
//   title   String
//   message String
//   data    Json?

//   // Status
//   isRead    Boolean
//   priority  String?
//   actionUrl String?

//   // Timing
//   createdAt DateTime
//   expiresAt DateTime?

//   // Clinic context
//   clinicId   String?
//   clinicName String?

//   // Notification metadata
//   daysSinceCreated Int?
//   isExpired        Boolean

//   // Related entity info
//   relatedPatientId     String?
//   relatedAppointmentId String?
//   relatedDoctorId      String?

//   updatedAt DateTime
// }

// // =========== EXPENSE ANALYSIS VIEW ===========

// view ExpenseAnalysisMV {
//   clinicId   String
//   clinicName String

//   // Expense by category
//   expenseCategoryId    String
//   expenseCategoryName  String
//   expenseCategoryColor String?

//   // Expense by subcategory
//   expenseSubcategoryId    String
//   expenseSubcategoryName  String
//   expenseSubcategoryColor String?

//   // Expense details
//   expenseId       String
//   expensePublicId String
//   amount          Float
//   date            DateTime
//   description     String?

//   // Time analysis
//   year      Int
//   month     Int
//   monthName String
//   quarter   Int

//   // Trend analysis
//   monthlyAverage     Float?
//   categoryPercentage Float?

//   // Comparison metrics
//   previousMonthAmount  Float?
//   monthOverMonthChange Float?

//   updatedAt DateTime
// }

// model Expense {
//   id            String @id @default(cuid())
//   clinicId      String @map("ex_clinic_id")
//   subCategoryId String @map("ex_subcat_id") // Corrected field name

//   amount      Decimal  @db.Decimal(12, 2)
//   date        DateTime @db.Timestamptz(6)
//   description String?

//   createdAt DateTime @default(now())
//   updatedAt DateTime @updatedAt

//   // Relationships
//   clinic      Clinic             @relation(fields: [clinicId], references: [id], onDelete: Cascade)
//   subCategory ExpenseSubCategory @relation(fields: [subCategoryId], references: [id])

//   @@index([clinicId, date(sort: Desc)], name: "ex_clinic_date_idx")
//   @@index([subCategoryId, date], name: "ex_cat_date_idx")
//   @@map("expense")
// }

// model ExpenseCategory {
//   id            String               @id @default(cuid())
//   name          String
//   color         String?
//   subCategories ExpenseSubCategory[]
// }

// model ExpenseSubCategory {
//   id         String          @id @default(cuid())
//   name       String
//   color      String?
//   categoryId String
//   category   ExpenseCategory @relation(fields: [categoryId], references: [id])
//   expenses   Expense[]
// }

enum SavedFilterType {
  medical_records
  patients
  appointments
  lab_tests
}

model UserSavedFilter {
  id         String           @id @default(cuid())
  userId     String
  clinicId   String
  name       String
  filters    Json             @db.JsonB
  filterType SavedFilterType? // <— add this
  isPublic   Boolean?         @default(false)
  usageCount Int?             @default(0)
  createdAt  DateTime         @default(now())
  updatedAt  DateTime         @updatedAt

  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  clinic Clinic @relation(fields: [clinicId], references: [id], onDelete: Cascade)

  @@index([userId, clinicId], name: "user_saved_filters_user_clinic_idx")
  @@index([isPublic], name: "user_saved_filters_public_idx")
  @@index([filterType], name: "user_saved_filters_type_idx")
  @@map("user_saved_filters")
}
