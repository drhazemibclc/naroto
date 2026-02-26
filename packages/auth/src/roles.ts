import { createAccessControl } from 'better-auth/plugins/access';
import { adminAc, defaultStatements, userAc } from 'better-auth/plugins/admin/access';

// 1. Define all possible actions for each resource
const statements = {
  ...defaultStatements,
  patients: ['create', 'read', 'update', 'delete', 'list'],
  appointments: ['create', 'read', 'update', 'delete', 'list'],
  records: ['create', 'read', 'update', 'delete', 'list'],
  staff: ['create', 'read', 'update', 'delete', 'list'],
  payments: ['create', 'read', 'update', 'delete', 'list'],
  immunization: ['create', 'read', 'update', 'delete'],
  prescription: ['create', 'read', 'update', 'delete'],
  growth: ['create', 'read', 'update', 'delete'],
  system: ['backup', 'restore', 'configure'],
  reports: ['generate', 'export', 'view']
} as const;

// 2. Create the AC instance using the defined statements
export const ac = createAccessControl(statements);

// 3. Define roles
export const roles = {
  admin: ac.newRole({
    ...statements, // Admin gets everything defined above
    ...adminAc.statements // Plus default admin perms (impersonate, ban, etc)
  }),
  doctor: ac.newRole({
    ...userAc.statements,
    patients: ['create', 'read', 'update', 'list'],
    appointments: ['create', 'read', 'update', 'delete', 'list'],
    records: ['create', 'read', 'update', 'list'],
    payments: ['read', 'list'],
    immunization: ['create', 'read', 'update'],
    prescription: ['create', 'read', 'update'],
    growth: ['create', 'read', 'update'],
    reports: ['generate', 'view'],
    // Empty arrays for resources with no access
    staff: [],
    system: []
  }),
  staff: ac.newRole({
    ...userAc.statements,
    patients: ['create', 'read', 'update', 'list'],
    appointments: ['create', 'read', 'update', 'delete', 'list'],
    records: ['read', 'list'],
    staff: ['read'],
    payments: ['create', 'read', 'update', 'list'],
    immunization: ['read'],
    prescription: ['read'],
    growth: ['read'],
    reports: ['view'],
    system: []
  }),
  patient: ac.newRole({
    ...userAc.statements,
    appointments: ['create', 'read'],
    records: ['read'],
    payments: ['read'],
    immunization: ['read'],
    prescription: ['read'],
    growth: ['read'],
    // Explicitly empty for others
    patients: [],
    staff: [],
    system: [],
    reports: []
  })
};

export type UserRoles = keyof typeof roles;
export { statements as statement };
