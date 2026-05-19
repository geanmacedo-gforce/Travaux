-- =====================================================
-- TRAVAUX - MySQL Full Multi-tenant Schema
-- =====================================================
-- This script creates all core tables using shared database
-- with strict tenant isolation.
--
-- Suggested execution:
--   mysql -u <user> -p <database> < schema_multitenant_full.sql
--
-- MySQL: 8.0+
-- =====================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------
-- Tenants
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
  id CHAR(36) NOT NULL,
  nome VARCHAR(150) NOT NULL,
  slug VARCHAR(120) NOT NULL,
  code VARCHAR(30) NOT NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  bot_permite_checkin_fora_raio TINYINT(1) NOT NULL DEFAULT 0,
  billing_email VARCHAR(255) NULL,
  payment_method VARCHAR(120) NULL,
  payment_last4 VARCHAR(4) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tenants_slug (slug),
  UNIQUE KEY uq_tenants_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Users / Auth
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL,
  tenant_id CHAR(36) NOT NULL,
  email VARCHAR(191) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_tenant_email (tenant_id, email),
  UNIQUE KEY uq_users_tenant_id_id (tenant_id, id),
  KEY idx_users_tenant_id (tenant_id),
  CONSTRAINT fk_users_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_roles (
  id CHAR(36) NOT NULL,
  tenant_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  role ENUM('proprietario','admin','gerente','funcionario') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_roles_tenant_user_role (tenant_id, user_id, role),
  UNIQUE KEY uq_user_roles_tenant_id_id (tenant_id, id),
  KEY idx_user_roles_tenant_id (tenant_id),
  KEY idx_user_roles_user (user_id),
  CONSTRAINT fk_user_roles_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_user_roles_user_tenant FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Business entities
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS clientes (
  id CHAR(36) NOT NULL,
  tenant_id CHAR(36) NOT NULL,
  nome VARCHAR(191) NOT NULL,
  documento VARCHAR(30) NULL,
  telefone VARCHAR(30) NULL,
  email VARCHAR(191) NULL,
  rua VARCHAR(191) NULL,
  numero VARCHAR(30) NULL,
  bairro VARCHAR(120) NULL,
  cidade VARCHAR(120) NULL,
  estado VARCHAR(2) NULL,
  cep VARCHAR(15) NULL,
  observacoes TEXT NULL,
  arquivado TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_clientes_tenant_id_id (tenant_id, id),
  KEY idx_clientes_tenant_id (tenant_id),
  KEY idx_clientes_nome (nome),
  CONSTRAINT fk_clientes_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS funcionarios (
  id CHAR(36) NOT NULL,
  tenant_id CHAR(36) NOT NULL,
  nome VARCHAR(191) NOT NULL,
  cpf VARCHAR(20) NULL,
  telefone VARCHAR(30) NULL,
  funcao ENUM('drywall','masticagem','auxiliar','outro') NOT NULL DEFAULT 'auxiliar',
  tipo_remuneracao ENUM('hora','diaria','mensal') NOT NULL DEFAULT 'hora',
  valor DECIMAL(12,2) NOT NULL DEFAULT 0,
  banco VARCHAR(120) NULL,
  agencia VARCHAR(30) NULL,
  conta VARCHAR(30) NULL,
  pix VARCHAR(191) NULL,
  status ENUM('ativo','afastado','desligado') NOT NULL DEFAULT 'ativo',
  observacoes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_funcionarios_tenant_id_id (tenant_id, id),
  KEY idx_funcionarios_tenant_id (tenant_id),
  KEY idx_funcionarios_nome (nome),
  CONSTRAINT fk_funcionarios_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS profiles (
  id CHAR(36) NOT NULL,
  tenant_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  nome VARCHAR(191) NOT NULL,
  email VARCHAR(191) NOT NULL,
  endereco VARCHAR(255) NULL,
  telefone VARCHAR(30) NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  funcionario_id CHAR(36) NULL,
  avatar_url LONGTEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_profiles_tenant_user (tenant_id, user_id),
  UNIQUE KEY uq_profiles_tenant_id_id (tenant_id, id),
  KEY idx_profiles_tenant_id (tenant_id),
  KEY idx_profiles_funcionario (funcionario_id),
  CONSTRAINT fk_profiles_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_profiles_user_tenant FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_profiles_funcionario FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tenant_faturas_servico (
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

CREATE TABLE IF NOT EXISTS obras (
  id CHAR(36) NOT NULL,
  tenant_id CHAR(36) NOT NULL,
  nome VARCHAR(191) NOT NULL,
  cliente_id CHAR(36) NULL,
  tipo_servico ENUM('drywall','masticagem','drywall_masticagem') NOT NULL DEFAULT 'drywall',
  endereco VARCHAR(255) NULL,
  lat DECIMAL(10,8) NULL,
  lng DECIMAL(11,8) NULL,
  raio INT UNSIGNED NULL,
  data_inicio DATE NULL,
  data_termino_prevista DATE NULL,
  valor_contratado DECIMAL(14,2) NOT NULL DEFAULT 0,
  status ENUM('orcamento','em_andamento','pausada','concluida','cancelada') NOT NULL DEFAULT 'orcamento',
  descricao TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_obras_tenant_id_id (tenant_id, id),
  KEY idx_obras_tenant_id (tenant_id),
  KEY idx_obras_status (status),
  CONSTRAINT fk_obras_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_obras_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS produtos (
  id CHAR(36) NOT NULL,
  tenant_id CHAR(36) NOT NULL,
  nome VARCHAR(191) NOT NULL,
  categoria VARCHAR(80) NOT NULL DEFAULT 'outros',
  unidade VARCHAR(30) NOT NULL DEFAULT 'un',
  valor_unitario DECIMAL(12,2) NOT NULL DEFAULT 0,
  fornecedor VARCHAR(191) NULL,
  observacoes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_produtos_tenant_id_id (tenant_id, id),
  KEY idx_produtos_tenant_id (tenant_id),
  KEY idx_produtos_nome (nome),
  CONSTRAINT fk_produtos_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS produto_categorias (
  id CHAR(36) NOT NULL,
  tenant_id CHAR(36) NOT NULL,
  slug VARCHAR(80) NOT NULL,
  nome VARCHAR(80) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_produto_categorias_tenant_slug (tenant_id, slug),
  KEY idx_produto_categorias_tenant_id (tenant_id),
  CONSTRAINT fk_produto_categorias_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS horas_trabalhadas (
  id CHAR(36) NOT NULL,
  tenant_id CHAR(36) NOT NULL,
  obra_id CHAR(36) NOT NULL,
  funcionario_id CHAR(36) NOT NULL,
  entrada DATETIME NOT NULL,
  saida DATETIME NOT NULL,
  almoco_minutos TINYINT UNSIGNED NOT NULL DEFAULT 60,
  horas DECIMAL(6,2) NOT NULL,
  valor_hora DECIMAL(12,2) NOT NULL DEFAULT 0,
  valor_total DECIMAL(14,2) NOT NULL DEFAULT 0,
  descricao TEXT NULL,
  bot_sessao_id CHAR(36) NULL,
  created_by CHAR(36) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_horas_tenant_id_id (tenant_id, id),
  KEY idx_horas_tenant_id (tenant_id),
  KEY idx_horas_entrada (entrada),
  KEY idx_horas_saida (saida),
  KEY idx_horas_obra (obra_id),
  KEY idx_horas_funcionario (funcionario_id),
  KEY idx_horas_bot_sessao (bot_sessao_id),
  CONSTRAINT fk_horas_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_horas_obra_tenant FOREIGN KEY (tenant_id, obra_id) REFERENCES obras(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_horas_func_tenant FOREIGN KEY (tenant_id, funcionario_id) REFERENCES funcionarios(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_horas_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS materiais_usados (
  id CHAR(36) NOT NULL,
  tenant_id CHAR(36) NOT NULL,
  obra_id CHAR(36) NOT NULL,
  produto_id CHAR(36) NULL,
  quantidade DECIMAL(12,2) NOT NULL,
  valor_unitario DECIMAL(12,2) NOT NULL,
  valor_total DECIMAL(14,2) NOT NULL,
  data DATE NOT NULL,
  observacoes TEXT NULL,
  comprovante_url VARCHAR(500) NULL,
  link_url VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_materiais_tenant_id_id (tenant_id, id),
  KEY idx_materiais_tenant_id (tenant_id),
  KEY idx_materiais_data (data),
  CONSTRAINT fk_materiais_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_materiais_obra_tenant FOREIGN KEY (tenant_id, obra_id) REFERENCES obras(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_materiais_produto FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS despesas (
  id CHAR(36) NOT NULL,
  tenant_id CHAR(36) NOT NULL,
  obra_id CHAR(36) NOT NULL,
  categoria ENUM('combustivel','alimentacao','hospedagem','outros') NOT NULL,
  data DATE NOT NULL,
  data_checkout DATE NULL,
  descricao TEXT NULL,
  litros DECIMAL(10,2) NULL,
  qtd_pessoas INT NULL,
  local VARCHAR(191) NULL,
  valor DECIMAL(14,2) NOT NULL,
  responsavel_id CHAR(36) NULL,
  comprovante_url VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_despesas_tenant_id_id (tenant_id, id),
  KEY idx_despesas_tenant_id (tenant_id),
  KEY idx_despesas_data (data),
  CONSTRAINT fk_despesas_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_despesas_obra_tenant FOREIGN KEY (tenant_id, obra_id) REFERENCES obras(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_despesas_resp FOREIGN KEY (responsavel_id) REFERENCES funcionarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pagamentos (
  id CHAR(36) NOT NULL,
  tenant_id CHAR(36) NOT NULL,
  funcionario_id CHAR(36) NOT NULL,
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  valor DECIMAL(14,2) NOT NULL,
  status ENUM('pendente','pago') NOT NULL DEFAULT 'pendente',
  data_pagamento DATE NULL,
  forma ENUM('dinheiro','pix','transferencia') NULL,
  observacoes TEXT NULL,
  flg_envio_funcionario INT NOT NULL DEFAULT 0 COMMENT '1 = notificação enviada ao funcionário via WhatsApp',
  flg_vld_funcionario INT NOT NULL DEFAULT 0 COMMENT '1 = funcionário respondeu 1 confirmando o recebimento',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pagamentos_tenant_id_id (tenant_id, id),
  KEY idx_pagamentos_tenant_id (tenant_id),
  KEY idx_pagamentos_periodo (periodo_inicio, periodo_fim),
  CONSTRAINT fk_pagamentos_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_pagamentos_func_tenant FOREIGN KEY (tenant_id, funcionario_id) REFERENCES funcionarios(tenant_id, id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  KEY idx_bot_msg_status    (status),
  KEY idx_bot_msg_tenant    (tenant_id),
  KEY idx_bot_msg_pagamento (pagamento_id),
  CONSTRAINT fk_bot_msg_tenant      FOREIGN KEY (tenant_id)      REFERENCES tenants(id)      ON DELETE CASCADE,
  CONSTRAINT fk_bot_msg_funcionario FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS bot_checkin_divergencias (
  id CHAR(36) NOT NULL,
  tenant_id CHAR(36) NOT NULL,
  sessao_id CHAR(36) NULL,
  funcionario_id CHAR(36) NOT NULL,
  obra_id CHAR(36) NOT NULL,
  lat DECIMAL(10,8) NOT NULL,
  lng DECIMAL(11,8) NOT NULL,
  distancia_metros INT UNSIGNED NOT NULL,
  raio_metros INT UNSIGNED NOT NULL,
  desvio_metros INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_bot_checkin_div_tenant_obra (tenant_id, obra_id),
  KEY idx_bot_checkin_div_tenant_func (tenant_id, funcionario_id),
  KEY idx_bot_checkin_div_sessao (sessao_id),
  CONSTRAINT fk_bot_checkin_div_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_bot_checkin_div_funcionario FOREIGN KEY (tenant_id, funcionario_id) REFERENCES funcionarios(tenant_id, id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_log (
  id CHAR(36) NOT NULL,
  tenant_id CHAR(36) NOT NULL,
  actor_user_id CHAR(36) NULL,
  tabela VARCHAR(120) NOT NULL,
  registro_id CHAR(36) NULL,
  acao ENUM('create','update','delete','login','logout','other') NOT NULL DEFAULT 'other',
  detalhes JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_tenant_id (tenant_id),
  KEY idx_audit_tabela (tabela),
  KEY idx_audit_created_at (created_at),
  CONSTRAINT fk_audit_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- -----------------------------------------------------
-- Optional seed: default tenant (uncomment if needed)
-- -----------------------------------------------------
-- INSERT INTO tenants (id, nome, slug, ativo)
-- VALUES (UUID(), 'Tenant Default', 'default', 1)
-- ON DUPLICATE KEY UPDATE nome = VALUES(nome);
