/**
 * Dev-only seed: creates a tenant + owner user and prints credentials.
 * Run: npx ts-node -r tsconfig-paths/register prisma/seed-dev.ts
 */
import { PrismaClient } from '@prisma/client'
import { hash }         from 'bcryptjs'
import * as crypto      from 'crypto'
import * as fs          from 'fs'
import * as path        from 'path'

const prisma = new PrismaClient()

const TENANT_NAME  = 'Mi Tienda Dev'
const TENANT_SLUG  = 'mi-tienda-dev'
const TENANT_EMAIL = 'dev@mitienda.com'
const USER_EMAIL   = 'admin@mitienda.com'
const USER_PASS    = 'Admin1234!'

async function main() {
  // ── 1. Asegurar que existen los planes ──────────────────────────────────────
  const freePlan = await prisma.plan.findUnique({ where: { name: 'free' } })
  if (!freePlan) {
    console.error('❌ Planes no encontrados. Corré primero: npm run prisma:seed')
    process.exit(1)
  }

  // ── 2. Crear tenant (idempotente por slug) ──────────────────────────────────
  let tenant = await prisma.tenant.findUnique({ where: { slug: TENANT_SLUG } })

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name:        TENANT_NAME,
        email:       TENANT_EMAIL,
        slug:        TENANT_SLUG,
        country:     'AR',
        planId:      freePlan.id,
        status:      'active',
        trialEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    })
    console.log(`✓ Tenant creado: ${tenant.id}`)

    // ── 3. Crear schema del tenant ──────────────────────────────────────────
    const schema = `tenant_${tenant.id.replace(/-/g, '_')}`
    const sqlTemplate = fs.readFileSync(
      path.join(__dirname, 'tenant-schema.sql'),
      'utf8',
    )
    const sql = sqlTemplate
      .replaceAll(':schema.', `"${schema}".`)
      .replaceAll(':schema',   schema)

    const statements = sql
      .split(';')
      .map(s =>
        s.split('\n')
          .filter(line => !line.trim().startsWith('--'))
          .join('\n')
          .trim(),
      )
      .filter(s => s.length > 0)

    await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schema}"`)
    for (const stmt of statements) {
      await prisma.$executeRawUnsafe(stmt)
    }
    console.log(`✓ Schema creado: ${schema}`)

    // ── 4. Crear sucursal principal ─────────────────────────────────────────
    const branchRows = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `INSERT INTO "${schema}".branches (name, is_active)
       VALUES ('Casa Central', true)
       RETURNING id`,
    )
    const branchId = branchRows[0].id
    console.log(`✓ Sucursal creada: ${branchId}`)

    // ── 5. Crear usuario owner ──────────────────────────────────────────────
    const passwordHash = await hash(USER_PASS, 12)
    await prisma.$executeRawUnsafe(
      `INSERT INTO "${schema}".users
         (email, password_hash, role, branch_id, first_name, last_name, is_active)
       VALUES ($1, $2, 'owner', $3::uuid, 'Admin', 'Dev', true)`,
      USER_EMAIL, passwordHash, branchId,
    )
    console.log(`✓ Usuario owner creado`)
  } else {
    console.log(`ℹ️  Tenant ya existe: ${tenant.id}`)
  }

  console.log('\n─────────────────────────────────────────')
  console.log('  CREDENCIALES DE DESARROLLO')
  console.log('─────────────────────────────────────────')
  console.log(`  Tenant ID : ${tenant.id}`)
  console.log(`  Email     : ${USER_EMAIL}`)
  console.log(`  Password  : ${USER_PASS}`)
  console.log('─────────────────────────────────────────\n')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
