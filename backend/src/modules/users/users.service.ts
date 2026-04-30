import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common'
import * as bcrypt from 'bcryptjs'
import { UsersRepository } from './users.repository'
import type {
  CreateUserDto,
  UpdateUserDto,
  ChangePasswordDto,
  ResetPasswordDto,
  UserQueryDto,
  UserRoleValue,
} from './dto/user.dto'

// Role hierarchy: higher index = more privilege
const ROLE_RANK: Record<UserRoleValue, number> = {
  cashier: 0,
  manager: 1,
  admin:   2,
  owner:   3,
}

const BCRYPT_ROUNDS = 10

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name)

  constructor(private readonly repo: UsersRepository) {}

  // ─── Queries ──────────────────────────────────────────────────────────────

  async list(tenantId: string, actorRole: UserRoleValue, actorBranchId: string | null, q: UserQueryDto) {
    // manager can only see users in their branch
    if (actorRole === 'manager') {
      q = { ...q, branch_id: actorBranchId ?? undefined }
    }
    return this.repo.findMany(tenantId, q)
  }

  async getById(tenantId: string, actorId: string, actorRole: UserRoleValue, actorBranchId: string | null, targetId: string) {
    const user = await this.repo.findById(tenantId, targetId)
    if (!user) throw new NotFoundException(`User ${targetId} not found`)

    // self access always allowed; manager only sees their branch
    if (actorId !== targetId && actorRole === 'manager' && user.branch_id !== actorBranchId) {
      throw new ForbiddenException('Access denied to user in a different branch')
    }
    if (actorRole === 'cashier' && actorId !== targetId) {
      throw new ForbiddenException('Cashiers can only view their own profile')
    }

    return user
  }

  // ─── Mutations ────────────────────────────────────────────────────────────

  async create(tenantId: string, actorRole: UserRoleValue, dto: CreateUserDto) {
    // Enforce role hierarchy: can't create a user with equal or higher role
    if (ROLE_RANK[dto.role] >= ROLE_RANK[actorRole]) {
      throw new ForbiddenException(
        `Role '${actorRole}' cannot create a user with role '${dto.role}'`
      )
    }

    const exists = await this.repo.emailExists(tenantId, dto.email)
    if (exists) throw new ConflictException(`Email '${dto.email}' is already in use`)

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS)

    const user = await this.repo.create(tenantId, {
      email:        dto.email,
      passwordHash,
      role:         dto.role,
      firstName:    dto.first_name,
      lastName:     dto.last_name,
      branchId:     dto.branch_id,
    })

    this.logger.log({ tenantId, userId: user.id, role: dto.role }, 'User created')
    return user
  }

  async update(
    tenantId:      string,
    actorId:       string,
    actorRole:     UserRoleValue,
    targetId:      string,
    dto:           UpdateUserDto,
  ) {
    const target = await this.repo.findById(tenantId, targetId)
    if (!target) throw new NotFoundException(`User ${targetId} not found`)

    // Can't modify a user with equal or higher rank (except self for profile fields)
    const isSelf = actorId === targetId
    if (!isSelf && ROLE_RANK[target.role] >= ROLE_RANK[actorRole]) {
      throw new ForbiddenException(
        `Role '${actorRole}' cannot modify a user with role '${target.role}'`
      )
    }

    // Self-update: only name fields allowed
    if (isSelf) {
      if (dto.role !== undefined || dto.branch_id !== undefined || dto.is_active !== undefined) {
        throw new ForbiddenException('Users cannot change their own role, branch, or active status')
      }
    }

    // Prevent escalation: new role can't be >= actor's role
    if (dto.role && ROLE_RANK[dto.role] >= ROLE_RANK[actorRole]) {
      throw new ForbiddenException(
        `Role '${actorRole}' cannot assign role '${dto.role}'`
      )
    }

    // Validate branch_id requirement for manager/cashier
    const effectiveRole = dto.role ?? target.role
    if (['manager', 'cashier'].includes(effectiveRole)) {
      const effectiveBranch = 'branch_id' in dto ? dto.branch_id : target.branch_id
      if (!effectiveBranch) {
        throw new BadRequestException('branch_id is required for manager and cashier roles')
      }
    }

    const updated = await this.repo.update(tenantId, targetId, {
      firstName: dto.first_name,
      lastName:  dto.last_name,
      role:      dto.role,
      branchId:  dto.branch_id,
      isActive:  dto.is_active,
    })

    this.logger.log({ tenantId, targetId, actorId, changes: dto }, 'User updated')
    return updated
  }

  async changePassword(
    tenantId: string,
    actorId:  string,
    targetId: string,
    dto:      ChangePasswordDto,
  ) {
    if (actorId !== targetId) throw new ForbiddenException('Can only change your own password')

    const currentHash = await this.repo.getPasswordHash(tenantId, targetId)
    if (!currentHash) throw new NotFoundException('User not found')

    const valid = await bcrypt.compare(dto.current_password, currentHash)
    if (!valid) throw new UnauthorizedException('Current password is incorrect')

    const newHash = await bcrypt.hash(dto.new_password, BCRYPT_ROUNDS)
    await this.repo.changePassword(tenantId, targetId, newHash)
    this.logger.log({ tenantId, userId: targetId }, 'Password changed')
  }

  async resetPassword(
    tenantId:  string,
    actorRole: UserRoleValue,
    targetId:  string,
    dto:       ResetPasswordDto,
  ) {
    const target = await this.repo.findById(tenantId, targetId)
    if (!target) throw new NotFoundException(`User ${targetId} not found`)

    if (ROLE_RANK[target.role] >= ROLE_RANK[actorRole]) {
      throw new ForbiddenException(`Role '${actorRole}' cannot reset password for role '${target.role}'`)
    }

    const newHash = await bcrypt.hash(dto.new_password, BCRYPT_ROUNDS)
    await this.repo.changePassword(tenantId, targetId, newHash)
    this.logger.log({ tenantId, targetId, actorRole }, 'Password reset by admin')
  }

  async deactivate(
    tenantId:  string,
    actorId:   string,
    actorRole: UserRoleValue,
    targetId:  string,
  ) {
    if (actorId === targetId) throw new BadRequestException('Cannot deactivate your own account')

    const target = await this.repo.findById(tenantId, targetId)
    if (!target) throw new NotFoundException(`User ${targetId} not found`)

    if (ROLE_RANK[target.role] >= ROLE_RANK[actorRole]) {
      throw new ForbiddenException(`Role '${actorRole}' cannot deactivate role '${target.role}'`)
    }

    await this.repo.update(tenantId, targetId, { isActive: false })
    this.logger.log({ tenantId, targetId, actorId }, 'User deactivated')
  }
}
