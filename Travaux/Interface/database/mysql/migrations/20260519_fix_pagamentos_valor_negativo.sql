-- =====================================================
-- Migration: Normalize negative payment values
-- =====================================================
-- Goal:
-- Prevent confusion in folha/historico by ensuring pagamentos.valor
-- is never negative in persisted data.
--
-- Scope:
-- Applies to all pagamentos rows where valor < 0.
-- =====================================================

-- 1) Backup affected rows (idempotent by PK)
CREATE TABLE IF NOT EXISTS pagamentos_backup_fix_valor_negativo_20260519 (
  id               CHAR(36)      NOT NULL,
  tenant_id        CHAR(36)      NOT NULL,
  funcionario_id   CHAR(36)      NOT NULL,
  periodo_inicio   DATE          NULL,
  periodo_fim      DATE          NULL,
  valor            DECIMAL(12,2) NULL,
  status           VARCHAR(32)   NULL,
  data_pagamento   DATE          NULL,
  forma            VARCHAR(32)   NULL,
  observacoes      TEXT          NULL,
  created_at       DATETIME      NULL,
  updated_at       DATETIME      NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO pagamentos_backup_fix_valor_negativo_20260519 (
  id, tenant_id, funcionario_id, periodo_inicio, periodo_fim,
  valor, status, data_pagamento, forma, observacoes, created_at, updated_at
)
SELECT
  p.id, p.tenant_id, p.funcionario_id, p.periodo_inicio, p.periodo_fim,
  p.valor, p.status, p.data_pagamento, p.forma, p.observacoes, p.created_at, p.updated_at
FROM pagamentos p
WHERE p.valor < 0
  AND NOT EXISTS (
    SELECT 1
    FROM pagamentos_backup_fix_valor_negativo_20260519 b
    WHERE b.id = p.id
  );

-- 2) Normalize values
UPDATE pagamentos
SET valor = ABS(valor)
WHERE valor < 0;

-- 3) Optional verification
-- SELECT id, funcionario_id, data_pagamento, periodo_inicio, periodo_fim, valor, observacoes
-- FROM pagamentos
-- WHERE valor < 0
-- ORDER BY data_pagamento DESC;
