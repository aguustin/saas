import { z } from 'zod'

export const UserRole = z.enum(['owner', 'admin', 'manager', 'cashier'])
export type  UserRoleValue = z.infer<typeof UserRole>

const PASSWORD_MIN = 8
const passwordField = z
  .string()
  .min(PASSWORD_MIN, `Password must be at least ${PASSWORD_MIN} characters`)
  .max(128)

export const CreateUserSchema = z.object({
  email:      z.string().email().toLowerCase(),
  password:   passwordField,
  role:       UserRole,
  first_name: z.string().min(1).max(100),
  last_name:  z.string().min(1).max(100).optional().nullable(),
  branch_id:  z.string().uuid().optional().nullable(),
}).refine(
  d => !(['manager', 'cashier'] as UserRoleValue[]).includes(d.role) || !!d.branch_id,
  { message: 'branch_id is required for manager and cashier roles', path: ['branch_id'] }
)

export const UpdateUserSchema = z.object({
  first_name: z.string().min(1).max(100).optional(),
  last_name:  z.string().min(1).max(100).optional().nullable(),
  role:       UserRole.optional(),
  branch_id:  z.string().uuid().optional().nullable(),
  is_active:  z.boolean().optional(),
}).refine(
  d => {
    if (!d.role) return true
    if (!(['manager', 'cashier'] as UserRoleValue[]).includes(d.role)) return true
    // null = explicitly clearing; undefined = keep existing (service validates the effective value)
    return d.branch_id !== null
  },
  { message: 'branch_id is required for manager and cashier roles', path: ['branch_id'] }
)

export const ChangePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password:     passwordField,
})

export const ResetPasswordSchema = z.object({
  new_password: passwordField,
})

export const UserQuerySchema = z.object({
  role:      UserRole.optional(),
  branch_id: z.string().uuid().optional(),
  is_active: z.coerce.boolean().optional(),
  search:    z.string().optional(),
  limit:     z.coerce.number().int().min(1).max(200).optional().default(50),
  offset:    z.coerce.number().int().min(0).optional().default(0),
})

export type CreateUserDto     = z.infer<typeof CreateUserSchema>
export type UpdateUserDto     = z.infer<typeof UpdateUserSchema>
export type ChangePasswordDto = z.infer<typeof ChangePasswordSchema>
export type ResetPasswordDto  = z.infer<typeof ResetPasswordSchema>
export type UserQueryDto      = z.infer<typeof UserQuerySchema>

// ─── Responses ────────────────────────────────────────────────────────────────

export interface UserRow {
  id:            string
  email:         string
  role:          UserRoleValue
  first_name:    string | null
  last_name:     string | null
  branch_id:     string | null
  branch_name:   string | null
  is_active:     boolean
  last_login_at: string | null
  created_at:    string
  updated_at:    string
}
