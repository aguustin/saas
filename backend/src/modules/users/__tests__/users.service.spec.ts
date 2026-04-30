import { Test }                from '@nestjs/testing'
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common'
import * as bcrypt             from 'bcryptjs'
import { UsersService }        from '../users.service'
import { UsersRepository }     from '../users.repository'
import type { CreateUserDto, UpdateUserDto } from '../dto/user.dto'

jest.mock('bcryptjs', () => ({
  hash:    jest.fn().mockResolvedValue('hashed_pw'),
  compare: jest.fn(),
}))

const TENANT = 'aaaaaaaa-0000-0000-0000-000000000001'
const BRANCH = 'bbbbbbbb-0000-0000-0000-000000000001'
const OWNER  = 'cccccccc-0000-0000-0000-000000000001'
const ADMIN  = 'cccccccc-0000-0000-0000-000000000002'
const MGR    = 'cccccccc-0000-0000-0000-000000000003'

const makeUser = (id: string, role: string, branchId: string | null = null) => ({
  id, role, branch_id: branchId,
  email: `${role}@test.com`, first_name: role, last_name: null,
  branch_name: null, is_active: true, last_login_at: null,
  created_at: '', updated_at: '',
})

describe('UsersService', () => {
  let service: UsersService
  let repo:    jest.Mocked<UsersRepository>

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: UsersRepository,
          useValue: {
            findMany:        jest.fn(),
            findById:        jest.fn(),
            findByEmail:     jest.fn(),
            emailExists:     jest.fn(),
            create:          jest.fn(),
            update:          jest.fn(),
            changePassword:  jest.fn(),
            getPasswordHash: jest.fn(),
          },
        },
      ],
    }).compile()

    service = module.get(UsersService)
    repo    = module.get(UsersRepository)
  })

  // ─── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto: CreateUserDto = {
      email: 'mgr@test.com', password: 'pass1234', role: 'manager',
      first_name: 'John', branch_id: BRANCH,
    }

    it('owner can create manager', async () => {
      repo.emailExists.mockResolvedValue(false)
      repo.create.mockResolvedValue(makeUser(MGR, 'manager', BRANCH) as any)

      await expect(service.create(TENANT, 'owner', dto)).resolves.toBeDefined()
      expect(repo.create).toHaveBeenCalledWith(TENANT, expect.objectContaining({ role: 'manager' }))
    })

    it('admin cannot create admin (equal rank)', async () => {
      repo.emailExists.mockResolvedValue(false)
      await expect(service.create(TENANT, 'admin', { ...dto, role: 'admin' }))
        .rejects.toThrow(ForbiddenException)
    })

    it('admin cannot create owner (higher rank)', async () => {
      repo.emailExists.mockResolvedValue(false)
      await expect(service.create(TENANT, 'admin', { ...dto, role: 'owner' }))
        .rejects.toThrow(ForbiddenException)
    })

    it('throws ConflictException on duplicate email', async () => {
      repo.emailExists.mockResolvedValue(true)
      await expect(service.create(TENANT, 'owner', dto)).rejects.toThrow(ConflictException)
      expect(repo.create).not.toHaveBeenCalled()
    })

    it('hashes password before storing', async () => {
      repo.emailExists.mockResolvedValue(false)
      repo.create.mockResolvedValue(makeUser(MGR, 'manager') as any)

      await service.create(TENANT, 'owner', dto)

      expect(bcrypt.hash).toHaveBeenCalledWith('pass1234', expect.any(Number))
      expect(repo.create).toHaveBeenCalledWith(
        TENANT,
        expect.objectContaining({ passwordHash: 'hashed_pw' })
      )
    })
  })

  // ─── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('owner can update manager', async () => {
      repo.findById.mockResolvedValue(makeUser(MGR, 'manager', BRANCH) as any)
      repo.update.mockResolvedValue(makeUser(MGR, 'manager', BRANCH) as any)

      await expect(
        service.update(TENANT, OWNER, 'owner', MGR, { first_name: 'Jane' })
      ).resolves.toBeDefined()
    })

    it('admin cannot update owner (higher rank)', async () => {
      repo.findById.mockResolvedValue(makeUser(OWNER, 'owner') as any)

      await expect(
        service.update(TENANT, ADMIN, 'admin', OWNER, { first_name: 'New' })
      ).rejects.toThrow(ForbiddenException)
    })

    it('user cannot change their own role via self-update', async () => {
      repo.findById.mockResolvedValue(makeUser(MGR, 'manager', BRANCH) as any)

      await expect(
        service.update(TENANT, MGR, 'manager', MGR, { role: 'owner' })
      ).rejects.toThrow(ForbiddenException)
    })

    it('cannot escalate to equal or higher role', async () => {
      repo.findById.mockResolvedValue(makeUser(MGR, 'manager', BRANCH) as any)

      await expect(
        service.update(TENANT, ADMIN, 'admin', MGR, { role: 'admin' })
      ).rejects.toThrow(ForbiddenException)
    })
  })

  // ─── deactivate ────────────────────────────────────────────────────────────

  describe('deactivate', () => {
    it('throws when trying to deactivate self', async () => {
      await expect(service.deactivate(TENANT, OWNER, 'owner', OWNER))
        .rejects.toThrow(BadRequestException)
    })

    it('admin cannot deactivate owner', async () => {
      repo.findById.mockResolvedValue(makeUser(OWNER, 'owner') as any)
      await expect(service.deactivate(TENANT, ADMIN, 'admin', OWNER))
        .rejects.toThrow(ForbiddenException)
    })
  })

  // ─── changePassword ────────────────────────────────────────────────────────

  describe('changePassword', () => {
    it('throws ForbiddenException when changing another user password', async () => {
      await expect(
        service.changePassword(TENANT, OWNER, MGR, { current_password: 'x', new_password: 'newpass1' })
      ).rejects.toThrow(ForbiddenException)
    })

    it('throws UnauthorizedException when current password is wrong', async () => {
      repo.getPasswordHash.mockResolvedValue('hashed_pw')
      ;(bcrypt.compare as jest.Mock).mockResolvedValue(false)

      await expect(
        service.changePassword(TENANT, MGR, MGR, { current_password: 'wrong', new_password: 'newpass1' })
      ).rejects.toThrow(UnauthorizedException)
    })

    it('changes password when current is correct', async () => {
      repo.getPasswordHash.mockResolvedValue('hashed_pw')
      ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)

      await service.changePassword(TENANT, MGR, MGR, { current_password: 'correct', new_password: 'newpass1' })
      expect(repo.changePassword).toHaveBeenCalledWith(TENANT, MGR, 'hashed_pw')
    })
  })
})
