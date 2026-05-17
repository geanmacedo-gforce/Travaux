DELIMITER $$

DROP PROCEDURE IF EXISTS ensure_profiles_endereco $$
CREATE PROCEDURE ensure_profiles_endereco()
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'profiles'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'profiles'
      AND COLUMN_NAME = 'endereco'
  ) THEN
    ALTER TABLE profiles
      ADD COLUMN endereco VARCHAR(255) NULL AFTER email;
  END IF;
END $$

DROP PROCEDURE IF EXISTS ensure_tenants_financeiro_columns $$
CREATE PROCEDURE ensure_tenants_financeiro_columns()
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tenants'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'tenants'
        AND COLUMN_NAME = 'billing_email'
    ) THEN
      ALTER TABLE tenants
        ADD COLUMN billing_email VARCHAR(255) NULL AFTER bot_permite_checkin_fora_raio;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'tenants'
        AND COLUMN_NAME = 'payment_method'
    ) THEN
      ALTER TABLE tenants
        ADD COLUMN payment_method VARCHAR(120) NULL AFTER billing_email;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'tenants'
        AND COLUMN_NAME = 'payment_last4'
    ) THEN
      ALTER TABLE tenants
        ADD COLUMN payment_last4 VARCHAR(4) NULL AFTER payment_method;
    END IF;
  END IF;
END $$

DROP PROCEDURE IF EXISTS ensure_tenant_faturas_servico $$
CREATE PROCEDURE ensure_tenant_faturas_servico()
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tenant_faturas_servico'
  ) THEN
    CREATE TABLE tenant_faturas_servico (
      id CHAR(36) NOT NULL,
      tenant_id CHAR(36) NOT NULL,
      referencia VARCHAR(20) NOT NULL,
      valor DECIMAL(10,2) NOT NULL,
      moeda VARCHAR(10) NOT NULL DEFAULT 'BRL',
      status ENUM('pending','paid','failed','canceled') NOT NULL DEFAULT 'pending',
      pago_em DATETIME NULL,
      criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_faturas_servico_tenant_ref (tenant_id, referencia),
      KEY idx_faturas_servico_tenant_status (tenant_id, status),
      CONSTRAINT fk_faturas_servico_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  END IF;
END $$

DELIMITER ;

CALL ensure_profiles_endereco();
CALL ensure_tenants_financeiro_columns();
CALL ensure_tenant_faturas_servico();

DROP PROCEDURE IF EXISTS ensure_profiles_endereco;
DROP PROCEDURE IF EXISTS ensure_tenants_financeiro_columns;
DROP PROCEDURE IF EXISTS ensure_tenant_faturas_servico;
