-- Multi-tenant migration for shared MySQL database
-- Compatible with MySQL 5.7+ (without ALTER TABLE ... IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS tenants (
  id CHAR(36) PRIMARY KEY,
  nome VARCHAR(150) NOT NULL,
  slug VARCHAR(120) NOT NULL,
  code VARCHAR(30) NOT NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tenants_slug (slug),
  UNIQUE KEY uq_tenants_code (code)
);

INSERT INTO tenants (id, nome, slug, code, ativo)
SELECT UUID(), 'Tenant Default', 'default', 'DEFAULT', 1
WHERE NOT EXISTS (SELECT 1 FROM tenants WHERE slug = 'default');

SET @default_tenant_id := (SELECT id FROM tenants WHERE slug = 'default' LIMIT 1);

DELIMITER $$

DROP PROCEDURE IF EXISTS ensure_tenant_column $$
CREATE PROCEDURE ensure_tenant_column(IN p_table VARCHAR(64))
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND COLUMN_NAME = 'tenant_id'
    ) THEN
      SET @sql := CONCAT('ALTER TABLE `', p_table, '` ADD COLUMN tenant_id CHAR(36) NULL AFTER id');
      PREPARE stmt FROM @sql;
      EXECUTE stmt;
      DEALLOCATE PREPARE stmt;
    END IF;

    SET @sql := CONCAT('UPDATE `', p_table, '` SET tenant_id = ''', @default_tenant_id, ''' WHERE tenant_id IS NULL');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;

    SET @sql := CONCAT('ALTER TABLE `', p_table, '` MODIFY tenant_id CHAR(36) NOT NULL');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$

DROP PROCEDURE IF EXISTS ensure_index $$
CREATE PROCEDURE ensure_index(IN p_table VARCHAR(64), IN p_index VARCHAR(64), IN p_cols VARCHAR(255))
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND INDEX_NAME = p_index
  ) THEN
    SET @sql := CONCAT('CREATE INDEX `', p_index, '` ON `', p_table, '` (', p_cols, ')');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$

DROP PROCEDURE IF EXISTS ensure_unique_index $$
CREATE PROCEDURE ensure_unique_index(IN p_table VARCHAR(64), IN p_index VARCHAR(64), IN p_cols VARCHAR(255))
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND INDEX_NAME = p_index
  ) THEN
    SET @sql := CONCAT('CREATE UNIQUE INDEX `', p_index, '` ON `', p_table, '` (', p_cols, ')');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$

DROP PROCEDURE IF EXISTS ensure_tenants_code $$
CREATE PROCEDURE ensure_tenants_code()
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND COLUMN_NAME = 'code'
    ) THEN
      ALTER TABLE tenants ADD COLUMN code VARCHAR(30) NULL AFTER slug;
    END IF;

    UPDATE tenants
       SET code = UPPER(REPLACE(slug, '-', ''))
     WHERE code IS NULL OR TRIM(code) = '';

    ALTER TABLE tenants MODIFY code VARCHAR(30) NOT NULL;
  END IF;
END $$

DELIMITER ;

CALL ensure_tenants_code();

CALL ensure_tenant_column('users');
CALL ensure_tenant_column('profiles');
CALL ensure_tenant_column('user_roles');
CALL ensure_tenant_column('clientes');
CALL ensure_tenant_column('funcionarios');
CALL ensure_tenant_column('obras');
CALL ensure_tenant_column('produtos');
CALL ensure_tenant_column('horas_trabalhadas');
CALL ensure_tenant_column('materiais_usados');
CALL ensure_tenant_column('despesas');
CALL ensure_tenant_column('pagamentos');
CALL ensure_tenant_column('audit_log');

CALL ensure_index('users', 'idx_users_tenant_id', 'tenant_id');
CALL ensure_index('users', 'idx_users_tenant_email', 'tenant_id, email');
CALL ensure_index('profiles', 'idx_profiles_tenant_id', 'tenant_id');
CALL ensure_index('profiles', 'idx_profiles_tenant_user', 'tenant_id, user_id');
CALL ensure_index('user_roles', 'idx_user_roles_tenant_id', 'tenant_id');
CALL ensure_index('user_roles', 'idx_user_roles_tenant_user', 'tenant_id, user_id');
CALL ensure_index('clientes', 'idx_clientes_tenant_id', 'tenant_id');
CALL ensure_index('funcionarios', 'idx_funcionarios_tenant_id', 'tenant_id');
CALL ensure_index('obras', 'idx_obras_tenant_id', 'tenant_id');
CALL ensure_index('produtos', 'idx_produtos_tenant_id', 'tenant_id');
CALL ensure_index('horas_trabalhadas', 'idx_horas_trabalhadas_tenant_id', 'tenant_id');
CALL ensure_index('materiais_usados', 'idx_materiais_usados_tenant_id', 'tenant_id');
CALL ensure_index('despesas', 'idx_despesas_tenant_id', 'tenant_id');
CALL ensure_index('pagamentos', 'idx_pagamentos_tenant_id', 'tenant_id');
CALL ensure_index('audit_log', 'idx_audit_log_tenant_id', 'tenant_id');
CALL ensure_unique_index('tenants', 'uq_tenants_code', 'code');

DROP PROCEDURE IF EXISTS ensure_tenant_column;
DROP PROCEDURE IF EXISTS ensure_index;
DROP PROCEDURE IF EXISTS ensure_unique_index;
DROP PROCEDURE IF EXISTS ensure_tenants_code;

-- Optional hardening (enable after validating existing unique index names in your DB):
-- ALTER TABLE users DROP INDEX email;
-- ALTER TABLE users ADD UNIQUE KEY uq_users_tenant_email (tenant_id, email);
