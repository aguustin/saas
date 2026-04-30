import { z } from 'zod'

export const LoginSchema = z.object({
  email:       z.string().email(),
  password:    z.string().min(1),
  device_id:   z.string().min(1).max(200),
  device_name: z.string().max(200).optional(),
})

export const RefreshSchema = z.object({
  refresh_token: z.string().min(1),
  device_id:     z.string().min(1).max(200),
})

export const LogoutSchema = z.object({
  device_id: z.string().min(1).max(200),
  all_devices: z.boolean().optional().default(false),
})

export type LoginDto   = z.infer<typeof LoginSchema>
export type RefreshDto = z.infer<typeof RefreshSchema>
export type LogoutDto  = z.infer<typeof LogoutSchema>

export interface TokenPair {
  access_token:  string
  refresh_token: string
  expires_in:    number   // segundos
}
