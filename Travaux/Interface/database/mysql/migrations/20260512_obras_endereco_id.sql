-- Migration: normalize obras.endereco into obras.endereco_id
-- Target: MySQL 5.7+

CREATE TABLE IF NOT EXISTS enderecos_obras (
  id CHAR(36) NOT NULL,
  tenant_id CHAR(36) NOT NULL,
  logradouro VARCHAR(191) NULL,
  numero VARCHAR(30) NULL,
  complemento VARCHAR(120) NULL,
  bairro VARCHAR(120) NULL,
  cidade VARCHAR(120) NULL,
  estado CHAR(2) NULL,
  cep VARCHAR(10) NULL,
  referencia VARCHAR(255) NULL,
  endereco_texto VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_enderecos_obras_tenant_id_id (tenant_id, id),
  KEY idx_enderecos_obras_tenant_id (tenant_id),
  CONSTRAINT fk_enderecos_obras_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DELIMITER $$

DROP PROCEDURE IF EXISTS ensure_obras_endereco_id_column $$
CREATE PROCEDURE ensure_obras_endereco_id_column()
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'obras'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'obras' AND COLUMN_NAME = 'endereco_id'
  ) THEN
    ALTER TABLE obras ADD COLUMN endereco_id CHAR(36) NULL AFTER tipo_servico;
  END IF;
END $$

DROP PROCEDURE IF EXISTS ensure_obras_endereco_fk $$
CREATE PROCEDURE ensure_obras_endereco_fk()
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'obras'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'obras' AND COLUMN_NAME = 'endereco_id'
  )
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.REFERENTIAL_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'obras'
      AND CONSTRAINT_NAME = 'fk_obras_endereco_tenant'
  ) THEN
    ALTER TABLE obras
      ADD CONSTRAINT fk_obras_endereco_tenant
      FOREIGN KEY (tenant_id, endereco_id)
      REFERENCES enderecos_obras(tenant_id, id)
      ON DELETE SET NULL;
  END IF;
END $$

DROP PROCEDURE IF EXISTS ensure_obras_endereco_index $$
CREATE PROCEDURE ensure_obras_endereco_index()
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'obras'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'obras' AND COLUMN_NAME = 'endereco_id'
  )
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'obras' AND INDEX_NAME = 'idx_obras_endereco_id'
  ) THEN
    CREATE INDEX idx_obras_endereco_id ON obras (endereco_id);
  END IF;
END $$

DROP PROCEDURE IF EXISTS migrate_obras_endereco_data $$
CREATE PROCEDURE migrate_obras_endereco_data()
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'obras'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'obras' AND COLUMN_NAME = 'endereco'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'obras' AND COLUMN_NAME = 'endereco_id'
  ) THEN
    CREATE TEMPORARY TABLE IF NOT EXISTS tmp_obras_endereco_map (
      obra_id CHAR(36) NOT NULL,
      tenant_id CHAR(36) NOT NULL,
      endereco_id CHAR(36) NOT NULL,
      PRIMARY KEY (obra_id)
    ) ENGINE=InnoDB;

    TRUNCATE TABLE tmp_obras_endereco_map;

    INSERT INTO tmp_obras_endereco_map (obra_id, tenant_id, endereco_id)
    SELECT o.id, o.tenant_id, UUID()
    FROM obras o
    WHERE (o.endereco_id IS NULL OR TRIM(o.endereco_id) = '')
      AND o.endereco IS NOT NULL
      AND TRIM(o.endereco) <> '';

    INSERT INTO enderecos_obras (id, tenant_id, endereco_texto)
    SELECT m.endereco_id, m.tenant_id, o.endereco
    FROM tmp_obras_endereco_map m
    INNER JOIN obras o
      ON o.id = m.obra_id
     AND o.tenant_id = m.tenant_id;

    UPDATE obras o
    INNER JOIN tmp_obras_endereco_map m
      ON o.id = m.obra_id
     AND o.tenant_id = m.tenant_id
    SET o.endereco_id = m.endereco_id;

    DROP TEMPORARY TABLE IF EXISTS tmp_obras_endereco_map;
  END IF;
END $$

DROP PROCEDURE IF EXISTS drop_obras_endereco_column $$
CREATE PROCEDURE drop_obras_endereco_column()
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'obras' AND COLUMN_NAME = 'endereco'
  ) THEN
    ALTER TABLE obras DROP COLUMN endereco;
  END IF;
END $$

DELIMITER ;

CALL ensure_obras_endereco_id_column();
CALL ensure_obras_endereco_index();
CALL migrate_obras_endereco_data();
CALL ensure_obras_endereco_fk();
CALL drop_obras_endereco_column();

DROP PROCEDURE IF EXISTS ensure_obras_endereco_id_column;
DROP PROCEDURE IF EXISTS ensure_obras_endereco_fk;
DROP PROCEDURE IF EXISTS ensure_obras_endereco_index;
DROP PROCEDURE IF EXISTS migrate_obras_endereco_data;
DROP PROCEDURE IF EXISTS drop_obras_endereco_column;
