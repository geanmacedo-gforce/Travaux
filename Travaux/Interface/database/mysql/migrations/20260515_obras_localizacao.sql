DELIMITER $$

DROP PROCEDURE IF EXISTS ensure_obras_localizacao_columns $$
CREATE PROCEDURE ensure_obras_localizacao_columns()
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'obras'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'obras'
        AND COLUMN_NAME = 'lat'
    ) THEN
      ALTER TABLE obras ADD COLUMN lat DECIMAL(10,8) NULL AFTER endereco;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'obras'
        AND COLUMN_NAME = 'lng'
    ) THEN
      ALTER TABLE obras ADD COLUMN lng DECIMAL(11,8) NULL AFTER lat;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'obras'
        AND COLUMN_NAME = 'raio'
    ) THEN
      ALTER TABLE obras ADD COLUMN raio INT UNSIGNED NULL AFTER lng;
    END IF;
  END IF;
END $$

DELIMITER ;

CALL ensure_obras_localizacao_columns();

DROP PROCEDURE IF EXISTS ensure_obras_localizacao_columns;