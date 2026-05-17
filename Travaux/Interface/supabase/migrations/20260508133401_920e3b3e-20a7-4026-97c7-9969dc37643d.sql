-- ENUMS
CREATE TYPE public.app_role AS ENUM ('proprietario', 'gerente', 'funcionario');
CREATE TYPE public.tipo_servico AS ENUM ('drywall', 'masticagem', 'drywall_masticagem');
CREATE TYPE public.status_obra AS ENUM ('orcamento', 'em_andamento', 'pausada', 'concluida', 'cancelada');
CREATE TYPE public.funcao_funcionario AS ENUM ('drywall', 'masticagem', 'auxiliar', 'outro');
CREATE TYPE public.tipo_remuneracao AS ENUM ('hora', 'diaria', 'mensal');
CREATE TYPE public.status_funcionario AS ENUM ('ativo', 'afastado', 'desligado');
CREATE TYPE public.categoria_produto AS ENUM ('drywall', 'masticagem', 'fixacao', 'epi', 'outros');
CREATE TYPE public.categoria_despesa AS ENUM ('combustivel', 'alimentacao', 'hospedagem', 'outros');
CREATE TYPE public.status_pagamento AS ENUM ('pendente', 'pago');
CREATE TYPE public.forma_pagamento AS ENUM ('dinheiro', 'pix', 'transferencia');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  funcionario_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS public.app_role LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1 $$;

CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  documento TEXT, telefone TEXT, email TEXT,
  rua TEXT, numero TEXT, bairro TEXT, cidade TEXT, estado TEXT, cep TEXT,
  observacoes TEXT,
  arquivado BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.funcionarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cpf TEXT, telefone TEXT,
  funcao public.funcao_funcionario NOT NULL DEFAULT 'auxiliar',
  tipo_remuneracao public.tipo_remuneracao NOT NULL DEFAULT 'hora',
  valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  banco TEXT, agencia TEXT, conta TEXT, pix TEXT,
  status public.status_funcionario NOT NULL DEFAULT 'ativo',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ADD CONSTRAINT profiles_funcionario_fk
  FOREIGN KEY (funcionario_id) REFERENCES public.funcionarios(id) ON DELETE SET NULL;

CREATE TABLE public.obras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  tipo_servico public.tipo_servico NOT NULL DEFAULT 'drywall',
  endereco TEXT,
  data_inicio DATE,
  data_termino_prevista DATE,
  valor_contratado NUMERIC(14,2) NOT NULL DEFAULT 0,
  status public.status_obra NOT NULL DEFAULT 'orcamento',
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  categoria public.categoria_produto NOT NULL DEFAULT 'outros',
  unidade TEXT NOT NULL DEFAULT 'un',
  valor_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
  fornecedor TEXT, observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.horas_trabalhadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  horas NUMERIC(6,2) NOT NULL,
  valor_hora NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE TABLE public.materiais_usados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES public.produtos(id) ON DELETE SET NULL,
  quantidade NUMERIC(12,2) NOT NULL,
  valor_unitario NUMERIC(12,2) NOT NULL,
  valor_total NUMERIC(14,2) NOT NULL,
  data DATE NOT NULL,
  observacoes TEXT,
  comprovante_url TEXT,
  link_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.despesas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  categoria public.categoria_despesa NOT NULL,
  data DATE NOT NULL,
  data_checkout DATE,
  descricao TEXT,
  litros NUMERIC(10,2),
  qtd_pessoas INTEGER,
  local TEXT,
  valor NUMERIC(14,2) NOT NULL,
  responsavel_id UUID REFERENCES public.funcionarios(id) ON DELETE SET NULL,
  comprovante_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.pagamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  valor NUMERIC(14,2) NOT NULL,
  status public.status_pagamento NOT NULL DEFAULT 'pendente',
  data_pagamento DATE,
  forma public.forma_pagamento,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  has_owner BOOLEAN;
  assigned_role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email,'@',1)), NEW.email);
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE role='proprietario') INTO has_owner;
  IF NOT has_owner THEN
    assigned_role := 'proprietario';
  ELSE
    assigned_role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'funcionario');
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role);
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funcionarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horas_trabalhadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materiais_usados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.despesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own_or_owner" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'proprietario') OR public.has_role(auth.uid(),'gerente'));
CREATE POLICY "profiles_update_own_or_owner" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'proprietario'));
CREATE POLICY "profiles_insert_owner" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'proprietario') OR id = auth.uid());

CREATE POLICY "roles_select_own_or_owner" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'proprietario'));
CREATE POLICY "roles_all_owner" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'proprietario')) WITH CHECK (public.has_role(auth.uid(),'proprietario'));

CREATE POLICY "clientes_mgmt" ON public.clientes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'proprietario') OR public.has_role(auth.uid(),'gerente'))
  WITH CHECK (public.has_role(auth.uid(),'proprietario') OR public.has_role(auth.uid(),'gerente'));

CREATE POLICY "funcionarios_mgmt" ON public.funcionarios FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'proprietario') OR public.has_role(auth.uid(),'gerente'))
  WITH CHECK (public.has_role(auth.uid(),'proprietario') OR public.has_role(auth.uid(),'gerente'));
CREATE POLICY "funcionarios_self_read" ON public.funcionarios FOR SELECT TO authenticated
  USING (id = (SELECT funcionario_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "obras_mgmt" ON public.obras FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'proprietario') OR public.has_role(auth.uid(),'gerente'))
  WITH CHECK (public.has_role(auth.uid(),'proprietario') OR public.has_role(auth.uid(),'gerente'));
CREATE POLICY "obras_funcionario_read" ON public.obras FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.horas_trabalhadas h
    WHERE h.obra_id = obras.id AND h.funcionario_id = (SELECT funcionario_id FROM public.profiles WHERE id = auth.uid())));

CREATE POLICY "produtos_mgmt" ON public.produtos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'proprietario') OR public.has_role(auth.uid(),'gerente'))
  WITH CHECK (public.has_role(auth.uid(),'proprietario') OR public.has_role(auth.uid(),'gerente'));

CREATE POLICY "horas_mgmt" ON public.horas_trabalhadas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'proprietario') OR public.has_role(auth.uid(),'gerente'))
  WITH CHECK (public.has_role(auth.uid(),'proprietario') OR public.has_role(auth.uid(),'gerente'));
CREATE POLICY "horas_self_read" ON public.horas_trabalhadas FOR SELECT TO authenticated
  USING (funcionario_id = (SELECT funcionario_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "materiais_mgmt" ON public.materiais_usados FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'proprietario') OR public.has_role(auth.uid(),'gerente'))
  WITH CHECK (public.has_role(auth.uid(),'proprietario') OR public.has_role(auth.uid(),'gerente'));

CREATE POLICY "despesas_mgmt" ON public.despesas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'proprietario') OR public.has_role(auth.uid(),'gerente'))
  WITH CHECK (public.has_role(auth.uid(),'proprietario') OR public.has_role(auth.uid(),'gerente'));

CREATE POLICY "pagamentos_mgmt" ON public.pagamentos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'proprietario') OR public.has_role(auth.uid(),'gerente'))
  WITH CHECK (public.has_role(auth.uid(),'proprietario') OR public.has_role(auth.uid(),'gerente'));
CREATE POLICY "pagamentos_self_read" ON public.pagamentos FOR SELECT TO authenticated
  USING (funcionario_id = (SELECT funcionario_id FROM public.profiles WHERE id = auth.uid()));

INSERT INTO storage.buckets (id, name, public) VALUES ('comprovantes','comprovantes', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "comprovantes_mgmt_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='comprovantes' AND (public.has_role(auth.uid(),'proprietario') OR public.has_role(auth.uid(),'gerente')));
CREATE POLICY "comprovantes_mgmt_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='comprovantes' AND (public.has_role(auth.uid(),'proprietario') OR public.has_role(auth.uid(),'gerente')));
CREATE POLICY "comprovantes_mgmt_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id='comprovantes' AND (public.has_role(auth.uid(),'proprietario') OR public.has_role(auth.uid(),'gerente')));

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;