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

generator server {
  provider          = "prisma-generator-typescript-interfaces"
  output            = "../src/types/prisma.ts"
  modelType         = "type" // Better for tRPC inference
  enumType          = "object" // Matches Prisma Client behavior
  relations         = "optional" // Flexible querying
  counts            = "optional" // Include when needed
  dateType          = "Date" // JSON-safe dates
  jsonType          = "Record<string, unknown>"
  bigIntType        = "string" // JSON-safe BigInt
  decimalType       = "Decimal" // JSON-safe Decimal
  bytesType         = "Buffer"
  optionalNullables = true // Cleaner types
  optionalDefaults  = true // Less verbose
  includeComments   = true // Preserve schema docs
  // Export control
  exportEnums       = true
}

model Feature {
  id          String  @id @default(uuid())
  clinicId    String
  clinic      Clinic  @relation(fields: [clinicId], references: [id])
  title       String
  description String?
  icon        String?
  color       String?
  order       Int?
  isActive    Boolean @default(true)
}

/**
 * files
 */
model File {
  id         String   @id
  slug       String   @unique
  userId     String   @map("user_id")
  folderId   String?  @map("folder_id")
  filename   String
  searchText String   @default("") @map("search_text")
  size       Int
  mimeType   String   @map("mime_type")
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  user   User    @relation(fields: [userId], references: [id])
  folder Folder? @relation(fields: [folderId], references: [id])

  @@index([slug], name: "idx_files_slug")
  @@index([searchText], name: "idx_files_search_text")
  @@index([folderId], name: "idx_files_folder_id")
  @@map("files")
}

/**
 * folders
 */
model Folder {
  id        String   @id
  userId    String   @map("user_id")
  name      String
  parentId  String?  @map("parent_id")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  user       User     @relation(fields: [userId], references: [id])
  parent     Folder?  @relation("subfolders", fields: [parentId], references: [id])
  subfolders Folder[] @relation("subfolders")
  files      File[]

  @@index([userId], name: "idx_folders_user_id")
  @@index([parentId], name: "idx_folders_parent_id")
  @@map("folders")
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
  id               String    @id @default(cuid())
  name             String    @db.VarChar(255)
  email            String    @unique @db.VarChar(255)
  image            String?   @db.VarChar(512)
  emailVerified    Boolean   @default(false)
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @default(now()) @updatedAt
  role             String?
  banned           Boolean?  @default(false)
  banReason        String?
  banExpires       DateTime?
  twoFactorEnabled Boolean?  @default(false)
  deletedAt        DateTime?
  isDeleted        Boolean?  @default(false)
  timezone         String?   @default("UTC")
  language         String?   @default("en")
  // Admin and security fields
  isAdmin          Boolean?  @default(false)
  phone            String?
  // Relations\
  apiKey           String?   @unique @map("api_key")

  sessions         Session[]
  accounts         Account[]
  usersToClinics   ClinicMember[]
  patients         Patient[]         @relation("PatientUser")
  doctors          Doctor[]
  staffs           Staff[]
  notifications    Notification[]
  userSavedFilters UserSavedFilter[]
  auditLogs        AuditLog[]
  createdPatients  Patient[]         @relation("PatientCreatedBy")
  guardians        Guardian[]
  // relations
  files            File[]
  folders          Folder[]
  clinics          Clinic[]          @relation("ClinicUsers") // conceptual; actual m‑n via ClinicMember

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
  clinic     Clinic?  @relation(fields: [clinicId], references: [id])

  clinicId  String?
  updatedAt DateTime @updatedAt @map("updated_at")

  @@index([userId])
  @@index([clinicId])
  @@index([createdAt])
  @@map("audit_logs")
}

model SystemSettings {
  id                   String    @id @default("system") // Singleton: only one row exists
  clinicId             String?
  clinic               Clinic?   @relation(fields: [clinicId], references: [id])
  theme                String    @default("default") // Active theme name (default, bubblegum, ocean, forest)
  maintenanceMode      Boolean   @default(false)
  maintenanceMessage   String?
  maintenanceStartedAt DateTime?
  maintenanceEndTime   DateTime? // Optional scheduled end time
  updatedAt            DateTime  @updatedAt
  updatedBy            String? // User ID who last updated the settings

  @@index([clinicId])
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
  doctors        Doctor[]
  patients       Patient[]
  appointments   Appointment[]
  medicalRecords MedicalRecords[]

  clinicSettings   ClinicSetting[]
  prescriptions    Prescription[]
  payments         Payment[]
  encounters       Diagnosis[]
  services         Service[]
  // expenses         Expense[]
  userSavedFilters UserSavedFilter[]
  auditLogs        AuditLog[]
  staffs           Staff[]
  expenses         Expense[]
  workingDays      WorkingDays[]
  features         Feature[]
  systemSettings   SystemSettings[]
  users            User[]            @relation("ClinicUsers")
  clinicMembers    ClinicMember[]

  @@index([isDeleted])
  @@map("clinics")
}

model ClinicMember {
  userId    String    @map("user_id")
  clinicId  String    @map("clinic_id")
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @default(now()) @updatedAt @map("updated_at")
  role      UserRole?

  user   User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  clinic Clinic? @relation(fields: [clinicId], references: [id], onDelete: Cascade)

  @@id([userId, clinicId])
  @@map("users_to_clinics")
}

model Doctor {
  id                   String              @id @default(uuid())
  email                String?             @db.VarChar(255)
  name                 String
  userId               String?             @unique
  clinicId             String?             @map("clinic_id")
  specialty            String              @db.Text
  licenseNumber        String?
  phone                String?             @db.Text
  address              String?
  department           String?
  img                  String?
  colorCode            String?
  availabilityStatus   AvailabilityStatus?
  availableFromWeekDay Int?                @map("available_from_week_day")
  availableToWeekDay   Int?                @map("available_to_week_day")
  isActive             Boolean?
  status               Status?
  availableFromTime    String?             @map("available_from_time")
  availableToTime      String?             @map("available_to_time")
  type                 JOBTYPE             @default(FULL)
  createdAt            DateTime            @default(now())
  updatedAt            DateTime            @updatedAt
  appointmentPrice     Decimal             @map("appointment_price") @db.Decimal(10, 2)
  role                 UserRole?
  deletedAt            DateTime?
  isDeleted            Boolean?            @default(false)

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
  id       Int    @id @default(autoincrement())
  doctorId String
  clinicId String

  day       String
  startTime String
  endTime   String

  doctor Doctor @relation(fields: [doctorId], references: [id], onDelete: Cascade)

  clinic    Clinic   @relation(fields: [clinicId], references: [id], onDelete: Cascade)
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
  status       Status?          @default(ACTIVE)
  clinic       Clinic?          @relation(fields: [clinicId], references: [id])
  icon         String?
  color        String?
  appointments Appointment[] // A service can be part of many appointments

  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?
  isDeleted Boolean?  @default(false)

  @@unique([id, clinicId], name: "service_clinic")
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
  lValue          Float?          @map("l_value") @db.DoublePrecision
  mValue          Float?          @map("m_value") @db.DoublePrecision
  sValue          Float?          @map("s_value") @db.DoublePrecision
  sd0             Float?          @map("sd0") @db.DoublePrecision
  sd1neg          Float?          @map("sd1neg") @db.DoublePrecision
  sd1pos          Float?          @map("sd1pos") @db.DoublePrecision
  sd2neg          Float?          @map("sd2neg") @db.DoublePrecision
  sd2pos          Float?          @map("sd2pos") @db.DoublePrecision
  sd3neg          Float?          @map("sd3neg") @db.DoublePrecision
  sd3pos          Float?          @map("sd3pos") @db.DoublePrecision
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

enum UserRole {
  ADMIN
  STAFF
  DOCTOR
  PATIENT
}

enum EncounterType {
  CONSULTATION
  VACCINATION
  SCREENING
  FOLLOW_UP
  NUTRITION
  NEWBORN
  LACTATION
  OTHER
}

enum EncounterStatus {
  PENDING
  COMPLETED
  CANCELLED
}

enum AvailabilityStatus {
  AVAILABLE
  UNAVAILABLE
}

enum GrowthStatus {
  NORMAL
  OBESE
  OVERWEIGHT
  UNDERWEIGHT
  STUNTED
}

enum AppointmentType {
  CONSULTATION
  VACCINATION
  PROCEDURE
  EMERGENCY
  CHECKUP
  FOLLOW_UP
  FEEDING_SESSION
  OTHER
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
  type             AppointmentType
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
  growthRecords GrowthRecord[]

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
  id                    String           @id @default(uuid())
  patientId             String
  doctorId              String
  clinicId              String?
  appointmentId         String?
  medicalId             String           @unique
  date                  DateTime         @default(now())
  type                  String?
  diagnosis             String?
  treatment             String?
  notes                 String?
  symptoms              String
  prescribedMedications String?
  followUpPlan          String?
  deletedAt             DateTime?
  isDeleted             Boolean?         @default(false)
  createdAt             DateTime         @default(now())
  updatedAt             DateTime         @updatedAt
  status                EncounterStatus? @default(PENDING)
  typeOfEncounter       EncounterType?   @default(CONSULTATION)
  // Relations
  patient               Patient          @relation(fields: [patientId], references: [id], onDelete: Cascade)
  doctor                Doctor           @relation(fields: [doctorId], references: [id], onDelete: Cascade)
  clinic                Clinic?          @relation(fields: [clinicId], references: [id])
  appointment           Appointment?     @relation(fields: [appointmentId], references: [id])
  medical               MedicalRecords   @relation(fields: [medicalId], references: [id], onDelete: Cascade)
  vitalSigns            VitalSigns[]
  prescriptions         Prescription[]

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
  ageDays          Int?
  ageMonths        Int?

  // Relations
  patient       Patient        @relation(fields: [patientId], references: [id], onDelete: Cascade)
  medical       MedicalRecords @relation(fields: [medicalId], references: [id], onDelete: Cascade)
  encounter     Diagnosis?     @relation(fields: [encounterId], references: [id], onDelete: Cascade)
  growthRecords GrowthRecord[]

  @@index([patientId, recordedAt])
  @@index([encounterId])
}

// =======================
// GrowthRecord
// =======================
model GrowthRecord {
  id                String    @id @default(uuid())
  patientId         String
  gender            Gender?
  medicalId         String?   @unique
  vitalSignsId      String?   @unique
  ageDays           Int?
  ageMonths         Int?
  headCircumference Decimal?  @db.Decimal(5, 2)
  bmi               Decimal?  @db.Decimal(5, 2)
  weightForAgeZ     Decimal?  @db.Decimal(4, 3)
  heightForAgeZ     Decimal?  @db.Decimal(4, 3)
  bmiForAgeZ        Decimal?  @db.Decimal(4, 3)
  hcForAgeZ         Decimal?  @db.Decimal(4, 3)
  weight            Float?
  height            Float?
  notes             String?
  date              DateTime
  recordedAt        DateTime? @default(now())
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  classification    String?

  patient    Patient         @relation(fields: [patientId], references: [id], onDelete: Cascade)
  vitalSigns VitalSigns?     @relation(fields: [vitalSignsId], references: [id])
  medical    MedicalRecords? @relation(fields: [medicalId], references: [id])

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

view ClinicDashboardMV {
  clinicId   String
  clinicName String

  // Appointment stats
  totalAppointments     Int
  todayAppointments     Int
  upcomingAppointments  Int
  completedAppointments Int

  // Patient stats
  totalPatients        Int
  activePatients       Int
  newPatientsThisMonth Int

  // Financial stats
  monthlyRevenue  Float
  pendingPayments Float
  totalRevenue    Float

  // Doctor stats
  activeDoctors       Int
  averageDoctorRating Float

  // Pediatric-specific stats
  immunizationsDue    Int
  growthChecksPending Int

  // Staff stats
  totalStaff Int

  updatedAt DateTime
}

// =========== PATIENT OVERVIEW VIEW ===========

view PatientOverviewMV {
  patientId           String
  patientPublicId     String
  fullName            String
  dateOfBirth         DateTime?
  ageMonths           Int?
  gender              String?
  bloodGroup          String?
  medicalRecordNumber String

  // Contact info
  phone   String?
  email   String?
  address String?

  // Medical info
  allergies            String?
  medicalConditions    String?
  primaryCarePhysician String?

  // Appointment stats
  totalAppointments    Int
  lastAppointmentDate  DateTime?
  upcomingAppointments Int

  // Medical stats
  totalDiagnosis      Int
  totalPrescriptions  Int
  activePrescriptions Int

  // Immunization stats
  totalImmunizations   Int
  pendingImmunizations Int

  // Growth stats
  lastWeight      Float?
  lastHeight      Float?
  lastGrowthCheck DateTime?

  // Guardian info
  primaryGuardian String?
  guardianPhone   String?

  clinicId  String
  updatedAt DateTime
}

// =========== DOCTOR PERFORMANCE VIEW ===========

view DoctorPerformanceMV {
  doctorId          String
  doctorPublicId    String
  name              String
  specialty         String?
  email             String?
  phone             String?
  rating            Float?
  yearsOfExperience Int?

  // Appointment stats
  totalAppointments     Int
  appointmentsThisMonth Int
  completedAppointments Int
  cancellationRate      Float

  // Patient stats
  totalPatients        Int
  newPatientsThisMonth Int

  // Revenue stats
  totalRevenue   Float
  monthlyRevenue Float

  // Prescription stats
  totalPrescriptions  Int
  activePrescriptions Int

  // Rating stats
  averagePatientRating Float
  totalRatings         Int

  // Schedule stats
  averagePatientsPerDay Float
  utilizationRate       Float

  clinicId  String
  updatedAt DateTime
}

// =========== FINANCIAL OVERVIEW VIEW ===========

view FinancialOverviewMV {
  clinicId   String
  clinicName String

  // Revenue by month
  currentMonthRevenue  Float
  previousMonthRevenue Float

  // Revenue by category
  consultationRevenue Float
  procedureRevenue    Float
  labRevenue          Float
  vaccinationRevenue  Float

  // Payment status
  totalRevenue  Float
  paidAmount    Float
  pendingAmount Float

  // Expense breakdown
  totalExpenses         Float
  payrollExpenses       Float
  medicalSupplyExpenses Float
  facilityExpenses      Float

  // Net profit
  netProfit    Float
  profitMargin Float

  // Top revenue sources
  topService String?
  topDoctor  String?

  updatedAt DateTime
}

// =========== APPOINTMENT SCHEDULE VIEW ===========

view AppointmentScheduleMV {
  appointmentId       String
  appointmentPublicId String
  date                DateTime
  startTime           String?
  durationMinutes     Int?
  status              String
  type                String?
  reason              String?

  // Patient info
  patientId        String
  patientPublicId  String
  patientName      String
  patientAgeMonths Int?
  patientGender    String?
  patientPhone     String?

  // Doctor info
  doctorId        String
  doctorPublicId  String
  doctorName      String
  doctorSpecialty String?
  doctorColorCode String?

  // Service info
  serviceId       String?
  serviceName     String?
  serviceCategory String?
  servicePrice    Float?

  // Billing info
  paymentStatus String?
  totalAmount   Float?
  amountPaid    Float?

  clinicId  String
  updatedAt DateTime
}

// =========== PATIENT GROWTH CHART VIEW ===========

view PatientGrowthChartMV {
  patientId       String
  patientPublicId String
  fullName        String
  gender          String?
  dateOfBirth     DateTime?

  // Growth records
  ageDays   Int?
  ageMonths Int?

  // Measurements
  weight            Float?
  height            Float?
  headCircumference Float?
  bmi               Float?

  // WHO Percentiles
  weightForAgeZ Float?
  heightForAgeZ Float?
  hcForAgeZ     Float?

  // WHO Percentile classifications
  weightPercentile String?
  heightPercentile String?
  growthStatus     String?
  recordedBy       String?
  notes            String?
  recordedAt       DateTime
  clinicId         String
  updatedAt        DateTime
}

// =========== IMMUNIZATION SCHEDULE VIEW ===========

view ImmunizationScheduleMV {
  patientId       String
  patientPublicId String
  fullName        String
  dateOfBirth     DateTime?
  ageMonths       Int?

  // Immunization info
  immunizationId     String
  vaccineName        String
  doseNumber         Int?
  totalDoses         Int?
  administrationDate DateTime?
  nextDueDate        DateTime?
  status             String

  // Schedule info
  recommendedAgeDays Int?
  isMandatory        Boolean?
  description        String?

  // Timing
  daysOverdue  Int?
  daysUntilDue Int?
  isOverdue    Boolean

  // Admin info
  administeringDoctor String?
  manufacturer        String?
  batchNumber         String?
  notes               String?

  clinicId  String
  updatedAt DateTime
}

// =========== MEDICAL RECORDS VIEW ===========

view MedicalRecordsMV {
  medicalRecordId       String
  medicalRecordPublicId String

  // Patient info
  patientId             String
  patientPublicId       String
  patientName           String
  patientAgeAtDiagnosis Int?

  // Doctor info
  doctorId        String
  doctorPublicId  String
  doctorName      String
  doctorSpecialty String?

  // Diagnosis info
  encounterId   String?
  encounterDate DateTime?
  encounterType String?
  diagnosis     String?
  treatment     String?

  // Appointment info
  appointmentId     String?
  appointmentDate   DateTime?
  appointmentReason String?

  // SOAP Notes
  subjective String?
  objective  String?
  assessment String?
  plan       String?

  // Medical data
  symptoms       String?
  medications    String?
  followUpDate   DateTime?
  isConfidential Boolean?

  // Vital signs at time of encounter
  temperature      Float?
  heartRate        Int?
  systolic         Int?
  diastolic        Int?
  respiratoryRate  Int?
  oxygenSaturation Float?
  weight           Float?
  height           Float?

  // Prescriptions from this encounter
  prescriptionCount Int

  // Lab tests from this encounter
  labTestCount Int

  clinicId  String
  updatedAt DateTime
}

// =========== NOTIFICATIONS VIEW ===========

view NotificationsMV {
  notificationId       String
  notificationPublicId String

  // User info
  userId String

  // Notification content
  type    String
  title   String
  message String
  data    Json?

  // Status
  isRead    Boolean
  priority  String?
  actionUrl String?

  // Timing
  createdAt DateTime
  expiresAt DateTime?

  // Clinic context
  clinicId   String?
  clinicName String?

  // Notification metadata
  daysSinceCreated Int?
  isExpired        Boolean

  // Related entity info
  relatedPatientId     String?
  relatedAppointmentId String?
  relatedDoctorId      String?

  updatedAt DateTime
}

// =========== EXPENSE ANALYSIS VIEW ===========

view ExpenseAnalysisMV {
  clinicId   String
  clinicName String

  // Expense by category
  expenseCategoryId    String
  expenseCategoryName  String
  expenseCategoryColor String?

  // Expense by subcategory
  expenseSubcategoryId    String
  expenseSubcategoryName  String
  expenseSubcategoryColor String?

  // Expense details
  expenseId       String
  expensePublicId String
  amount          Float
  date            DateTime
  description     String?

  // Time analysis
  year      Int
  month     Int
  monthName String
  quarter   Int

  // Trend analysis
  monthlyAverage     Float?
  categoryPercentage Float?

  // Comparison metrics
  previousMonthAmount  Float?
  monthOverMonthChange Float?

  updatedAt DateTime
}

model Expense {
  id            String @id @default(cuid())
  clinicId      String @map("ex_clinic_id")
  subCategoryId String @map("ex_subcat_id") // Corrected field name

  amount      Decimal  @db.Decimal(12, 2)
  date        DateTime @db.Timestamptz(6)
  description String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relationships
  clinic      Clinic             @relation(fields: [clinicId], references: [id], onDelete: Cascade)
  subCategory ExpenseSubCategory @relation(fields: [subCategoryId], references: [id])

  @@index([clinicId, date(sort: Desc)], name: "ex_clinic_date_idx")
  @@index([subCategoryId, date], name: "ex_cat_date_idx")
  @@map("expense")
}

model ExpenseCategory {
  id            String               @id @default(cuid())
  name          String
  color         String?
  subCategories ExpenseSubCategory[]
}

model ExpenseSubCategory {
  id         String          @id @default(cuid())
  name       String
  color      String?
  categoryId String
  category   ExpenseCategory @relation(fields: [categoryId], references: [id])
  expenses   Expense[]
}

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
