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
