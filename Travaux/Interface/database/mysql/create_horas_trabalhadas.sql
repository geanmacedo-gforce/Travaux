-- =====================================================
-- CREATE TABLE: horas_trabalhadas
-- Multi-tenant setup with entrada/saida as DATETIME
-- =====================================================

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
  created_by CHAR(36) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Primary Key
  PRIMARY KEY (id),
  
  -- Unique constraints
  UNIQUE KEY uq_horas_tenant_id_id (tenant_id, id),
  
  -- Indexes
  KEY idx_horas_tenant_id (tenant_id),
  KEY idx_horas_entrada (entrada),
  KEY idx_horas_saida (saida),
  KEY idx_horas_obra (obra_id),
  KEY idx_horas_funcionario (funcionario_id),
  KEY idx_horas_data_range (entrada, saida),
  
  -- Foreign Keys
  CONSTRAINT fk_horas_tenant FOREIGN KEY (tenant_id) 
    REFERENCES tenants(id) ON DELETE CASCADE,
    
  CONSTRAINT fk_horas_obra_tenant FOREIGN KEY (tenant_id, obra_id) 
    REFERENCES obras(tenant_id, id) ON DELETE CASCADE,
    
  CONSTRAINT fk_horas_func_tenant FOREIGN KEY (tenant_id, funcionario_id) 
    REFERENCES funcionarios(tenant_id, id) ON DELETE CASCADE,
    
  CONSTRAINT fk_horas_created_by_tenant FOREIGN KEY (tenant_id, created_by) 
    REFERENCES users(tenant_id, id) ON DELETE CASCADE
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Validation: Ensure saida is after entrada
-- (Note: If CHECK constraint fails, remove this line)
-- =====================================================
-- ALTER TABLE horas_trabalhadas
-- ADD CONSTRAINT chk_horas_saida_after_entrada 
-- CHECK (saida > entrada);

-- =====================================================
-- Optional: Stored procedure to automatically calculate horas
-- (Note: Trigger is commented out - uncomment if needed)
-- =====================================================
-- DELIMITER $$
-- 
-- CREATE TRIGGER tr_horas_trabalhadas_update_horas
-- BEFORE INSERT ON horas_trabalhadas
-- FOR EACH ROW
-- BEGIN
--   -- Calculate hours difference in decimal format
--   SET NEW.horas = ROUND(TIMESTAMPDIFF(MINUTE, NEW.entrada, NEW.saida) / 60.0, 2);
--   
--   -- Calculate valor_total if valor_hora is set
--   IF NEW.valor_hora > 0 THEN
--     SET NEW.valor_total = NEW.horas * NEW.valor_hora;
--   END IF;
-- END$$
-- 
-- DELIMITER ;

-- =====================================================
-- Create view for easier querying
-- (Optional - uncomment if needed)
-- =====================================================
-- CREATE OR REPLACE VIEW v_horas_trabalhadas_completo AS
-- SELECT 
--   h.id,
--   h.tenant_id,
--   h.entrada,
--   h.saida,
--   h.horas,
--   h.valor_hora,
--   h.valor_total,
--   h.descricao,
--   DATE(h.entrada) AS data_entrada,
--   TIME(h.entrada) AS hora_entrada,
--   TIME(h.saida) AS hora_saida,
--   f.nome AS funcionario_nome,
--   f.cpf AS funcionario_cpf,
--   o.nome AS obra_nome,
--   o.endereco AS obra_endereco,
--   c.nome AS cliente_nome,
--   h.created_at,
--   h.created_by
-- FROM horas_trabalhadas h
-- LEFT JOIN funcionarios f ON f.id = h.funcionario_id AND f.tenant_id = h.tenant_id
-- LEFT JOIN obras o ON o.id = h.obra_id AND o.tenant_id = h.tenant_id
-- LEFT JOIN clientes c ON c.id = o.cliente_id AND c.tenant_id = h.tenant_id;

-- =====================================================
-- Display table structure (run manually in MySQL client)
-- =====================================================
-- DESCRIBE horas_trabalhadas;
