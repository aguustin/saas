-- ════════════════════════════════════════════════════════════════════════════
-- TENANT SCHEMA TEMPLATE
-- Ejecutado por TenantsService.runTenantMigrations() al crear cada tenant
-- y por el migration runner al aplicar nuevas versiones.
-- Variable: :schema → reemplazada con tenant_{id} antes de ejecutar.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Secuencia global de sync (una sola, compartida entre todos los tenants) ──
CREATE SEQUENCE IF NOT EXISTS public.sync_version_seq
  START 1 INCREMENT 1 CACHE 100;

-- ─── Branches (sucursales) ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS :schema.branches (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL,
  address      TEXT,
  phone        TEXT,
  email        TEXT,
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at   TIMESTAMPTZ,
  -- sync
  sync_id      UUID        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  sync_version BIGINT      NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS :schema_branches_active
  ON :schema.branches(is_active) WHERE deleted_at IS NULL;

-- ─── Users (acceso al sistema) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS :schema.users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  role          TEXT        NOT NULL
                              CHECK (role IN ('owner','admin','manager','cashier')),
  branch_id     UUID        REFERENCES :schema.branches(id),
  first_name    TEXT,
  last_name     TEXT,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  -- Sin sync: usuarios se gestionan solo desde cloud
);

CREATE INDEX IF NOT EXISTS :schema_users_email
  ON :schema.users(email) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS :schema_users_branch
  ON :schema.users(branch_id) WHERE is_active = true;

-- ─── Employees (personal, puede o no tener usuario) ──────────────────────────
CREATE TABLE IF NOT EXISTS :schema.employees (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES :schema.users(id),
  branch_id   UUID        REFERENCES :schema.branches(id),
  first_name  TEXT        NOT NULL,
  last_name   TEXT        NOT NULL,
  dni         TEXT,
  phone       TEXT,
  email       TEXT,
  role        TEXT        NOT NULL,
  salary      NUMERIC(12,2),
  hired_at    DATE,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ,
  -- sync
  sync_id      UUID   NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  sync_version BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS :schema_employees_branch
  ON :schema.employees(branch_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS :schema_employees_sync
  ON :schema.employees(sync_version) WHERE deleted_at IS NULL;

-- ─── Customers (clientes de la tienda) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS :schema.customers (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name  TEXT,
  last_name   TEXT,
  email       TEXT,
  phone       TEXT,
  tax_id      TEXT,                           -- CUIT/DNI para facturación
  address     TEXT,
  notes       TEXT,
  total_spent NUMERIC(14,2) NOT NULL DEFAULT 0,
  visit_count INT           NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ,
  -- sync
  sync_id      UUID   NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  sync_version BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS :schema_customers_email
  ON :schema.customers(email)
  WHERE email IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS :schema_customers_phone
  ON :schema.customers(phone)
  WHERE phone IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS :schema_customers_sync
  ON :schema.customers(sync_version);

-- ─── Categories ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS :schema.categories (
  id          UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id   UUID   REFERENCES :schema.categories(id),
  name        TEXT   NOT NULL,
  slug        TEXT   NOT NULL UNIQUE,
  sort_order  INT    NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ,
  sync_id      UUID   NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  sync_version BIGINT NOT NULL DEFAULT 0
);

-- ─── Products ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS :schema.products (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id  UUID        REFERENCES :schema.categories(id),
  name         TEXT        NOT NULL,
  description  TEXT,
  sku          TEXT,
  barcode      TEXT,
  price        NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  cost         NUMERIC(12,2)           CHECK (cost  >= 0),
  tax_rate     NUMERIC(5,4)  NOT NULL DEFAULT 0.21,
  unit         TEXT          NOT NULL DEFAULT 'unit',
  image_url    TEXT,
  attributes   JSONB         NOT NULL DEFAULT '{}',  -- talle, color, etc.
  is_active    BOOLEAN       NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  deleted_at   TIMESTAMPTZ,
  -- sync
  sync_id      UUID   NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  sync_version BIGINT NOT NULL DEFAULT nextval('public.sync_version_seq')
);

-- SKU y barcode únicos dentro de la tienda (excluyendo borrados)
CREATE UNIQUE INDEX IF NOT EXISTS :schema_products_sku
  ON :schema.products(sku)
  WHERE sku IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS :schema_products_barcode
  ON :schema.products(barcode)
  WHERE barcode IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS :schema_products_category
  ON :schema.products(category_id) WHERE deleted_at IS NULL;

-- Full-text search en nombre
CREATE INDEX IF NOT EXISTS :schema_products_fts
  ON :schema.products USING GIN(to_tsvector('spanish', name));

CREATE INDEX IF NOT EXISTS :schema_products_sync
  ON :schema.products(sync_version);

CREATE INDEX IF NOT EXISTS :schema_products_updated
  ON :schema.products(updated_at DESC) WHERE deleted_at IS NULL;

-- ─── Stock ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS :schema.stock (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   UUID          NOT NULL REFERENCES :schema.products(id),
  branch_id    UUID          NOT NULL REFERENCES :schema.branches(id),
  quantity     NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  min_quantity NUMERIC(12,3) NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  -- sync
  sync_id      UUID   NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  sync_version BIGINT NOT NULL DEFAULT 0,

  UNIQUE (product_id, branch_id)
);

CREATE INDEX IF NOT EXISTS :schema_stock_branch
  ON :schema.stock(branch_id);
CREATE INDEX IF NOT EXISTS :schema_stock_low
  ON :schema.stock(branch_id)
  WHERE quantity <= min_quantity;
CREATE INDEX IF NOT EXISTS :schema_stock_sync
  ON :schema.stock(sync_version);

-- ─── Stock Movements (append-only, delta-based) ───────────────────────────────
CREATE TABLE IF NOT EXISTS :schema.stock_movements (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id     UUID          NOT NULL REFERENCES :schema.stock(id),
  type         TEXT          NOT NULL
                               CHECK (type IN ('sale','purchase','adjustment','transfer','return')),
  quantity     NUMERIC(12,3) NOT NULL,   -- negativo = salida, positivo = entrada
  reference_id UUID,                     -- sale_id, purchase_id, etc.
  note         TEXT,
  created_by   UUID          REFERENCES :schema.users(id),
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  -- sync
  sync_id      UUID   NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  sync_version BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS :schema_stockmov_stock
  ON :schema.stock_movements(stock_id, created_at DESC);
CREATE INDEX IF NOT EXISTS :schema_stockmov_ref
  ON :schema.stock_movements(reference_id)
  WHERE reference_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS :schema_stockmov_sync
  ON :schema.stock_movements(sync_version);

-- ─── Sales ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS :schema.sales (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id        UUID          NOT NULL REFERENCES :schema.branches(id),
  customer_id      UUID          REFERENCES :schema.customers(id),
  cashier_id       UUID          REFERENCES :schema.users(id),
  status           TEXT          NOT NULL DEFAULT 'completed'
                                   CHECK (status IN ('pending','completed','cancelled','refunded')),
  subtotal         NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0),
  discount         NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  tax              NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (tax >= 0),
  total            NUMERIC(12,2) NOT NULL CHECK (total >= 0),
  payment_method   TEXT          NOT NULL
                                   CHECK (payment_method IN ('cash','card','transfer','mp','mixed')),
  payment_details  JSONB         NOT NULL DEFAULT '{}', -- cambio, cuotas, referencia
  notes            TEXT,
  -- timestamps: server_created_at es el autoritativo, client para auditoría
  client_created_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  -- sync
  sync_id      UUID   NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  sync_version BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS :schema_sales_branch_date
  ON :schema.sales(branch_id, created_at DESC)
  WHERE status = 'completed';
CREATE INDEX IF NOT EXISTS :schema_sales_cashier
  ON :schema.sales(cashier_id, created_at DESC);
CREATE INDEX IF NOT EXISTS :schema_sales_customer
  ON :schema.sales(customer_id)
  WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS :schema_sales_sync
  ON :schema.sales(sync_version);
CREATE INDEX IF NOT EXISTS :schema_sales_updated
  ON :schema.sales(updated_at DESC);

-- ─── Sale Items ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS :schema.sale_items (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id      UUID          NOT NULL REFERENCES :schema.sales(id) ON DELETE CASCADE,
  product_id   UUID          NOT NULL REFERENCES :schema.products(id),
  -- Desnormalizado: precio y nombre al momento de la venta (histórico)
  product_name TEXT          NOT NULL,
  product_sku  TEXT,
  quantity     NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
  unit_price   NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  discount     NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  subtotal     NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0),
  -- sync
  sync_id      UUID   NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  sync_version BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS :schema_saleitems_sale
  ON :schema.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS :schema_saleitems_product
  ON :schema.sale_items(product_id);

-- ─── Sync Cursors (por dispositivo) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS :schema.sync_cursors (
  device_id           TEXT        NOT NULL,
  table_name          TEXT        NOT NULL,
  last_pulled_version BIGINT      NOT NULL DEFAULT 0,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (device_id, table_name)
);

-- ─── Changes Log (append-only — auditoría y resolución de conflictos) ─────────
CREATE TABLE IF NOT EXISTS :schema.changes_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name   TEXT        NOT NULL,
  row_id       UUID        NOT NULL,
  operation    TEXT        NOT NULL
                             CHECK (operation IN ('INSERT','UPDATE','DELETE')),
  sync_version BIGINT      NOT NULL,
  payload      JSONB       NOT NULL DEFAULT '{}',
  device_id    TEXT,                               -- NULL = server-originated
  user_id      UUID        REFERENCES :schema.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS :schema_changes_log_version
  ON :schema.changes_log(sync_version);
CREATE INDEX IF NOT EXISTS :schema_changes_log_table_row
  ON :schema.changes_log(table_name, row_id, created_at DESC);
CREATE INDEX IF NOT EXISTS :schema_changes_log_device
  ON :schema.changes_log(device_id, created_at DESC)
  WHERE device_id IS NOT NULL;
