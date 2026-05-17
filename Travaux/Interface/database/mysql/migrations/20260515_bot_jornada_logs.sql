-- =====================================================
-- Migration: Bot jornada logs and resilient session state
-- =====================================================

CREATE TABLE IF NOT EXISTS bot_jornada_sessoes (
  id CHAR(36) NOT NULL,
  tenant_id CHAR(36) NOT NULL,
  funcionario_id CHAR(36) NOT NULL,
  telefone VARCHAR(30) NOT NULL,
  mensagem_inicio_id VARCHAR(100) NOT NULL,
  status ENUM('aberta','escolhendo_obra','confirmando_obra','confirmando_localizacao','trabalhando','selecionando_almoco','finalizada','cancelada') NOT NULL DEFAULT 'aberta',
  etapa_atual VARCHAR(40) NOT NULL DEFAULT 'aberta',
  obra_id CHAR(36) NULL,
  obra_label VARCHAR(255) NULL,
  checkin_at DATETIME NULL,
  checkout_at DATETIME NULL,
  duracao_minutos INT UNSIGNED NULL,
  almoco_minutos TINYINT UNSIGNED NULL,
  localizacao_json JSON NULL,
  ultima_mensagem_id VARCHAR(100) NULL,
  ultima_mensagem_texto TEXT NULL,
  ultimo_evento VARCHAR(60) NULL,
  finalizada_em TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_bot_jornada_sessoes_inicio (tenant_id, mensagem_inicio_id),
  KEY idx_bot_jornada_sessoes_tenant_func (tenant_id, funcionario_id),
  KEY idx_bot_jornada_sessoes_status (tenant_id, status),
  CONSTRAINT fk_bot_jornada_sessoes_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_bot_jornada_sessoes_funcionario FOREIGN KEY (tenant_id, funcionario_id) REFERENCES funcionarios(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_bot_jornada_sessoes_obra FOREIGN KEY (tenant_id, obra_id) REFERENCES obras(tenant_id, id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bot_jornada_eventos (
  id CHAR(36) NOT NULL,
  tenant_id CHAR(36) NOT NULL,
  funcionario_id CHAR(36) NOT NULL,
  sessao_id CHAR(36) NULL,
  message_id VARCHAR(100) NOT NULL,
  evento VARCHAR(60) NOT NULL,
  etapa_anterior VARCHAR(40) NULL,
  etapa_nova VARCHAR(40) NULL,
  payload JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_bot_jornada_eventos_message (tenant_id, message_id),
  KEY idx_bot_jornada_eventos_sessao (tenant_id, sessao_id, created_at),
  KEY idx_bot_jornada_eventos_funcionario (tenant_id, funcionario_id, created_at),
  CONSTRAINT fk_bot_jornada_eventos_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_bot_jornada_eventos_funcionario FOREIGN KEY (tenant_id, funcionario_id) REFERENCES funcionarios(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_bot_jornada_eventos_sessao FOREIGN KEY (sessao_id) REFERENCES bot_jornada_sessoes(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE horas_trabalhadas
  ADD COLUMN bot_sessao_id CHAR(36) NULL AFTER descricao,
  ADD KEY idx_horas_bot_sessao (bot_sessao_id);
