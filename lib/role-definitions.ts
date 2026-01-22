// Role definitions matching the database schema
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ORG_ADMIN: 'org_admin', 
  STAFF: 'staff',
  DRIVER: 'driver',
  MECHANIC: 'mechanic',
  SUPERVISOR: 'supervisor'
} as const

export const ROLE_DISPLAY_NAMES = {
  [ROLES.SUPER_ADMIN]: 'Super Admin',
  [ROLES.ORG_ADMIN]: 'Organization Admin',
  [ROLES.STAFF]: 'Staff',
  [ROLES.DRIVER]: 'Driver',
  [ROLES.MECHANIC]: 'Mechanic',
  [ROLES.SUPERVISOR]: 'Supervisor'
} as const

export const ROLE_DESCRIPTIONS = {
  [ROLES.SUPER_ADMIN]: 'Full system access and configuration',
  [ROLES.ORG_ADMIN]: 'Manage organization users and operations',
  [ROLES.STAFF]: 'Support staff with limited access',
  [ROLES.DRIVER]: 'Vehicle operator with trip management',
  [ROLES.MECHANIC]: 'Vehicle maintenance and inspections',
  [ROLES.SUPERVISOR]: 'Oversee drivers and approve trips'
} as const

// Roles available for user signup
export const SIGNUP_ROLES = [
  { value: ROLES.DRIVER, label: 'Driver', description: 'Vehicle operator' },
  { value: ROLES.MECHANIC, label: 'Mechanic', description: 'Vehicle maintenance' },
  { value: ROLES.SUPERVISOR, label: 'Supervisor', description: 'Driver oversight' },
  { value: ROLES.STAFF, label: 'Staff', description: 'Support role' }
] as const

// Role permissions for UI features
export const ROLE_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: {
    canManageUsers: true,
    canManageOrganizations: true,
    canViewAllTrips: true,
    canApproveTrips: true,
    canManageSystem: true
  },
  [ROLES.ORG_ADMIN]: {
    canManageUsers: true,
    canManageOrganizations: false,
    canViewAllTrips: true,
    canApproveTrips: true,
    canManageSystem: false
  },
  [ROLES.STAFF]: {
    canManageUsers: false,
    canManageOrganizations: false,
    canViewAllTrips: false,
    canApproveTrips: false,
    canManageSystem: false
  },
  [ROLES.DRIVER]: {
    canManageUsers: false,
    canManageOrganizations: false,
    canViewAllTrips: false,
    canApproveTrips: false,
    canManageSystem: false
  },
  [ROLES.MECHANIC]: {
    canManageUsers: false,
    canManageOrganizations: false,
    canViewAllTrips: false,
    canApproveTrips: false,
    canManageSystem: false
  },
  [ROLES.SUPERVISOR]: {
    canManageUsers: false,
    canManageOrganizations: false,
    canViewAllTrips: true, // Can view org trips
    canApproveTrips: true,
    canManageSystem: false
  }
} as const

// Dashboard routes for each role
export const ROLE_DASHBOARD_ROUTES = {
  [ROLES.SUPER_ADMIN]: '/dashboard/super-admin',
  [ROLES.ORG_ADMIN]: '/dashboard/org-admin',
  [ROLES.STAFF]: '/dashboard/staff',
  [ROLES.DRIVER]: '/dashboard/driver',
  [ROLES.MECHANIC]: '/dashboard/mechanic',
  [ROLES.SUPERVISOR]: '/dashboard/supervisor'
} as const

export type Role = typeof ROLES[keyof typeof ROLES]
