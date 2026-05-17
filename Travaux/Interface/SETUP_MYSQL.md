# 🗄️ Guia Rápido: Criar Tabelas no MySQL

## 📋 Pré-requisitos
- MySQL 5.7+ já instalado e rodando
- Banco `obras_db` criado (ou o script cria automaticamente)
- Acesso via terminal ou cliente MySQL (Workbench, DBeaver, etc.)

---

## 🚀 3 Formas de Executar o Script

### **Opção 1: Linha de Comando (Mais Rápido)**

```bash
# Abra PowerShell e execute:
mysql -u root -p obras_db < "f:\03 - Obras\Interface\travaux\supabase\schema_mysql.sql"

# Será solicitada a senha do usuário root
# Digite a senha que você definiu ao instalar MySQL
```

**Troubleshooting:**
```bash
# Se receber erro "mysql: command not found", adicione ao PATH:
# Geralmente está em: C:\Program Files\MySQL\MySQL Server 8.0\bin

# Ou use o caminho completo:
"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p obras_db < "script.sql"
```

---

### **Opção 2: MySQL Workbench (GUI)**

1. Abra **MySQL Workbench**
2. Clique em sua conexão com MySQL
3. Clique em **File** > **Open SQL Script**
4. Selecione: `supabase/schema_mysql.sql`
5. Clique em **Execute** (⚡ ou Ctrl+Shift+Enter)
6. Veja os resultados na aba "Output"

---

### **Opção 3: DBeaver (GUI - Recomendado)**

1. Abra **DBeaver** 
2. Clique com botão direito na sua conexão MySQL > **SQL Editor** > **New SQL Script**
3. Copie todo o conteúdo de `supabase/schema_mysql.sql`
4. Cole no editor e pressione **Ctrl+Enter**
5. Verifique na aba "Output" o resultado

---

## ✅ Verificar se Funcionou

Depois de executar o script, verifique as tabelas:

```sql
-- Via terminal:
mysql -u root -p obras_db

-- Dentro do MySQL:
SHOW TABLES;

-- Contar tabelas (deve ter 14):
SELECT COUNT(*) FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'obras_db';

-- Ver estrutura de uma tabela:
DESCRIBE funcionarios;
DESC horas_trabalhadas;

-- Ver dados de teste inseridos:
SELECT * FROM clientes;
SELECT * FROM funcionarios;
SELECT * FROM users;

-- Sair:
EXIT;
```

---

## 📊 O que foi criado

### **14 Tabelas:**
1. `users` - Usuários para autenticação
2. `profiles` - Perfis dos usuários
3. `user_roles` - Permissões (proprietario, gerente, funcionario, admin)
4. `funcionarios` - Dados dos trabalhadores
5. `obras` - Projetos/obras
6. `clientes` - Clientes das obras
7. `produtos` - Catálogo de materiais
8. `horas_trabalhadas` - Registro de horas (com GPS)
9. `materiais_usados` - Consumo de materiais
10. `despesas` - Despesas diversas
11. `pagamentos` - Folha de pagamento
12. `audit_log` - Log de auditoria
13. `vw_horas_por_obra` - View para relatório
14. `vw_horas_por_funcionario` - View para relatório

### **Relacionamentos Prontos:**
```
clientes (1) -----> (N) obras
            <------
            
funcionarios (1) -----> (N) horas_trabalhadas
             <---------
             
funcionarios (1) -----> (N) despesas
             <---------
             
funcionarios (1) -----> (N) pagamentos
             <---------
             
obras (1) -----> (N) horas_trabalhadas
      <---------
      
obras (1) -----> (N) materiais_usados
      <---------
      
obras (1) -----> (N) despesas
      <---------
      
produtos (1) -----> (N) materiais_usados
        <---------
        
users (1) -----> (N) profiles
      <---------
      
users (1) -----> (N) user_roles
      <---------
```

### **Triggers Automáticos:**
- ✅ Calcula `valor_total` em `horas_trabalhadas` automaticamente
- ✅ Calcula `valor_total` em `materiais_usados` automaticamente
- ✅ Atualiza `updated_at` em todas as tabelas automaticamente

### **Views para Relatórios:**
- `vw_horas_por_obra` - Total de horas por obra
- `vw_horas_por_funcionario` - Total de horas por funcionário
- `vw_despesas_por_obra` - Despesas resumidas por obra
- `vw_pagamentos_pendentes` - Pagamentos pendentes com dias de atraso

---

## 🔐 Dados de Teste Inseridos

| Campo | Valor |
|-------|-------|
| **Email Admin** | `admin@obras.local` |
| **Senha Admin** | `admin123` |
| **Cliente** | Construtora Alpha |
| **Funcionário** | João da Silva |
| **Obra** | Projeto Drywall - Apt 501 |

⚠️ **IMPORTANTE**: Mude essas credenciais em produção!

---

## 🔧 Configurar o Projeto

Edite o arquivo `.env` (ou cópia de `.env.mysql.example`):

```env
DATABASE_URL="mysql://root:sua_senha@localhost:3306/obras_db"
DB_HOST="localhost"
DB_PORT="3306"
DB_NAME="obras_db"
DB_USER="root"
DB_PASSWORD="sua_senha"

JWT_SECRET="seu-secret-super-seguro-aqui"
NODE_ENV="development"
```

---

## 📝 Próximos Passos

1. ✅ Execute o script SQL acima
2. ✅ Verificar se as 14 tabelas foram criadas
3. ✅ Atualizar o `.env` com credenciais reais
4. ✅ Instalar biblioteca MySQL em Node.js:
   ```bash
   cd "f:\03 - Obras\Interface\travaux"
   bun add mysql2 dotenv
   ```
5. ✅ Criar arquivo `src/lib/db.ts` para conectar ao banco
6. ✅ Adaptar componentes React para usar banco real

---

## 🆘 Troubleshooting

### Erro: "Access denied for user 'root'"
```bash
# Reset de senha do root (Windows)
mysql -u root --skip-password
mysql> ALTER USER 'root'@'localhost' IDENTIFIED BY 'nova_senha';
mysql> FLUSH PRIVILEGES;
```

### Erro: "Unknown database 'obras_db'"
O script cria o banco automaticamente, mas se precisar manual:
```sql
CREATE DATABASE obras_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### Erro: "Can't create table"
Verifique se o MySQL está rodando:
```bash
# Windows
Get-Service MySQL80
# Ou reinicie em Services (services.msc)
```

### Erro: "Duplicate entry"
Execute com flag para ignorar duplicatas:
```bash
mysql -u root -p obras_db < schema_mysql.sql 2>&1 | grep -i error
```

---

**Pronto! Seu banco MySQL está 100% configurado com todas as tabelas e relacionamentos.** 🎉

Para conectar no projeto React, use a biblioteca `mysql2` com `connection pool`.
