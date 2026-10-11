-- Migração: 20261011030000_harden_rls_and_kitchen_indexes.sql
-- Objetivo do Passo 3: Endurecer a segurança das policies RLS.
--
-- CONTEXTO DE AUTENTICAÇÃO:
-- Atualmente o Rachide Bar opera com perfis simulados no frontend (Garçom, Caixa, Gerente)
-- utilizando as roles padrão do PostgREST (anon e authenticated) sem GoTrue/Auth real obrigatório.
--
-- PLANO DE RESTRIÇÃO TOTAL POR PERFIL (quando houver autenticação real):
-- 1. Ao introduzir auth.users com claims / perfis (ex.: profiles.role IN ('Garcom', 'Caixa', 'Gerente')):
--    - 'produtos': Gerente tem ALL; Garçom e Caixa têm apenas SELECT.
--    - 'movimentacoes_estoque': Gerente tem ALL; outros têm SELECT.
--    - 'caixa_diarios' & 'movimentos_caixa': Caixa e Gerente têm SELECT/INSERT/UPDATE; Garçom não acessa.
--    - 'documentos_fiscais': Caixa e Gerente têm SELECT/INSERT/UPDATE; Garçom apenas SELECT.
--    - 'comandas' & 'comanda_itens': Todos autenticados têm SELECT/INSERT/UPDATE; DELETE apenas para itens cancelados por Gerente.
--    - 'fila_cozinha': Garçom, Cozinha e Gerente têm SELECT/INSERT/UPDATE; exclusão restrita a Gerente.
--    - 'mesas': Gerente tem ALL; Garçom e Caixa têm SELECT e UPDATE de status.
--
-- ENDURECIMENTO PRAGMÁTICO APLICADO AGORA:
-- 1. Remove policies excessivamente abertas (ALL) anteriores.
-- 2. Restringe operações destrutivas desnecessárias (ex.: DELETE proibido em documentos fiscais,
--    movimentos de caixa e movimentações de estoque para preservar trilha de auditoria).
-- 3. Em 'produtos': DELETE proibido; soft-delete via campo 'ativo = false'.
-- 4. Em 'documentos_fiscais': apenas SELECT, INSERT e UPDATE (cancelamento). DELETE nunca permitido.
-- 5. Em 'caixa_diarios': apenas SELECT, INSERT e UPDATE (fechamento). DELETE proibido.
-- 6. Em 'movimentos_caixa' e 'movimentacoes_estoque': apenas SELECT e INSERT (histórico imutável). DELETE/UPDATE proibidos.
-- 7. Em 'fila_cozinha': SELECT, INSERT, UPDATE de status e DELETE apenas com item.
-- 8. Adiciona índices para otimizar a fila de cozinha por status e área de preparo.

-- Índices úteis para a Fila de Cozinha
CREATE INDEX IF NOT EXISTS idx_fila_cozinha_status_area ON public.fila_cozinha(status, area_preparo);
CREATE INDEX IF NOT EXISTS idx_fila_cozinha_created_at ON public.fila_cozinha(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_produtos_ativo_categoria ON public.produtos(ativo, categoria);

-- ============================================================================
-- 1. PRODUTOS
-- ============================================================================
DROP POLICY IF EXISTS "anon_and_auth_produtos_all" ON public.produtos;
DROP POLICY IF EXISTS "produtos_select_policy" ON public.produtos;
DROP POLICY IF EXISTS "produtos_insert_policy" ON public.produtos;
DROP POLICY IF EXISTS "produtos_update_policy" ON public.produtos;
DROP POLICY IF EXISTS "produtos_delete_policy" ON public.produtos;

CREATE POLICY "produtos_select_policy" ON public.produtos
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "produtos_insert_policy" ON public.produtos
  FOR INSERT TO anon, authenticated WITH CHECK (
    nome IS NOT NULL AND length(trim(nome)) > 0 AND preco >= 0
  );

CREATE POLICY "produtos_update_policy" ON public.produtos
  FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (preco >= 0);

-- Note: DELETE não é concedido para 'produtos' — desativação via coluna 'ativo = false'.

-- ============================================================================
-- 2. FILA DE COZINHA
-- ============================================================================
DROP POLICY IF EXISTS "anon_and_auth_fila_cozinha_all" ON public.fila_cozinha;
DROP POLICY IF EXISTS "fila_cozinha_select_policy" ON public.fila_cozinha;
DROP POLICY IF EXISTS "fila_cozinha_insert_policy" ON public.fila_cozinha;
DROP POLICY IF EXISTS "fila_cozinha_update_policy" ON public.fila_cozinha;
DROP POLICY IF EXISTS "fila_cozinha_delete_policy" ON public.fila_cozinha;

CREATE POLICY "fila_cozinha_select_policy" ON public.fila_cozinha
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "fila_cozinha_insert_policy" ON public.fila_cozinha
  FOR INSERT TO anon, authenticated WITH CHECK (
    area_preparo IN ('bar', 'cozinha') AND
    status IN ('pendente', 'preparando', 'pronto', 'entregue')
  );

CREATE POLICY "fila_cozinha_update_policy" ON public.fila_cozinha
  FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (
    status IN ('pendente', 'preparando', 'pronto', 'entregue')
  );

CREATE POLICY "fila_cozinha_delete_policy" ON public.fila_cozinha
  FOR DELETE TO anon, authenticated USING (true);

-- ============================================================================
-- 3. COMANDAS E ITENS
-- ============================================================================
DROP POLICY IF EXISTS "anon_and_auth_comandas_all" ON public.comandas;
DROP POLICY IF EXISTS "comandas_select_policy" ON public.comandas;
DROP POLICY IF EXISTS "comandas_insert_policy" ON public.comandas;
DROP POLICY IF EXISTS "comandas_update_policy" ON public.comandas;
DROP POLICY IF EXISTS "comandas_delete_policy" ON public.comandas;

CREATE POLICY "comandas_select_policy" ON public.comandas
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "comandas_insert_policy" ON public.comandas
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "comandas_update_policy" ON public.comandas
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "comandas_delete_policy" ON public.comandas
  FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_and_auth_comanda_itens_all" ON public.comanda_itens;
DROP POLICY IF EXISTS "comanda_itens_select_policy" ON public.comanda_itens;
DROP POLICY IF EXISTS "comanda_itens_insert_policy" ON public.comanda_itens;
DROP POLICY IF EXISTS "comanda_itens_update_policy" ON public.comanda_itens;
DROP POLICY IF EXISTS "comanda_itens_delete_policy" ON public.comanda_itens;

CREATE POLICY "comanda_itens_select_policy" ON public.comanda_itens
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "comanda_itens_insert_policy" ON public.comanda_itens
  FOR INSERT TO anon, authenticated WITH CHECK (quantidade > 0);

CREATE POLICY "comanda_itens_update_policy" ON public.comanda_itens
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (quantidade >= 0);

CREATE POLICY "comanda_itens_delete_policy" ON public.comanda_itens
  FOR DELETE TO anon, authenticated USING (true);

-- ============================================================================
-- 4. MESAS
-- ============================================================================
DROP POLICY IF EXISTS "anon_and_auth_mesas_all" ON public.mesas;
DROP POLICY IF EXISTS "mesas_select_policy" ON public.mesas;
DROP POLICY IF EXISTS "mesas_insert_policy" ON public.mesas;
DROP POLICY IF EXISTS "mesas_update_policy" ON public.mesas;
DROP POLICY IF EXISTS "mesas_delete_policy" ON public.mesas;

CREATE POLICY "mesas_select_policy" ON public.mesas
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "mesas_insert_policy" ON public.mesas
  FOR INSERT TO anon, authenticated WITH CHECK (numero > 0 AND capacidade > 0);

CREATE POLICY "mesas_update_policy" ON public.mesas
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (capacidade > 0);

CREATE POLICY "mesas_delete_policy" ON public.mesas
  FOR DELETE TO anon, authenticated USING (true);

-- ============================================================================
-- 5. MOVIMENTAÇÕES DE ESTOQUE (Histórico de auditoria: INSERT/SELECT apenas)
-- ============================================================================
DROP POLICY IF EXISTS "anon_and_auth_movimentacoes_estoque_all" ON public.movimentacoes_estoque;
DROP POLICY IF EXISTS "movimentacoes_estoque_select_policy" ON public.movimentacoes_estoque;
DROP POLICY IF EXISTS "movimentacoes_estoque_insert_policy" ON public.movimentacoes_estoque;

CREATE POLICY "movimentacoes_estoque_select_policy" ON public.movimentacoes_estoque
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "movimentacoes_estoque_insert_policy" ON public.movimentacoes_estoque
  FOR INSERT TO anon, authenticated WITH CHECK (quantidade > 0);

-- Sem UPDATE e sem DELETE em movimentacoes_estoque para blindar integridade histórica.

-- ============================================================================
-- 6. MOVIMENTOS DE CAIXA (Livro caixa imutável: INSERT/SELECT apenas)
-- ============================================================================
DROP POLICY IF EXISTS "anon_and_auth_movimentos_caixa_all" ON public.movimentos_caixa;
DROP POLICY IF EXISTS "movimentos_caixa_select_policy" ON public.movimentos_caixa;
DROP POLICY IF EXISTS "movimentos_caixa_insert_policy" ON public.movimentos_caixa;

CREATE POLICY "movimentos_caixa_select_policy" ON public.movimentos_caixa
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "movimentos_caixa_insert_policy" ON public.movimentos_caixa
  FOR INSERT TO anon, authenticated WITH CHECK (valor >= 0);

-- Sem UPDATE e sem DELETE em movimentos_caixa.

-- ============================================================================
-- 7. CAIXA DIÁRIOS
-- ============================================================================
DROP POLICY IF EXISTS "anon_and_auth_caixa_diarios_all" ON public.caixa_diarios;
DROP POLICY IF EXISTS "caixa_diarios_select_policy" ON public.caixa_diarios;
DROP POLICY IF EXISTS "caixa_diarios_insert_policy" ON public.caixa_diarios;
DROP POLICY IF EXISTS "caixa_diarios_update_policy" ON public.caixa_diarios;

CREATE POLICY "caixa_diarios_select_policy" ON public.caixa_diarios
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "caixa_diarios_insert_policy" ON public.caixa_diarios
  FOR INSERT TO anon, authenticated WITH CHECK (saldo_abertura >= 0);

CREATE POLICY "caixa_diarios_update_policy" ON public.caixa_diarios
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- Sem DELETE em caixa_diarios.

-- ============================================================================
-- 8. DOCUMENTOS FISCAIS (Inviolabilidade fiscal: sem DELETE)
-- ============================================================================
DROP POLICY IF EXISTS "anon_and_auth_documentos_fiscais_all" ON public.documentos_fiscais;
DROP POLICY IF EXISTS "documentos_fiscais_select_policy" ON public.documentos_fiscais;
DROP POLICY IF EXISTS "documentos_fiscais_insert_policy" ON public.documentos_fiscais;
DROP POLICY IF EXISTS "documentos_fiscais_update_policy" ON public.documentos_fiscais;

CREATE POLICY "documentos_fiscais_select_policy" ON public.documentos_fiscais
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "documentos_fiscais_insert_policy" ON public.documentos_fiscais
  FOR INSERT TO anon, authenticated WITH CHECK (valor >= 0);

CREATE POLICY "documentos_fiscais_update_policy" ON public.documentos_fiscais
  FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (status IN ('Autorizada', 'Cancelada'));

-- Sem DELETE em documentos_fiscais.
