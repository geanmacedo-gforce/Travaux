-- Produto categories per tenant
-- 1) Allow custom product categories
ALTER TABLE produtos
  MODIFY categoria VARCHAR(80) NOT NULL DEFAULT 'outros';

-- 2) Tenant-scoped categories table
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

-- 3) Seed defaults for all tenants (idempotent)
INSERT INTO produto_categorias (id, tenant_id, slug, nome)
SELECT UUID(), t.id, c.slug, c.nome
FROM tenants t
CROSS JOIN (
  SELECT 'drywall' AS slug, 'Drywall' AS nome
  UNION ALL SELECT 'masticagem', 'Masticagem'
  UNION ALL SELECT 'fixacao', 'Fixacao'
  UNION ALL SELECT 'epi', 'EPI'
  UNION ALL SELECT 'outros', 'Outros'
) c
LEFT JOIN produto_categorias pc
  ON pc.tenant_id = t.id AND pc.slug = c.slug
WHERE pc.id IS NULL;

-- 4) Seed categories already used by products but missing in catalog
INSERT INTO produto_categorias (id, tenant_id, slug, nome)
SELECT UUID(), p.tenant_id, p.categoria, REPLACE(p.categoria, '_', ' ')
FROM (
  SELECT DISTINCT tenant_id, categoria
  FROM produtos
  WHERE categoria IS NOT NULL AND categoria <> ''
) p
LEFT JOIN produto_categorias pc
  ON pc.tenant_id = p.tenant_id AND pc.slug = p.categoria
WHERE pc.id IS NULL;
