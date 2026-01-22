// Centralized role constants and routing configuration
export const ROLES = {
  DRIVER: 'driver',
  SUPERVISOR: 'supervisor', 
  MECHANIC: 'mechanic',
  ORG_ADMIN: 'org_admin',
  SUPER_ADMIN: 'super_admin',
  STAFF: 'staff'
} as const

// Single source of truth for role-based routing
export const ROLE_DASHBOARD_ROUTES: Record<string, string> = {
  [ROLES.DRIVER]: '/dashboard/driver',
  [ROLES.SUPERVISOR]: '/dashboard/supervisor',
  [ROLES.MECHANIC]: '/dashboard/mechanic',
  [ROLES.ORG_ADMIN]: '/dashboard/org',
  [ROLES.SUPER_ADMIN]: '/dashboard/super-admin',
  [ROLES.STAFF]: '/dashboard/staff'
}

export const ROLE_DISPLAY_NAMES = {
  [ROLES.DRIVER]: 'Driver',
  [ROLES.SUPERVISOR]: 'Supervisor',
  [ROLES.MECHANIC]: 'Mechanic',
  [ROLES.ORG_ADMIN]: 'Organization Admin',
  [ROLES.SUPER_ADMIN]: 'Super Admin',
  [ROLES.STAFF]: 'Staff'
}

// Roles available for user signup
export const SIGNUP_ROLES = [
  { value: ROLES.DRIVER, label: 'Driver', description: 'Vehicle operator' },
  { value: ROLES.MECHANIC, label: 'Mechanic', description: 'Vehicle maintenance' },
  { value: ROLES.SUPERVISOR, label: 'Supervisor', description: 'Driver oversight' },
  { value: ROLES.STAFF, label: 'Staff', description: 'Support role' }
] as const

export type Role = typeof ROLES[keyof typeof ROLES]
