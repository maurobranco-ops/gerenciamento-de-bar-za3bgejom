-- Tabela de Configurações Gerais do Rachide Bar
-- Permite que Gerentes alterem taxa de serviço, dados fiscais, impressora e taxa de delivery
-- Leitura permitida para todos autenticados e anônimos (para cardápio/delivery online)

CREATE TABLE IF NOT EXISTS public.configuracoes_bar (
  id TEXT PRIMARY KEY DEFAULT 'principal',
  taxa_servico_padrao NUMERIC NOT NULL DEFAULT 10.00,
  taxa_entrega_delivery NUMERIC NOT NULL DEFAULT 7.50,
  
  -- Emitente fiscal
  razao_social TEXT NOT NULL DEFAULT 'Rachide Bar & Petiscaria EIRELI',
  nome_fantasia TEXT NOT NULL DEFAULT 'Rachide Bar',
  cnpj TEXT NOT NULL DEFAULT '14.293.842/0001-84',
  inscricao_estadual TEXT NOT NULL DEFAULT '114.293.842.110',
  endereco_completo TEXT NOT NULL DEFAULT 'Rua dos Boêmios, 142 - Vila Madalena, São Paulo - SP',
  telefone TEXT NOT NULL DEFAULT '(11) 3849-2041',
  
  -- Configurações de impressão
  impressora_fiscal_nome TEXT NOT NULL DEFAULT 'Epson TM-T20X (Térmica 80mm)',
  impressora_fiscal_ativa BOOLEAN NOT NULL DEFAULT true,
  impressora_cozinha_nome TEXT NOT NULL DEFAULT 'Bematech MP-4200 TH (Cozinha)',
  impressora_cozinha_ativa BOOLEAN NOT NULL DEFAULT true,
  
  -- Metadados
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.configuracoes_bar ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DROP POLICY IF EXISTS "configuracoes_bar_select_all" ON public.configuracoes_bar;
CREATE POLICY "configuracoes_bar_select_all" ON public.configuracoes_bar
  FOR SELECT TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "configuracoes_bar_update_gerente" ON public.configuracoes_bar;
CREATE POLICY "configuracoes_bar_update_gerente" ON public.configuracoes_bar
  FOR UPDATE TO authenticated
  USING (public.is_gerente())
  WITH CHECK (public.is_gerente());

DROP POLICY IF EXISTS "configuracoes_bar_insert_gerente" ON public.configuracoes_bar;
CREATE POLICY "configuracoes_bar_insert_gerente" ON public.configuracoes_bar
  FOR INSERT TO authenticated
  WITH CHECK (public.is_gerente());

-- Seed inicial (idempotente)
INSERT INTO public.configuracoes_bar (
  id,
  taxa_servico_padrao,
  taxa_entrega_delivery,
  razao_social,
  nome_fantasia,
  cnpj,
  inscricao_estadual,
  endereco_completo,
  telefone,
  impressora_fiscal_nome,
  impressora_fiscal_ativa,
  impressora_cozinha_nome,
  impressora_cozinha_ativa
) VALUES (
  'principal',
  10.00,
  7.50,
  'Rachide Bar & Petiscaria EIRELI',
  'Rachide Bar',
  '14.293.842/0001-84',
  '114.293.842.110',
  'Rua dos Boêmios, 142 - Vila Madalena, São Paulo - SP',
  '(11) 3849-2041',
  'Epson TM-T20X (Térmica 80mm)',
  true,
  'Bematech MP-4200 TH (Cozinha)',
  true
)
ON CONFLICT (id) DO NOTHING;
