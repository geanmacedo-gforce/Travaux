DELIMITER $$

DROP PROCEDURE IF EXISTS ensure_profiles_avatar_url_longtext $$
CREATE PROCEDURE ensure_profiles_avatar_url_longtext()
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'profiles'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'profiles'
        AND COLUMN_NAME = 'avatar_url'
    ) THEN
      ALTER TABLE profiles
        MODIFY COLUMN avatar_url LONGTEXT NULL;
    END IF;
  END IF;
END $$

DELIMITER ;

CALL ensure_profiles_avatar_url_longtext();
DROP PROCEDURE IF EXISTS ensure_profiles_avatar_url_longtext;
