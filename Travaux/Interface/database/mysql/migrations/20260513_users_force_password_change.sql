-- Adiciona flag para forcar troca de senha no primeiro login apos reset administrativo.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS must_change_password TINYINT(1) NOT NULL DEFAULT 0;
