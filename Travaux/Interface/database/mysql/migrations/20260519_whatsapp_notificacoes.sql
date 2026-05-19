-- =====================================================
-- Migration: WhatsApp notifications for payments
-- =====================================================
-- Adds flg_envio_funcionario and flg_vld_funcionario
-- columns to pagamentos, and creates the outgoing
-- message queue table (bot_mensagens_pendentes).
-- =====================================================

-- Add WhatsApp notification flags to pagamentos (MySQL-compatible conditional ADD)
DROP PROCEDURE IF EXISTS _travaux_add_payment_flags;
DELIMITER $$
CREATE PROCEDURE _travaux_add_payment_flags()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'pagamentos'
      AND COLUMN_NAME  = 'flg_envio_funcionario'
  ) THEN
    ALTER TABLE pagamentos
      ADD COLUMN flg_envio_funcionario INT NOT NULL DEFAULT 0
        COMMENT '1 = notificação enviada ao funcionário via WhatsApp';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'pagamentos'
      AND COLUMN_NAME  = 'flg_vld_funcionario'
  ) THEN
    ALTER TABLE pagamentos
      ADD COLUMN flg_vld_funcionario INT NOT NULL DEFAULT 0
        COMMENT '1 = funcionário respondeu 1 confirmando o recebimento';
  END IF;
END$$
DELIMITER ;
CALL _travaux_add_payment_flags();
DROP PROCEDURE IF EXISTS _travaux_add_payment_flags;

-- Queue table for outgoing WhatsApp messages
CREATE TABLE IF NOT EXISTS bot_mensagens_pendentes (
  id              CHAR(36)     NOT NULL,
  tenant_id       CHAR(36)     NOT NULL,
  pagamento_id    CHAR(36)     NOT NULL,
  funcionario_id  CHAR(36)     NOT NULL,
  mensagem        TEXT         NOT NULL,
  status          ENUM('pendente','enviado','erro') NOT NULL DEFAULT 'pendente',
  tentativas      INT          NOT NULL DEFAULT 0,
  ultimo_erro     TEXT         NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_bot_msg_status   (status),
  KEY idx_bot_msg_tenant   (tenant_id),
  KEY idx_bot_msg_pagamento (pagamento_id),
  CONSTRAINT fk_bot_msg_tenant     FOREIGN KEY (tenant_id)      REFERENCES tenants(id)       ON DELETE CASCADE,
  CONSTRAINT fk_bot_msg_funcionario FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
