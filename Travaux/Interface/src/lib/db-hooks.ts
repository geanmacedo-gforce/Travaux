// Hook para usar banco de dados via API
import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { serverQuery, serverQueryOne } from '@/lib/server-api';

export function useSQLQuery<T = any>(
  sql: string,
  values?: any[],
  options?: Omit<UseQueryOptions<T[], Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery<T[], Error>({
    queryKey: ['sql', sql, values],
    queryFn: async () => {
      const result = await serverQuery({ sql, values });
      return result as T[];
    },
    ...options,
  });
}

export function useSQLQueryOne<T = any>(
  sql: string,
  values?: any[],
  options?: Omit<UseQueryOptions<T | null, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery<T | null, Error>({
    queryKey: ['sql-one', sql, values],
    queryFn: async () => {
      const result = await serverQueryOne({ sql, values });
      return result as T | null;
    },
    ...options,
  });
}

// Helper para montar queries SQL comuns
export const SQL = {
  // FUNCIONÁRIOS
  listFuncionarios: () =>
    `SELECT id, nome, cpf, telefone, funcao, tipo_remuneracao, valor, status 
     FROM funcionarios ORDER BY nome`,

  getFuncionario: (id: string) =>
    `SELECT * FROM funcionarios WHERE id = ? `,

  // OBRAS
  listObras: () =>
    `SELECT o.*, c.nome as cliente_nome 
     FROM obras o 
     LEFT JOIN clientes c ON o.cliente_id = c.id 
     ORDER BY o.nome`,

  getObra: (id: string) =>
    `SELECT o.*, c.nome as cliente_nome 
     FROM obras o 
     LEFT JOIN clientes c ON o.cliente_id = c.id 
     WHERE o.id = ?`,

  // HORAS
  listHoras: (obraId?: string) => {
    let sql = `SELECT h.*, f.nome as funcionario_nome 
               FROM horas_trabalhadas h 
               JOIN funcionarios f ON h.funcionario_id = f.id`;
    if (obraId) sql += ` WHERE h.obra_id = ?`;
    return sql + ` ORDER BY h.data DESC`;
  },

  // CLIENTES
  listClientes: () =>
    `SELECT id, nome, documento, telefone, email, cidade, estado, arquivado 
     FROM clientes ORDER BY nome`,

  // MATERIAIS
  listMateriais: (obraId?: string) => {
    let sql = `SELECT m.*, p.nome as produto_nome, p.unidade 
               FROM materiais_usados m 
               LEFT JOIN produtos p ON m.produto_id = p.id`;
    if (obraId) sql += ` WHERE m.obra_id = ?`;
    return sql + ` ORDER BY m.data DESC`;
  },

  // DESPESAS
  listDespesas: (obraId?: string) => {
    let sql = `SELECT d.*, f.nome as responsavel_nome 
               FROM despesas d 
               LEFT JOIN funcionarios f ON d.responsavel_id = f.id`;
    if (obraId) sql += ` WHERE d.obra_id = ?`;
    return sql + ` ORDER BY d.data DESC`;
  },

  // PAGAMENTOS
  listPagamentos: () =>
    `SELECT p.*, f.nome as funcionario_nome 
     FROM pagamentos p 
     JOIN funcionarios f ON p.funcionario_id = f.id 
     ORDER BY p.periodo_fim DESC`,
};
