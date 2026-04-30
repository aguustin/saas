import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common'
import { EmployeesRepository } from './employees.repository'
import type {
  CreateEmployeeDto,
  UpdateEmployeeDto,
  EmployeeQueryDto,
} from './dto/employee.dto'
import type { UserRole as UserRoleValue } from '@common/types/jwt-payload'

@Injectable()
export class EmployeesService {
  private readonly logger = new Logger(EmployeesService.name)

  constructor(private readonly repo: EmployeesRepository) {}

  // ─── Queries ──────────────────────────────────────────────────────────────

  async list(
    tenantId:      string,
    actorRole:     UserRoleValue,
    actorBranchId: string | null,
    q:             EmployeeQueryDto,
  ) {
    // managers only see their own branch
    if (actorRole === 'manager') {
      q = { ...q, branch_id: actorBranchId ?? undefined }
    }
    return this.repo.findMany(tenantId, q)
  }

  async getById(
    tenantId:      string,
    actorRole:     UserRoleValue,
    actorBranchId: string | null,
    id:            string,
  ) {
    const emp = await this.repo.findById(tenantId, id)
    if (!emp) throw new NotFoundException(`Employee ${id} not found`)

    if (actorRole === 'manager' && emp.branch_id !== actorBranchId) {
      throw new ForbiddenException('Access denied to employee in a different branch')
    }

    return emp
  }

  // ─── Mutations ────────────────────────────────────────────────────────────

  async create(
    tenantId:      string,
    actorRole:     UserRoleValue,
    actorBranchId: string | null,
    dto:           CreateEmployeeDto,
  ) {
    // manager can only create in their own branch
    if (actorRole === 'manager' && dto.branch_id !== actorBranchId) {
      throw new ForbiddenException('Managers can only create employees in their own branch')
    }

    const emp = await this.repo.create(tenantId, dto)
    this.logger.log({ tenantId, employeeId: emp.id, branchId: dto.branch_id }, 'Employee created')
    return emp
  }

  async update(
    tenantId:      string,
    actorRole:     UserRoleValue,
    actorBranchId: string | null,
    id:            string,
    dto:           UpdateEmployeeDto,
  ) {
    const emp = await this.repo.findById(tenantId, id)
    if (!emp) throw new NotFoundException(`Employee ${id} not found`)

    if (actorRole === 'manager' && emp.branch_id !== actorBranchId) {
      throw new ForbiddenException('Access denied to employee in a different branch')
    }

    // manager can't reassign to a different branch
    if (actorRole === 'manager' && dto.branch_id && dto.branch_id !== actorBranchId) {
      throw new ForbiddenException('Managers cannot transfer employees to other branches')
    }

    const updated = await this.repo.update(tenantId, id, {
      firstName: dto.first_name,
      lastName:  dto.last_name,
      branchId:  dto.branch_id,
      role:      dto.role,
      userId:    dto.user_id,
      dni:       dto.dni,
      phone:     dto.phone,
      email:     dto.email,
      salary:    dto.salary,
      hiredAt:   dto.hired_at,
      notes:     dto.notes,
      isActive:  dto.is_active,
    })

    this.logger.log({ tenantId, employeeId: id }, 'Employee updated')
    return updated
  }

  async remove(
    tenantId:      string,
    actorRole:     UserRoleValue,
    actorBranchId: string | null,
    id:            string,
  ) {
    const emp = await this.repo.findById(tenantId, id)
    if (!emp) throw new NotFoundException(`Employee ${id} not found`)

    if (actorRole === 'manager' && emp.branch_id !== actorBranchId) {
      throw new ForbiddenException('Access denied to employee in a different branch')
    }

    const deleted = await this.repo.softDelete(tenantId, id)
    if (!deleted) throw new NotFoundException(`Employee ${id} not found`)

    this.logger.log({ tenantId, employeeId: id }, 'Employee deleted')
  }
}
