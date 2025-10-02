/**
 * Centralized role constants using Supabase types
 * This ensures consistency between database values and client-side checks
 */
export const USER_ROLES = {
  SUPER_ADMIN: 'super_admin',
  RESTAURANT_OWNER: 'restaurant_owner',
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

/**
 * Type guard to check if a string is a valid user role
 */
export function isValidRole(role: string | undefined | null): role is UserRole {
  if (!role) return false;
  return Object.values(USER_ROLES).includes(role as UserRole);
}
