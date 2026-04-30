import { z } from 'zod'

export const CreateEmployeeSchema = z.object({
  first_name: z.string().min(1).max(100),
  last_name:  z.string().min(1).max(100),
  branch_id:  z.string().uuid(),
  role:       z.string().min(1).max(50),
  user_id:    z.string().uuid().optional().nullable(),
  dni:        z.string().max(30).optional().nullable(),
  phone:      z.string().max(30).optional().nullable(),
  email:      z.string().email().optional().nullable(),
  salary:     z.number().nonnegative().optional().nullable(),
  hired_at:   z.string().date().optional().nullable(),   // ISO date YYYY-MM-DD
  notes:      z.string().max(500).optional().nullable(),
})

export const UpdateEmployeeSchema = CreateEmployeeSchema.partial().omit({ branch_id: true }).extend({
  branch_id: z.string().uuid().optional(),
  is_active: z.boolean().optional(),
})

export const EmployeeQuerySchema = z.object({
  branch_id: z.string().uuid().optional(),
  role:      z.string().optional(),
  is_active: z.coerce.boolean().optional(),
  search:    z.string().optional(),
  limit:     z.coerce.number().int().min(1).max(200).optional().default(50),
  offset:    z.coerce.number().int().min(0).optional().default(0),
})

export type CreateEmployeeDto  = z.infer<typeof CreateEmployeeSchema>
export type UpdateEmployeeDto  = z.infer<typeof UpdateEmployeeSchema>
export type EmployeeQueryDto   = z.infer<typeof EmployeeQuerySchema>

// ─── Responses ────────────────────────────────────────────────────────────────

export interface EmployeeRow {
  id:          string
  user_id:     string | null
  branch_id:   string
  branch_name: string
  first_name:  string
  last_name:   string
  dni:         string | null
  phone:       string | null
  email:       string | null
  role:        string
  salary:      number | null
  hired_at:    string | null
  is_active:   boolean
  notes:       string | null
  sync_version: number
  created_at:  string
  updated_at:  string
}
