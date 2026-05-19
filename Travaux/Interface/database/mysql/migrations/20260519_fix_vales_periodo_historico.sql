-- =====================================================
-- Migration: Fix historical vale period fields
-- =====================================================
-- Context:
-- Older vales may have been saved with periodo_inicio/periodo_fim
-- from the screen filter instead of the selected folha row period.
--
-- Rule applied here:
-- For VALE records, align periodo_inicio/periodo_fim to the month
-- of data_pagamento when the stored period month is different.
-- =====================================================

-- 1) Backup affected records (idempotent by PK)
CREATE TABLE IF NOT EXISTS pagamentos_backup_fix_vales_periodo_20260519 (
  id               CHAR(36)     NOT NULL,
  tenant_id        CHAR(36)     NOT NULL,
  funcionario_id   CHAR(36)     NOT NULL,
  periodo_inicio   DATE         NULL,
  periodo_fim      DATE         NULL,
  valor            DECIMAL(12,2) NULL,
  status           VARCHAR(32)  NULL,
  data_pagamento   DATE         NULL,
  forma            VARCHAR(32)  NULL,
  observacoes      TEXT         NULL,
  created_at       DATETIME     NULL,
  updated_at       DATETIME     NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO pagamentos_backup_fix_vales_periodo_20260519 (
  id, tenant_id, funcionario_id, periodo_inicio, periodo_fim,
  valor, status, data_pagamento, forma, observacoes, created_at, updated_at
)
SELECT
  p.id, p.tenant_id, p.funcionario_id, p.periodo_inicio, p.periodo_fim,
  p.valor, p.status, p.data_pagamento, p.forma, p.observacoes, p.created_at, p.updated_at
FROM pagamentos p
WHERE p.data_pagamento IS NOT NULL
  AND UPPER(COALESCE(p.observacoes, '')) LIKE '%[VALE]%'
  AND (
    p.periodo_inicio IS NULL
    OR p.periodo_fim IS NULL
    OR DATE_FORMAT(p.periodo_inicio, '%Y%m') <> DATE_FORMAT(p.data_pagamento, '%Y%m')
    OR DATE_FORMAT(p.periodo_fim, '%Y%m') <> DATE_FORMAT(p.data_pagamento, '%Y%m')
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pagamentos_backup_fix_vales_periodo_20260519 b
    WHERE b.id = p.id
  );

-- 2) Apply fix
UPDATE pagamentos p
SET
  p.periodo_inicio = STR_TO_DATE(DATE_FORMAT(p.data_pagamento, '%Y-%m-01'), '%Y-%m-%d'),
  p.periodo_fim = LAST_DAY(p.data_pagamento)
WHERE p.data_pagamento IS NOT NULL
  AND UPPER(COALESCE(p.observacoes, '')) LIKE '%[VALE]%'
  AND (
    p.periodo_inicio IS NULL
    OR p.periodo_fim IS NULL
    OR DATE_FORMAT(p.periodo_inicio, '%Y%m') <> DATE_FORMAT(p.data_pagamento, '%Y%m')
    OR DATE_FORMAT(p.periodo_fim, '%Y%m') <> DATE_FORMAT(p.data_pagamento, '%Y%m')
  );

-- 3) Optional verification query:
-- SELECT id, data_pagamento, periodo_inicio, periodo_fim, observacoes
-- FROM pagamentos
-- WHERE UPPER(COALESCE(observacoes, '')) LIKE '%[VALE]%'
-- ORDER BY data_pagamento DESC;
