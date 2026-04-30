export type UserRole  = 'owner' | 'admin' | 'manager' | 'cashier'
export type PlanName  = 'free' | 'pro' | 'premium' | 'super'

export interface JwtPayload {
  sub:        string       // user_id
  tenant_id:  string
  role:       UserRole
  plan:       PlanName
  branch_id:  string | null
  iat?:       number
  exp?:       number
}
