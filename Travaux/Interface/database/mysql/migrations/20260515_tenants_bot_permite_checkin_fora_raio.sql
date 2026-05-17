DELIMITER $$

DROP PROCEDURE IF EXISTS ensure_tenants_bot_permite_checkin_fora_raio $$
CREATE PROCEDURE ensure_tenants_bot_permite_checkin_fora_raio()
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tenants'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tenants'
      AND COLUMN_NAME = 'bot_permite_checkin_fora_raio'
  ) THEN
    ALTER TABLE tenants
      ADD COLUMN bot_permite_checkin_fora_raio TINYINT(1) NOT NULL DEFAULT 0 AFTER ativo;
  END IF;
END $$

DELIMITER ;

CALL ensure_tenants_bot_permite_checkin_fora_raio();

DROP PROCEDURE IF EXISTS ensure_tenants_bot_permite_checkin_fora_raio;
