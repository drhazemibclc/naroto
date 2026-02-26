import { createAccessControl } from 'better-auth/plugins/access';

const statement = {
  patients: ['create', 'read', 'update', 'delete', 'list'],
  appointments: ['create', 'read', 'update', 'delete', 'list'],
  records: ['create', 'read', 'update', 'delete', 'list'],
  staff: ['create', 'read', 'update', 'delete', 'list'],
  payments: ['create', 'read', 'update', 'delete', 'list'],
  // Add system-level permissions
  system: ['backup', 'restore', 'configure'],
  reports: ['generate', 'export', 'view']
} as const;

const ac = createAccessControl(statement);

export const roles = {
  admin: ac.newRole({
    patients: ['create', 'read', 'update', 'delete', 'list'],
    appointments: ['create', 'read', 'update', 'delete', 'list'],
    records: ['create', 'read', 'update', 'delete', 'list'],
    staff: ['create', 'read', 'update', 'delete', 'list'],
    payments: ['create', 'read', 'update', 'delete', 'list'],
    system: ['backup', 'restore', 'configure'],
    reports: ['generate', 'export', 'view']
  }),
  doctor: ac.newRole({
    patients: ['create', 'read', 'update', 'list'],
    appointments: ['create', 'read', 'update', 'delete', 'list'],
    records: ['create', 'read', 'update', 'list'],
    payments: ['read', 'list'],
    reports: ['generate', 'view'],
    staff: []
  }),
  staff: ac.newRole({
    patients: ['create', 'read', 'update', 'list'],
    appointments: ['create', 'read', 'update', 'delete', 'list'],
    records: ['read', 'list'],
    staff: ['read'],
    payments: ['create', 'read', 'update', 'list'],
    reports: ['view']
  }),
  patient: ac.newRole({
    appointments: ['create', 'read'], // Book and view own appointments
    records: ['read'], // View own records only
    payments: ['read'], // View own payments
    patients: [], // No patient management
    staff: [],
    reports: []
  })
};

export type UserRoles = keyof typeof roles;
export type UserRole = 'ADMIN' | 'DOCTOR' | 'STAFF' | 'PATIENT';
export type Role = Uppercase<UserRoles>;
// Export for use in auth configuration
export { ac, statement };
