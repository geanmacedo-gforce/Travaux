-- =====================================================
-- Migration: Add WhatsApp message correlation field
-- =====================================================
-- Stores the WhatsApp message id for each outgoing
-- notification so replies can be correlated to the
-- exact payment/vale question.
-- =====================================================

DROP PROCEDURE IF EXISTS _travaux_add_whatsapp_message_id;
DELIMITER $$
CREATE PROCEDURE _travaux_add_whatsapp_message_id()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'bot_mensagens_pendentes'
      AND COLUMN_NAME = 'whatsapp_message_id'
  ) THEN
    ALTER TABLE bot_mensagens_pendentes
      ADD COLUMN whatsapp_message_id VARCHAR(100) NULL
        COMMENT 'Id da mensagem WhatsApp enviada para correlacionar resposta';
  END IF;
END$$
DELIMITER ;
CALL _travaux_add_whatsapp_message_id();
DROP PROCEDURE IF EXISTS _travaux_add_whatsapp_message_id;
