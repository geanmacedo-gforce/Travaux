import bcrypt from 'bcryptjs';
import type { ResultSetHeader } from 'mysql2';
import { query, getOne, getPool } from './db';
import { generateToken } from './jwt';

function normalizeTenantSlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function normalizeTenantCode(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 20);
}

export interface UserRow {
  id: string;
  tenant_id: string;
  email: string;
  password_hash: string;
  ativo: boolean;
  must_change_password?: boolean;
  created_at: string;
}

export interface TenantRow {
  id: string;
  nome: string;
  slug: string;
  code: string;
  ativo: boolean;
  created_at: string;
}

export interface ProfileRow {
  id: string;
  tenant_id: string;
  user_id: string | null;
  nome: string;
  email: string;
  telefone: string | null;
  ativo: boolean;
  funcionario_id: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRoleRow {
  id: string;
  tenant_id: string;
  user_id: string;
  role: 'proprietario' | 'gerente' | 'funcionario' | 'admin';
  created_at: string;
}

export async function findTenantBySlug(slug: string): Promise<TenantRow | null> {
  const normalized = normalizeTenantSlug(slug);
  return getOne<TenantRow>(
    'SELECT id, nome, slug, code, ativo, created_at FROM tenants WHERE slug = ? LIMIT 1',
    [normalized]
  );
}

export async function findTenantByCode(code: string): Promise<TenantRow | null> {
  const normalized = normalizeTenantCode(code);
  return getOne<TenantRow>(
    'SELECT id, nome, slug, code, ativo, created_at FROM tenants WHERE code = ? LIMIT 1',
    [normalized]
  );
}

export async function createTenant(nome: string, slugInput?: string, codeInput?: string): Promise<TenantRow> {
  const normalized = normalizeTenantSlug(slugInput || nome);
  const normalizedCode = normalizeTenantCode(codeInput || slugInput || nome);
  if (!normalized) {
    throw new Error('Informe um codigo valido para a empresa (tenant).');
  }
  if (!normalizedCode) {
    throw new Error('Informe um codigo da empresa valido.');
  }

  const existing = await findTenantBySlug(normalized);
  if (existing) {
    throw new Error('Ja existe uma empresa com este codigo de tenant.');
  }

  const existingCode = await findTenantByCode(normalizedCode);
  if (existingCode) {
    throw new Error('Ja existe uma empresa com este codigo da empresa.');
  }

  const tenantId = crypto.randomUUID();
  await query('INSERT INTO tenants (id, nome, slug, code, ativo) VALUES (?, ?, ?, ?, ?)', [
    tenantId,
    nome,
    normalized,
    normalizedCode,
    true,
  ]);

  const created = await getOne<TenantRow>(
    'SELECT id, nome, slug, code, ativo, created_at FROM tenants WHERE id = ? LIMIT 1',
    [tenantId]
  );

  if (!created) {
    throw new Error('Tenant criado, mas nao foi encontrado no banco.');
  }

  return created;
}

export async function findUserByEmailInTenant(email: string, tenantId: string): Promise<UserRow | null> {
  return getOne<UserRow>(
    'SELECT id, tenant_id, email, password_hash, ativo, created_at FROM users WHERE email = ? AND tenant_id = ? LIMIT 1',
    [email, tenantId]
  );
}

export async function findUserById(userId: string, tenantId: string): Promise<UserRow | null> {
  return getOne<UserRow>(
    'SELECT id, tenant_id, email, password_hash, ativo, created_at FROM users WHERE id = ? AND tenant_id = ? LIMIT 1',
    [userId, tenantId]
  );
}

export async function getUserRole(userId: string, tenantId: string): Promise<string | null> {
  const row = await getOne<{ role: string }>(
    'SELECT role FROM user_roles WHERE user_id = ? AND tenant_id = ? LIMIT 1',
    [userId, tenantId]
  );
  return row?.role ?? null;
}

export async function getUserProfile(userId: string, tenantId: string): Promise<(ProfileRow & { role: string | null }) | null> {
  const profile = await getOne<ProfileRow>(
    'SELECT id, tenant_id, user_id, nome, email, telefone, ativo, funcionario_id, avatar_url, created_at, updated_at FROM profiles WHERE user_id = ? AND tenant_id = ? LIMIT 1',
    [userId, tenantId]
  );

  if (!profile) return null;

  const role = await getUserRole(userId, tenantId);

  return {
    ...profile,
    role,
  };
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

async function ensureMustChangePasswordColumn() {
  const [rows] = await query<{ total: number }>(
    `SELECT COUNT(*) AS total
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'users'
       AND COLUMN_NAME = 'must_change_password'`
  );

  if (Number(rows?.[0]?.total ?? 0) === 0) {
    await query('ALTER TABLE users ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0');
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function loginUser(
  email: string,
  password: string
): Promise<{ token: string; user: any } | { error: string }> {
  await ensureMustChangePasswordColumn();

  const [candidates] = await query<
    UserRow & {
      tenant_nome: string;
      tenant_ativo: boolean;
      must_change_password: boolean;
    }
  >(
    `SELECT u.id, u.tenant_id, u.email, u.password_hash, u.ativo, u.must_change_password, u.created_at,
            t.nome AS tenant_nome, t.ativo AS tenant_ativo
     FROM users u
     INNER JOIN tenants t ON t.id = u.tenant_id
     WHERE u.email = ?
     LIMIT 2`,
    [email]
  );

  if (!candidates || candidates.length === 0) {
    return { error: 'Usuario nao encontrado' };
  }

  if (candidates.length > 1) {
    return { error: 'Este e-mail esta vinculado a mais de uma empresa. Procure o suporte para ajustar o acesso.' };
  }

  const user = candidates[0];

  if (!user.tenant_ativo) {
    return { error: 'Empresa (tenant) nao encontrada ou inativa' };
  }

  if (!user) {
    return { error: 'Usuario nao encontrado para esta empresa' };
  }

  if (!user.ativo) {
    return { error: 'Sua conta aguarda aprovação do administrador' };
  }

  const isValid = await verifyPassword(password, user.password_hash);

  if (!isValid) {
    return { error: 'Email ou senha incorretos' };
  }

  const role = await getUserRole(user.id, user.tenant_id);
  const profile = await getUserProfile(user.id, user.tenant_id);

  const token = generateToken({
    userId: user.id,
    tenantId: user.tenant_id,
    email: user.email,
    role: (role as any) || 'funcionario',
  });

  return {
    token,
    user: {
      id: user.id,
      tenant_id: user.tenant_id,
      email: user.email,
      must_change_password: Boolean(user.must_change_password),
      profile,
    },
  };
}

export async function createUser(
  email: string,
  password: string,
  nome: string,
  role: string = 'funcionario',
  funcionario_id?: string | null,
  options?: { tenantId?: string; tenantSlug?: string; tenantName?: string; tenantCode?: string }
): Promise<{ user: UserRow } | { error: string }> {
  await ensureMustChangePasswordColumn();

  let tenantId = options?.tenantId;

  if (!tenantId && options?.tenantCode) {
    const tenant = await findTenantByCode(options.tenantCode);
    if (!tenant || !tenant.ativo) {
      return { error: 'Codigo da empresa nao encontrado ou inativo' };
    }
    tenantId = tenant.id;
  }

  if (!tenantId && options?.tenantSlug) {
    const tenant = await findTenantBySlug(options.tenantSlug);
    if (!tenant || !tenant.ativo) {
      return { error: 'Empresa (tenant) nao encontrada ou inativa' };
    }
    tenantId = tenant.id;
  }

  if (!tenantId && options?.tenantName) {
    try {
      const tenant = await createTenant(options.tenantName, options.tenantSlug, options.tenantCode);
      tenantId = tenant.id;
      if (role === 'funcionario') {
        role = 'proprietario';
      }
    } catch (error: any) {
      return { error: error?.message || 'Falha ao criar empresa (tenant)' };
    }
  }

  if (!tenantId) {
    return { error: 'Tenant nao informado. Informe tenantId ou codigo da empresa.' };
  }

  const existing = await findUserByEmailInTenant(email, tenantId);
  if (existing) {
    return { error: 'Usuario ja existe nesta empresa' };
  }

  let conn: Awaited<ReturnType<Awaited<ReturnType<typeof getPool>>['getConnection']>> | null = null;

  try {
    const pool = await getPool();
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const hashedPassword = await hashPassword(password);
    const userId = crypto.randomUUID();
    const profileId = crypto.randomUUID();

    const [countRows] = await conn.execute<any[]>(
      'SELECT COUNT(*) AS total FROM users WHERE tenant_id = ? FOR UPDATE',
      [tenantId]
    );
    const totalUsers = Number((countRows as any[])?.[0]?.total ?? 0);
    const isFirstUserInTenant = totalUsers === 0;
    const assignedRole = isFirstUserInTenant ? 'proprietario' : role;
    if (!isFirstUserInTenant && assignedRole === 'proprietario') {
      throw new Error('Apenas o primeiro usuario do tenant pode ser Proprietario.');
    }
    const isActive = isFirstUserInTenant;
    const mustChangePassword = !isFirstUserInTenant;

    // Create user
    const [userInsert] = await conn.execute<ResultSetHeader>(
      'INSERT INTO users (id, tenant_id, email, password_hash, ativo, must_change_password) VALUES (?, ?, ?, ?, ?, ?)',
      [
      userId,
      tenantId,
      email,
      hashedPassword,
      isActive,
      mustChangePassword,
      ]
    );
    if (userInsert.affectedRows !== 1) {
      throw new Error('Falha ao inserir usuario na tabela users.');
    }

    // Create profile
    const [profileInsert] = await conn.execute<ResultSetHeader>(
      'INSERT INTO profiles (id, tenant_id, user_id, nome, email, ativo, funcionario_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [profileId, tenantId, userId, nome, email, isActive, funcionario_id || null]
    );
    if (profileInsert.affectedRows !== 1) {
      throw new Error('Falha ao inserir perfil do usuario.');
    }

    // Assign role
    const [roleInsert] = await conn.execute<ResultSetHeader>('INSERT INTO user_roles (id, tenant_id, user_id, role) VALUES (?, ?, ?, ?)', [
      crypto.randomUUID(),
      tenantId,
      userId,
      assignedRole,
    ]);
    if (roleInsert.affectedRows !== 1) {
      throw new Error('Falha ao inserir papel do usuario.');
    }

    await conn.commit();
    conn.release();
    conn = null;

    const newUser = await findUserById(userId, tenantId);
    if (!newUser) {
      return { error: 'Usuario criado, mas nao foi encontrado na tabela users.' };
    }

    return { user: newUser! };
  } catch (error: any) {
    if (conn) {
      try {
        await conn.rollback();
      } catch {
        // noop
      }
      conn.release();
    }

    if (error?.code === 'ECONNREFUSED') {
      const host = process.env.DB_HOST || 'localhost';
      const port = process.env.DB_PORT || '3306';
      return {
        error: `Nao foi possivel conectar ao MySQL em ${host}:${port} (ECONNREFUSED). Verifique o servidor e as variaveis DB_HOST/DB_PORT.`,
      };
    }

    if (error?.code === 'ER_ACCESS_DENIED_ERROR') {
      return {
        error: 'Acesso negado ao MySQL. Verifique DB_USER e DB_PASSWORD.',
      };
    }

    if (error?.code === 'ER_BAD_DB_ERROR') {
      return {
        error: 'Banco de dados nao encontrado. Verifique DB_NAME.',
      };
    }

    return { error: error.message };
  }
}

export async function updateUserPassword(userId: string, newPassword: string, tenantId?: string): Promise<boolean> {
  try {
    if (!tenantId) {
      return false;
    }
    await ensureMustChangePasswordColumn();
    const hashedPassword = await hashPassword(newPassword);
    await query('UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ? AND tenant_id = ?', [hashedPassword, userId, tenantId]);
    return true;
  } catch {
    return false;
  }
}

export async function changeOwnPassword(userId: string, newPassword: string, tenantId?: string): Promise<boolean> {
  try {
    if (!tenantId) {
      return false;
    }
    await ensureMustChangePasswordColumn();
    const hashedPassword = await hashPassword(newPassword);
    await query('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ? AND tenant_id = ?', [hashedPassword, userId, tenantId]);
    return true;
  } catch {
    return false;
  }
}

export async function changeUserRole(userId: string, newRole: string, tenantId?: string): Promise<boolean> {
  try {
    if (!tenantId) {
      return false;
    }
    await query('DELETE FROM user_roles WHERE user_id = ? AND tenant_id = ?', [userId, tenantId]);
    await query('INSERT INTO user_roles (id, tenant_id, user_id, role) VALUES (?, ?, ?, ?)', [
      crypto.randomUUID(),
      tenantId,
      userId,
      newRole,
    ]);
    return true;
  } catch {
    return false;
  }
}
