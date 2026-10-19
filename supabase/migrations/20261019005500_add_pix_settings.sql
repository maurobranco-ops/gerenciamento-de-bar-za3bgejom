-- Adiciona colunas para configuração da Chave Pix do Bar (padrão BR Code Banco Central)
-- Chave Pix padrão utilizando o CNPJ do Rachide Bar, nome e cidade do estabelecimento
ALTER TABLE public.configuracoes_bar
  ADD COLUMN IF NOT EXISTS pix_chave text NOT NULL DEFAULT '14293842000184',
  ADD COLUMN IF NOT EXISTS pix_beneficiario_nome text NOT NULL DEFAULT 'Rachide Bar',
  ADD COLUMN IF NOT EXISTS pix_cidade text NOT NULL DEFAULT 'SAO PAULO';

-- Atualiza registro principal caso já exista sem esses valores
UPDATE public.configuracoes_bar
SET
  pix_chave = COALESCE(NULLIF(pix_chave, ''), '14293842000184'),
  pix_beneficiario_nome = COALESCE(NULLIF(pix_beneficiario_nome, ''), 'Rachide Bar'),
  pix_cidade = COALESCE(NULLIF(pix_cidade, ''), 'SAO PAULO')
WHERE id = 'principal';
