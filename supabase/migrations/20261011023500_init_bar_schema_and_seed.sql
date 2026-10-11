-- Migração inicial do Rachide Bar
-- Estruturação de tabelas, RLS permissivo para perfis simulados e seed de dados de demonstração

-- 1. TABELA MESAS (expansíveis, número único, capacidade)
CREATE TABLE IF NOT EXISTS public.mesas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero INTEGER NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'Livre' CHECK (status IN ('Livre', 'Ocupada', 'Aguardando Pagamento', 'Fechada')),
  capacidade INTEGER NOT NULL DEFAULT 4,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. TABELA PRODUTOS
CREATE TABLE IF NOT EXISTS public.produtos (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL CHECK (categoria IN ('Cervejas', 'Petiscos', 'Destilados', 'Refrigerantes', 'Porções', 'Drinks')),
  preco NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  descricao TEXT NOT NULL DEFAULT '',
  unidade TEXT NOT NULL CHECK (unidade IN ('un', 'kg', 'L', 'g', 'ml')),
  estoque NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  estoque_minimo NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  area_preparo TEXT NOT NULL DEFAULT 'bar' CHECK (area_preparo IN ('bar', 'cozinha')),
  ativo BOOLEAN NOT NULL DEFAULT true,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. TABELA COMANDAS
CREATE TABLE IF NOT EXISTS public.comandas (
  id TEXT PRIMARY KEY,
  mesa_numero INTEGER NOT NULL REFERENCES public.mesas(numero) ON DELETE RESTRICT ON UPDATE CASCADE,
  cliente_nome TEXT,
  pessoas INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'Livre' CHECK (status IN ('Livre', 'Ocupada', 'Aguardando Pagamento', 'Fechada', 'Paga', 'Cancelada')),
  aberta_em TIMESTAMPTZ,
  fechada_em TIMESTAMPTZ,
  inclui_taxa_servico BOOLEAN NOT NULL DEFAULT true,
  garcom TEXT DEFAULT 'Garçom de Salão',
  total NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. TABELA COMANDA_ITENS
CREATE TABLE IF NOT EXISTS public.comanda_itens (
  id TEXT PRIMARY KEY,
  comanda_id TEXT NOT NULL REFERENCES public.comandas(id) ON DELETE CASCADE,
  produto_id TEXT NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
  nome_produto TEXT NOT NULL,
  preco_unitario NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  quantidade INTEGER NOT NULL DEFAULT 1,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. TABELA MOVIMENTACOES_ESTOQUE
CREATE TABLE IF NOT EXISTS public.movimentacoes_estoque (
  id TEXT PRIMARY KEY,
  data_hora TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  produto_id TEXT NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  nome_produto TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('Entrada', 'Saída', 'Ajuste')),
  quantidade NUMERIC(10,2) NOT NULL,
  unidade TEXT NOT NULL,
  usuario TEXT NOT NULL,
  fornecedor TEXT,
  motivo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. TABELA CAIXA_DIARIOS
CREATE TABLE IF NOT EXISTS public.caixa_diarios (
  data DATE PRIMARY KEY,
  saldo_abertura NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  fechado BOOLEAN NOT NULL DEFAULT false,
  fechado_em TIMESTAMPTZ,
  fechado_por TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. TABELA MOVIMENTOS_CAIXA
CREATE TABLE IF NOT EXISTS public.movimentos_caixa (
  id TEXT PRIMARY KEY,
  data_hora TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  descricao TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('Entrada', 'Saída')),
  forma_pagamento TEXT CHECK (forma_pagamento IN ('Dinheiro', 'Cartão Débito', 'Cartão Crédito', 'Pix', 'TEP')),
  valor NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  usuario TEXT NOT NULL,
  comanda_id TEXT REFERENCES public.comandas(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. TABELA DOCUMENTOS_FISCAIS
CREATE TABLE IF NOT EXISTS public.documentos_fiscais (
  id TEXT PRIMARY KEY,
  numero TEXT NOT NULL,
  serie TEXT NOT NULL DEFAULT '001',
  tipo TEXT NOT NULL CHECK (tipo IN ('NFC-e', 'NF-e')),
  emitido_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valor NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'Autorizada' CHECK (status IN ('Autorizada', 'Cancelada')),
  nome_cliente TEXT,
  documento_cliente TEXT,
  comanda_id TEXT REFERENCES public.comandas(id) ON DELETE SET NULL,
  chave_acesso TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. TABELA FILA_COZINHA (preparada para pedidos cozinha/bar)
CREATE TABLE IF NOT EXISTS public.fila_cozinha (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comanda_item_id TEXT REFERENCES public.comanda_itens(id) ON DELETE CASCADE,
  area_preparo TEXT NOT NULL CHECK (area_preparo IN ('bar', 'cozinha')),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'preparando', 'pronto', 'entregue')),
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- HABILITAR RLS NAS TABELAS
ALTER TABLE public.mesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comandas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comanda_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentacoes_estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caixa_diarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentos_caixa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos_fiscais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fila_cozinha ENABLE ROW LEVEL SECURITY;

-- POLICIES PERMISSIVAS: Como os papéis de usuário (Garçom, Caixa, Gerente) são simulados no client
-- e ainda não há login real autenticado, permitimos acesso para anon e authenticated.
-- Isso será endurecido quando houver autenticação de contas reais com JWT Supabase.

DROP POLICY IF EXISTS "anon_and_auth_mesas_all" ON public.mesas;
CREATE POLICY "anon_and_auth_mesas_all" ON public.mesas FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_and_auth_produtos_all" ON public.produtos;
CREATE POLICY "anon_and_auth_produtos_all" ON public.produtos FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_and_auth_comandas_all" ON public.comandas;
CREATE POLICY "anon_and_auth_comandas_all" ON public.comandas FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_and_auth_comanda_itens_all" ON public.comanda_itens;
CREATE POLICY "anon_and_auth_comanda_itens_all" ON public.comanda_itens FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_and_auth_movimentacoes_estoque_all" ON public.movimentacoes_estoque;
CREATE POLICY "anon_and_auth_movimentacoes_estoque_all" ON public.movimentacoes_estoque FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_and_auth_caixa_diarios_all" ON public.caixa_diarios;
CREATE POLICY "anon_and_auth_caixa_diarios_all" ON public.caixa_diarios FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_and_auth_movimentos_caixa_all" ON public.movimentos_caixa;
CREATE POLICY "anon_and_auth_movimentos_caixa_all" ON public.movimentos_caixa FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_and_auth_documentos_fiscais_all" ON public.documentos_fiscais;
CREATE POLICY "anon_and_auth_documentos_fiscais_all" ON public.documentos_fiscais FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_and_auth_fila_cozinha_all" ON public.fila_cozinha;
CREATE POLICY "anon_and_auth_fila_cozinha_all" ON public.fila_cozinha FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- SEED DE MESAS INICIAIS (1 a 10)
INSERT INTO public.mesas (numero, status, capacidade) VALUES
  (1, 'Ocupada', 4),
  (2, 'Aguardando Pagamento', 4),
  (3, 'Ocupada', 2),
  (4, 'Livre', 4),
  (5, 'Ocupada', 6),
  (6, 'Livre', 4),
  (7, 'Aguardando Pagamento', 4),
  (8, 'Livre', 2),
  (9, 'Fechada', 4),
  (10, 'Livre', 6)
ON CONFLICT (numero) DO NOTHING;

-- SEED DE PRODUTOS (24 itens do cardápio)
INSERT INTO public.produtos (id, nome, categoria, preco, descricao, unidade, estoque, estoque_minimo, area_preparo, ativo) VALUES
  ('prod-1', 'Heineken Long Neck 330ml', 'Cervejas', 13.90, 'Cerveja puro malte lager premium, servida estupidamente gelada.', 'un', 48.00, 20.00, 'bar', true),
  ('prod-2', 'Original 600ml', 'Cervejas', 16.50, 'Cerveja pilsen tradicional brasileira, garrafa retornável.', 'un', 32.00, 15.00, 'bar', true),
  ('prod-3', 'Corona Extra 330ml', 'Cervejas', 14.90, 'Cerveja mexicana servida com fatia de limão fresco.', 'un', 24.00, 12.00, 'bar', true),
  ('prod-4', 'Chopp Pilsen Artesanal 500ml', 'Cervejas', 12.00, 'Tirado na pressão da torneira com colarinho cremoso.', 'L', 45.00, 20.00, 'bar', true),
  ('prod-5', 'IPA Artesanal da Casa 500ml', 'Cervejas', 19.90, 'India Pale Ale aromática com lúpulos cítricos e amargor marcante.', 'un', 6.00, 10.00, 'bar', true),
  ('prod-6', 'Bolinho de Costela (6 un)', 'Petiscos', 36.90, 'Costela desfiada cozida lentamente na cerveja preta, com molho barbecue.', 'un', 18.00, 8.00, 'cozinha', true),
  ('prod-7', 'Pastelzinho Misto Rachide (8 un)', 'Petiscos', 32.00, '4 carne com queijo canastra e 4 queijo coalho com melaço.', 'un', 22.00, 10.00, 'cozinha', true),
  ('prod-8', 'Coxinha sem Massa de Frango (6 un)', 'Petiscos', 29.90, 'Puro frango temperado empanado na farinha panko com catupiry.', 'un', 3.00, 8.00, 'cozinha', true),
  ('prod-9', 'Torresmo de Rolo Crocante', 'Petiscos', 38.50, 'Torresmo suíno pururucado servido com geleia de pimenta da casa.', 'kg', 4.80, 2.50, 'cozinha', true),
  ('prod-10', 'Picanha na Chapa com Mandioca', 'Porções', 89.90, '600g de picanha fatiada acompanhada de mandioca na manteiga de garrafa e farofa.', 'kg', 6.20, 3.00, 'cozinha', true),
  ('prod-11', 'Batata Rústica com Cheddar & Bacon', 'Porções', 34.00, 'Batatas com casca temperadas com páprica, alecrim e fondue de cheddar.', 'kg', 12.00, 5.00, 'cozinha', true),
  ('prod-12', 'Isca de Peixe com Molho Tártaro', 'Porções', 46.00, 'Tiras de tilápia fresca empanadas crocantes com molho de ervas.', 'kg', 0.00, 3.00, 'cozinha', true),
  ('prod-13', 'Calabresa Acebolada Flambada na Cachaça', 'Porções', 33.50, 'Fatias finas flambadas na cachaça branca, com pão francês quentinho.', 'kg', 7.50, 3.00, 'cozinha', true),
  ('prod-14', 'Caipirinha Tradicional de Limão', 'Drinks', 18.00, 'Cachaça Salinas ouro, limão tahiti e açúcar cristal.', 'un', 40.00, 15.00, 'bar', true),
  ('prod-15', 'Gin Tropical Rachide', 'Drinks', 28.90, 'Gin Tanqueray, Red Bull Tropical, laranja bahia e alecrim maçaricado.', 'un', 19.00, 10.00, 'bar', true),
  ('prod-16', 'Moscow Mule da Casa', 'Drinks', 29.50, 'Vodka premium, suco de limão, refrigerante de gengibre e espuma de gengibre.', 'un', 15.00, 8.00, 'bar', true),
  ('prod-17', 'Negroni Clássico', 'Drinks', 32.00, 'Gin, Campari e Vermute tinto doce com twist de casca de laranja.', 'un', 11.00, 5.00, 'bar', true),
  ('prod-18', 'Dose Whisky Black Label 12 Anos', 'Destilados', 26.00, 'Dose 50ml servida com gelo translúcido ou pura.', 'L', 2.20, 1.00, 'bar', true),
  ('prod-19', 'Dose Cachaça Salinas Amburana', 'Destilados', 14.00, 'Envelhecida em barril de amburana, notas de canela e baunilha.', 'L', 1.80, 0.80, 'bar', true),
  ('prod-20', 'Dose Tequila Jose Cuervo Especial', 'Destilados', 22.00, 'Acompanha sal e fatia de limão.', 'L', 0.90, 0.50, 'bar', true),
  ('prod-21', 'Coca-Cola Zero Lata 350ml', 'Refrigerantes', 7.50, 'Lata 350ml bem gelada com gelo e limão.', 'un', 36.00, 15.00, 'bar', true),
  ('prod-22', 'Guaraná Antarctica Lata 350ml', 'Refrigerantes', 7.50, 'O sabor autêntico do Brasil.', 'un', 28.00, 15.00, 'bar', true),
  ('prod-23', 'Água com Gás Crystal 500ml', 'Refrigerantes', 5.50, 'Garrafa 500ml servida com rodela de limão.', 'un', 42.00, 20.00, 'bar', true),
  ('prod-24', 'Tônica Schweppes Lata 350ml', 'Refrigerantes', 7.90, 'Água tônica clássica amarga.', 'un', 2.00, 10.00, 'bar', true)
ON CONFLICT (id) DO NOTHING;

-- SEED DE COMANDAS
INSERT INTO public.comandas (id, mesa_numero, cliente_nome, pessoas, status, aberta_em, fechada_em, inclui_taxa_servico, garcom, total) VALUES
  ('cmd-01', 1, 'Mesa da Família Silva', 4, 'Ocupada', '2025-03-17T18:40:00Z', NULL, true, 'Garçom de Salão', 182.40),
  ('cmd-02', 2, 'Lucas & Amigos', 3, 'Aguardando Pagamento', '2025-03-17T19:15:00Z', NULL, true, 'Garçom de Salão', 119.50),
  ('cmd-03', 3, 'Casal Bar', 2, 'Ocupada', '2025-03-17T19:45:00Z', NULL, true, 'Garçom de Salão', 89.80),
  ('cmd-04', 4, NULL, 0, 'Livre', NULL, NULL, true, 'Garçom de Salão', 0.00),
  ('cmd-05', 5, 'Turma do Futebol', 6, 'Ocupada', '2025-03-17T18:20:00Z', NULL, true, 'Garçom de Salão', 204.50),
  ('cmd-06', 6, NULL, 0, 'Livre', NULL, NULL, true, 'Garçom de Salão', 0.00),
  ('cmd-07', 7, 'Renata Happy Hour', 2, 'Aguardando Pagamento', '2025-03-17T20:00:00Z', NULL, false, 'Garçom de Salão', 95.90),
  ('cmd-08', 8, NULL, 0, 'Livre', NULL, NULL, true, 'Garçom de Salão', 0.00),
  ('cmd-09', 9, NULL, 4, 'Fechada', '2025-03-17T17:30:00Z', '2025-03-17T19:10:00Z', true, 'Garçom de Salão', 69.50),
  ('cmd-10', 10, NULL, 0, 'Livre', NULL, NULL, true, 'Garçom de Salão', 0.00)
ON CONFLICT (id) DO NOTHING;

-- SEED DE ITENS DE COMANDA
INSERT INTO public.comanda_itens (id, comanda_id, produto_id, nome_produto, preco_unitario, quantidade, observacoes) VALUES
  ('ci-1', 'cmd-01', 'prod-1', 'Heineken Long Neck 330ml', 13.90, 4, 'Bem gelada'),
  ('ci-2', 'cmd-01', 'prod-6', 'Bolinho de Costela (6 un)', 36.90, 1, 'Molho à parte'),
  ('ci-3', 'cmd-01', 'prod-10', 'Picanha na Chapa com Mandioca', 89.90, 1, 'Ponto para mal'),
  ('ci-4', 'cmd-02', 'prod-2', 'Original 600ml', 16.50, 3, NULL),
  ('ci-5', 'cmd-02', 'prod-11', 'Batata Rústica com Cheddar & Bacon', 34.00, 1, NULL),
  ('ci-6', 'cmd-02', 'prod-14', 'Caipirinha Tradicional de Limão', 18.00, 2, 'Com pouco açúcar'),
  ('ci-7', 'cmd-03', 'prod-15', 'Gin Tropical Rachide', 28.90, 2, NULL),
  ('ci-8', 'cmd-03', 'prod-7', 'Pastelzinho Misto Rachide (8 un)', 32.00, 1, NULL),
  ('ci-9', 'cmd-05', 'prod-2', 'Original 600ml', 16.50, 6, NULL),
  ('ci-10', 'cmd-05', 'prod-13', 'Calabresa Acebolada Flambada na Cachaça', 33.50, 2, NULL),
  ('ci-11', 'cmd-05', 'prod-9', 'Torresmo de Rolo Crocante', 38.50, 1, NULL),
  ('ci-12', 'cmd-07', 'prod-16', 'Moscow Mule da Casa', 29.50, 2, NULL),
  ('ci-13', 'cmd-07', 'prod-6', 'Bolinho de Costela (6 un)', 36.90, 1, NULL),
  ('ci-14', 'cmd-09', 'prod-1', 'Heineken Long Neck 330ml', 13.90, 5, NULL)
ON CONFLICT (id) DO NOTHING;

-- SEED FILA DE COZINHA (inicializado com itens de cozinha das comandas abertas)
INSERT INTO public.fila_cozinha (id, comanda_item_id, area_preparo, status, observacoes) VALUES
  ('11111111-1111-1111-1111-111111111101', 'ci-2', 'cozinha', 'pronto', 'Molho à parte'),
  ('11111111-1111-1111-1111-111111111102', 'ci-3', 'cozinha', 'preparando', 'Ponto para mal'),
  ('11111111-1111-1111-1111-111111111103', 'ci-5', 'cozinha', 'pronto', NULL),
  ('11111111-1111-1111-1111-111111111104', 'ci-8', 'cozinha', 'entregue', NULL),
  ('11111111-1111-1111-1111-111111111105', 'ci-10', 'cozinha', 'entregue', NULL),
  ('11111111-1111-1111-1111-111111111106', 'ci-11', 'cozinha', 'entregue', NULL),
  ('11111111-1111-1111-1111-111111111107', 'ci-13', 'cozinha', 'entregue', NULL)
ON CONFLICT (id) DO NOTHING;

-- SEED DE CAIXA_DIARIOS (3 dias)
INSERT INTO public.caixa_diarios (data, saldo_abertura, fechado, fechado_em, fechado_por) VALUES
  ('2025-03-15', 350.00, true, '2025-03-15T23:55:00Z', 'Carlos Gerente'),
  ('2025-03-16', 400.00, true, '2025-03-16T23:50:00Z', 'Carlos Gerente'),
  ('2025-03-17', 450.00, false, NULL, NULL)
ON CONFLICT (data) DO NOTHING;

-- SEED DE MOVIMENTOS DE CAIXA
INSERT INTO public.movimentos_caixa (id, data_hora, descricao, tipo, forma_pagamento, valor, usuario, comanda_id) VALUES
  ('cm-01', '2025-03-15T17:00:00Z', 'Fundo de Troco Inicial', 'Entrada', 'Dinheiro', 350.00, 'Carlos Gerente', NULL),
  ('cm-02', '2025-03-15T19:30:00Z', 'Comanda Mesa 04 (Venda)', 'Entrada', 'Pix', 184.50, 'Marina Caixa', NULL),
  ('cm-03', '2025-03-15T21:10:00Z', 'Comanda Mesa 02 (Venda)', 'Entrada', 'TEP', 265.00, 'Marina Caixa', NULL),
  ('cm-04', '2025-03-15T22:00:00Z', 'Gelo Extra (Compras de Emergência)', 'Saída', 'Dinheiro', 45.00, 'Marina Caixa', NULL),
  ('cm-05', '2025-03-15T23:15:00Z', 'Comanda Mesa 08 (Venda)', 'Entrada', 'Cartão Crédito', 340.00, 'Marina Caixa', NULL),
  ('cm-06', '2025-03-16T17:00:00Z', 'Abertura de Caixa', 'Entrada', 'Dinheiro', 400.00, 'Carlos Gerente', NULL),
  ('cm-07', '2025-03-16T19:40:00Z', 'Comanda Mesa 01 (Venda)', 'Entrada', 'Pix', 215.80, 'Marina Caixa', NULL),
  ('cm-08', '2025-03-16T20:30:00Z', 'Comanda Balcão 02 (Venda)', 'Entrada', 'TEP', 142.00, 'Marina Caixa', NULL),
  ('cm-09', '2025-03-16T21:50:00Z', 'Comanda Mesa 05 (Venda)', 'Entrada', 'Cartão Débito', 395.00, 'Marina Caixa', NULL),
  ('cm-10', '2025-03-16T22:20:00Z', 'Pagamento Diária Músico (Acústico)', 'Saída', 'Pix', 200.00, 'Carlos Gerente', NULL),
  ('cm-11', '2025-03-17T17:00:00Z', 'Abertura de Caixa do Dia', 'Entrada', 'Dinheiro', 450.00, 'Marina Caixa', NULL),
  ('cm-12', '2025-03-17T18:10:00Z', 'Comanda Mesa 09 - Fechamento', 'Entrada', 'TEP', 76.45, 'Marina Caixa', 'cmd-09'),
  ('cm-13', '2025-03-17T18:45:00Z', 'Reposição Hortifruti Limão e Hortelã', 'Saída', 'Dinheiro', 35.00, 'Carlos Gerente', NULL),
  ('cm-14', '2025-03-17T19:20:00Z', 'Comanda Balcão - Petiscos e Cerveja', 'Entrada', 'Pix', 152.00, 'Marina Caixa', NULL),
  ('cm-15', '2025-03-17T19:55:00Z', 'Venda Rápida Chopp 500ml (3 un)', 'Entrada', 'Cartão Crédito', 39.60, 'Marina Caixa', NULL)
ON CONFLICT (id) DO NOTHING;

-- SEED DE MOVIMENTACOES DE ESTOQUE
INSERT INTO public.movimentacoes_estoque (id, data_hora, produto_id, nome_produto, tipo, quantidade, unidade, usuario, fornecedor, motivo) VALUES
  ('sm-01', '2025-03-17T14:30:00Z', 'prod-1', 'Heineken Long Neck 330ml', 'Entrada', 48.00, 'un', 'Carlos Gerente', 'Distribuidora Pirajá Bebidas', 'NF-e 45291 - Entrega semanal'),
  ('sm-02', '2025-03-17T15:10:00Z', 'prod-10', 'Picanha na Chapa com Mandioca', 'Entrada', 10.00, 'kg', 'Carlos Gerente', 'Frigorífico Estrela D’Oeste', 'Peças maturadas a vácuo'),
  ('sm-03', '2025-03-17T17:30:00Z', 'prod-12', 'Isca de Peixe com Molho Tártaro', 'Saída', 3.00, 'kg', 'Carlos Gerente', NULL, 'Avaria/descarte após inspeção de temperatura'),
  ('sm-04', '2025-03-17T18:40:00Z', 'prod-4', 'Chopp Pilsen Artesanal 500ml', 'Entrada', 50.00, 'L', 'Carlos Gerente', 'Cervejaria Colorado Campinas', 'Barril 50L acoplado')
ON CONFLICT (id) DO NOTHING;

-- SEED DE DOCUMENTOS FISCAIS
INSERT INTO public.documentos_fiscais (id, numero, serie, tipo, emitido_em, valor, status, nome_cliente, documento_cliente, comanda_id, chave_acesso) VALUES
  ('fisc-01', 'NFC-e 000.142', '001', 'NFC-e', '2025-03-17T18:12:00Z', 76.45, 'Autorizada', 'Consumidor Final', NULL, 'cmd-09', '35250314293842000184650010000001421098472819'),
  ('fisc-02', 'NFC-e 000.141', '001', 'NFC-e', '2025-03-17T17:45:00Z', 128.00, 'Autorizada', 'Marcos Vinicius', '341.***.***-09', NULL, '35250314293842000184650010000001411098472818'),
  ('fisc-03', 'NF-e 000.038', '001', 'NF-e', '2025-03-16T22:15:00Z', 620.00, 'Autorizada', 'Tech Eventos Corporativos Ltda', '19.482.948/0001-22', NULL, '35250314293842000184550010000000381098472812'),
  ('fisc-04', 'NFC-e 000.140', '001', 'NFC-e', '2025-03-16T21:40:00Z', 88.50, 'Cancelada', 'Consumidor Final', NULL, NULL, '35250314293842000184650010000001401098472817'),
  ('fisc-05', 'NFC-e 000.139', '001', 'NFC-e', '2025-03-16T20:25:00Z', 215.80, 'Autorizada', 'Camila Rocha', '284.***.***-71', NULL, '35250314293842000184650010000001391098472815')
ON CONFLICT (id) DO NOTHING;
