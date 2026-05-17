-- =====================================================
-- Migration: Add entrada_saida and horario columns
-- to horas_trabalhadas table
-- =====================================================

ALTER TABLE horas_trabalhadas
ADD COLUMN entrada DATETIME NULL AFTER data,
ADD COLUMN saida DATETIME NULL AFTER entrada,
ADD COLUMN almoco_minutos TINYINT UNSIGNED NOT NULL DEFAULT 60 AFTER saida;

-- Add indexes for better performance
CREATE INDEX idx_horas_entrada ON horas_trabalhadas(entrada);
CREATE INDEX idx_horas_saida ON horas_trabalhadas(saida);

-- Display the updated table structure
DESCRIBE horas_trabalhadas;
