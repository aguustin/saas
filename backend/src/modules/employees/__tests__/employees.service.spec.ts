import { Test }              from '@nestjs/testing'
import { NotFoundException, ForbiddenException } from '@nestjs/common'
import { EmployeesService }   from '../employees.service'
import { EmployeesRepository } from '../employees.repository'
import type { CreateEmployeeDto, UpdateEmployeeDto } from '../dto/employee.dto'

const TENANT   = 'aaaaaaaa-0000-0000-0000-000000000001'
const BRANCH_A = 'bbbbbbbb-0000-0000-0000-000000000001'
const BRANCH_B = 'bbbbbbbb-0000-0000-0000-000000000002'
const EMP_ID   = 'cccccccc-0000-0000-0000-000000000001'

const mockEmp = {
  id: EMP_ID, user_id: null,
  branch_id: BRANCH_A, branch_name: 'Sucursal A',
  first_name: 'Juan', last_name: 'Pérez',
  dni: '12345678', phone: null, email: null,
  role: 'cashier', salary: null, hired_at: null,
  is_active: true, notes: null, sync_version: 1,
  created_at: '', updated_at: '',
}

describe('EmployeesService', () => {
  let service: EmployeesService
  let repo:    jest.Mocked<EmployeesRepository>

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        EmployeesService,
        {
          provide: EmployeesRepository,
          useValue: {
            findMany:   jest.fn(),
            findById:   jest.fn(),
            create:     jest.fn(),
            update:     jest.fn(),
            softDelete: jest.fn(),
          },
        },
      ],
    }).compile()

    service = module.get(EmployeesService)
    repo    = module.get(EmployeesRepository)
  })

  // ─── list ──────────────────────────────────────────────────────────────────

  describe('list', () => {
    it('scopes manager to their branch', async () => {
      repo.findMany.mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 })

      await service.list(TENANT, 'manager', BRANCH_A, { limit: 50, offset: 0 })
      expect(repo.findMany).toHaveBeenCalledWith(
        TENANT,
        expect.objectContaining({ branch_id: BRANCH_A })
      )
    })

    it('owner can list all branches', async () => {
      repo.findMany.mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 })

      await service.list(TENANT, 'owner', null, { limit: 50, offset: 0 })
      expect(repo.findMany).toHaveBeenCalledWith(
        TENANT,
        expect.not.objectContaining({ branch_id: expect.anything() })
      )
    })
  })

  // ─── getById ───────────────────────────────────────────────────────────────

  describe('getById', () => {
    it('throws NotFoundException for unknown employee', async () => {
      repo.findById.mockResolvedValue(null)
      await expect(service.getById(TENANT, 'owner', null, EMP_ID)).rejects.toThrow(NotFoundException)
    })

    it('manager cannot access employee in different branch', async () => {
      repo.findById.mockResolvedValue(mockEmp)
      await expect(service.getById(TENANT, 'manager', BRANCH_B, EMP_ID))
        .rejects.toThrow(ForbiddenException)
    })

    it('manager can access employee in same branch', async () => {
      repo.findById.mockResolvedValue(mockEmp)
      await expect(service.getById(TENANT, 'manager', BRANCH_A, EMP_ID)).resolves.toEqual(mockEmp)
    })
  })

  // ─── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto: CreateEmployeeDto = {
      first_name: 'Ana', last_name: 'García',
      branch_id: BRANCH_A, role: 'cashier',
    }

    it('manager cannot create in different branch', async () => {
      await expect(
        service.create(TENANT, 'manager', BRANCH_B, { ...dto, branch_id: BRANCH_A })
      ).rejects.toThrow(ForbiddenException)
    })

    it('manager can create in own branch', async () => {
      repo.create.mockResolvedValue(mockEmp)
      await expect(
        service.create(TENANT, 'manager', BRANCH_A, dto)
      ).resolves.toBeDefined()
    })

    it('owner can create in any branch', async () => {
      repo.create.mockResolvedValue(mockEmp)
      await expect(
        service.create(TENANT, 'owner', null, { ...dto, branch_id: BRANCH_B })
      ).resolves.toBeDefined()
    })
  })

  // ─── remove ────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('throws NotFoundException when employee not found', async () => {
      repo.findById.mockResolvedValue(null)
      await expect(service.remove(TENANT, 'owner', null, EMP_ID)).rejects.toThrow(NotFoundException)
    })

    it('manager cannot delete employee from another branch', async () => {
      repo.findById.mockResolvedValue(mockEmp)
      await expect(service.remove(TENANT, 'manager', BRANCH_B, EMP_ID)).rejects.toThrow(ForbiddenException)
    })

    it('manager can delete employee from own branch', async () => {
      repo.findById.mockResolvedValue(mockEmp)
      repo.softDelete.mockResolvedValue(true)
      await expect(service.remove(TENANT, 'manager', BRANCH_A, EMP_ID)).resolves.toBeUndefined()
    })
  })
})
