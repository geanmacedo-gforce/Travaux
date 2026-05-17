const mysql = require('mysql2/promise');
const { config } = require('dotenv');

config({ override: true });

function getConfigFromEnv() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL nao definido');
  }

  const parsed = new URL(dbUrl);
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, ''),
  };
}

async function scalar(conn, sql, values = []) {
  const [rows] = await conn.query(sql, values);
  const row = rows[0];
  if (!row) return null;
  const key = Object.keys(row)[0];
  return row[key];
}

async function tableExists(conn, table) {
  const value = await scalar(
    conn,
    `SELECT COUNT(*) AS c
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );
  return Number(value) > 0;
}

async function columnExists(conn, table, column) {
  const value = await scalar(
    conn,
    `SELECT COUNT(*) AS c
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return Number(value) > 0;
}

async function indexExists(conn, table, indexName) {
  const value = await scalar(
    conn,
    `SELECT COUNT(*) AS c
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, indexName]
  );
  return Number(value) > 0;
}

async function ensureIndex(conn, table, indexName, columns) {
  if (!(await indexExists(conn, table, indexName))) {
    await conn.query(`CREATE INDEX ${indexName} ON ${table} (${columns})`);
  }
}

async function ensureUniqueIndex(conn, table, indexName, columns) {
  if (!(await indexExists(conn, table, indexName))) {
    await conn.query(`CREATE UNIQUE INDEX ${indexName} ON ${table} (${columns})`);
  }
}

async function ensureTenantColumn(conn, table, defaultTenantId) {
  if (!(await tableExists(conn, table))) return;

  if (!(await columnExists(conn, table, 'tenant_id'))) {
    await conn.query(`ALTER TABLE ${table} ADD COLUMN tenant_id CHAR(36) NULL AFTER id`);
  }

  await conn.query(`UPDATE ${table} SET tenant_id = ? WHERE tenant_id IS NULL`, [defaultTenantId]);
  await conn.query(`ALTER TABLE ${table} MODIFY tenant_id CHAR(36) NOT NULL`);
}

async function run() {
  const conn = await mysql.createConnection(getConfigFromEnv());

  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id CHAR(36) PRIMARY KEY,
        nome VARCHAR(150) NOT NULL,
        slug VARCHAR(120) NOT NULL,
        code VARCHAR(30) NOT NULL,
        ativo TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_tenants_slug (slug),
        UNIQUE KEY uq_tenants_code (code)
      )
    `);

    if (!(await columnExists(conn, 'tenants', 'code'))) {
      await conn.query('ALTER TABLE tenants ADD COLUMN code VARCHAR(30) NULL AFTER slug');
    }
    await conn.query("UPDATE tenants SET code = UPPER(REPLACE(slug, '-', '')) WHERE code IS NULL OR TRIM(code) = ''");
    await conn.query('ALTER TABLE tenants MODIFY code VARCHAR(30) NOT NULL');
    await ensureUniqueIndex(conn, 'tenants', 'uq_tenants_code', 'code');

    await conn.query(
      `INSERT INTO tenants (id, nome, slug, code, ativo)
       SELECT UUID(), 'Tenant Default', 'default', 'DEFAULT', 1
       WHERE NOT EXISTS (SELECT 1 FROM tenants WHERE slug = 'default')`
    );

    const [tenants] = await conn.query('SELECT id FROM tenants WHERE slug = ? LIMIT 1', ['default']);
    const defaultTenantId = tenants[0]?.id;
    if (!defaultTenantId) {
      throw new Error('Nao foi possivel obter tenant default');
    }

    const tenantTables = [
      'users',
      'profiles',
      'user_roles',
      'clientes',
      'funcionarios',
      'obras',
      'produtos',
      'horas_trabalhadas',
      'materiais_usados',
      'despesas',
      'pagamentos',
      'audit_log',
    ];

    for (const table of tenantTables) {
      await ensureTenantColumn(conn, table, defaultTenantId);
    }

    if (await tableExists(conn, 'users')) {
      await ensureIndex(conn, 'users', 'idx_users_tenant_id', 'tenant_id');
      await ensureIndex(conn, 'users', 'idx_users_tenant_email', 'tenant_id, email');
    }
    if (await tableExists(conn, 'profiles')) {
      await ensureIndex(conn, 'profiles', 'idx_profiles_tenant_id', 'tenant_id');
      await ensureIndex(conn, 'profiles', 'idx_profiles_tenant_user', 'tenant_id, user_id');
    }
    if (await tableExists(conn, 'user_roles')) {
      await ensureIndex(conn, 'user_roles', 'idx_user_roles_tenant_id', 'tenant_id');
      await ensureIndex(conn, 'user_roles', 'idx_user_roles_tenant_user', 'tenant_id, user_id');
    }
    if (await tableExists(conn, 'clientes')) await ensureIndex(conn, 'clientes', 'idx_clientes_tenant_id', 'tenant_id');
    if (await tableExists(conn, 'funcionarios')) await ensureIndex(conn, 'funcionarios', 'idx_funcionarios_tenant_id', 'tenant_id');
    if (await tableExists(conn, 'obras')) await ensureIndex(conn, 'obras', 'idx_obras_tenant_id', 'tenant_id');
    if (await tableExists(conn, 'produtos')) await ensureIndex(conn, 'produtos', 'idx_produtos_tenant_id', 'tenant_id');
    if (await tableExists(conn, 'horas_trabalhadas')) await ensureIndex(conn, 'horas_trabalhadas', 'idx_horas_trabalhadas_tenant_id', 'tenant_id');
    if (await tableExists(conn, 'materiais_usados')) await ensureIndex(conn, 'materiais_usados', 'idx_materiais_usados_tenant_id', 'tenant_id');
    if (await tableExists(conn, 'despesas')) await ensureIndex(conn, 'despesas', 'idx_despesas_tenant_id', 'tenant_id');
    if (await tableExists(conn, 'pagamentos')) await ensureIndex(conn, 'pagamentos', 'idx_pagamentos_tenant_id', 'tenant_id');
    if (await tableExists(conn, 'audit_log')) await ensureIndex(conn, 'audit_log', 'idx_audit_log_tenant_id', 'tenant_id');

    console.log('MULTI_TENANT_MIGRATION_OK');
  } finally {
    await conn.end();
  }
}

run().catch((err) => {
  console.error('MULTI_TENANT_MIGRATION_ERR', err.message);
  process.exit(1);
});
