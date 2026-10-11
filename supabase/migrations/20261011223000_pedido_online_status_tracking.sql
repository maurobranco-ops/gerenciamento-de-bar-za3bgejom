-- Migração para permitir acompanhamento de status do pedido pelo cliente público (anônimo)
-- e adicionar tabelas à publicação realtime do Supabase para atualização instantânea.

-- 1. Política RLS para leitura de fila_cozinha:
-- A página do cliente público pode consultar itens da fila de cozinha.
-- Para manter compatibilidade com usuários autenticados (gerente, caixa, garçom) e permitir
-- que clientes anônimos consultem o status do seu pedido/mesa sem bloquear chamadas:
DROP POLICY IF EXISTS "fila_cozinha_select_policy" ON public.fila_cozinha;
CREATE POLICY "fila_cozinha_select_policy" ON public.fila_cozinha
  FOR SELECT TO anon, authenticated
  USING (
    -- Usuários autenticados internos têm acesso irrestrito
    auth.role() = 'authenticated'
    -- Ou usuários anônimos podem ler itens vinculados a uma comanda ativa/em andamento
    OR EXISTS (
      SELECT 1 FROM public.comanda_itens ci
      JOIN public.comandas c ON c.id = ci.comanda_id
      WHERE ci.id = fila_cozinha.comanda_item_id
        AND c.status IN ('Ocupada', 'Aguardando Pagamento')
    )
  );

-- 2. Função RPC segura com SECURITY DEFINER para obter o status da fila de uma mesa ou comanda
-- Isso garante resposta rápida, com todos os campos necessários já enriquecidos (foto, nome, status, área, tempo)
-- sem expor pedidos de outras mesas.
CREATE OR REPLACE FUNCTION public.obter_status_pedido_mesa(
  p_mesa_numero integer DEFAULT NULL,
  p_comanda_id text DEFAULT NULL
)
RETURNS TABLE (
  fila_id uuid,
  comanda_item_id text,
  comanda_id text,
  mesa_numero integer,
  produto_id text,
  nome_produto text,
  categoria text,
  image_url text,
  quantidade integer,
  observacoes text,
  area_preparo text,
  status text,
  origem_online boolean,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    f.id AS fila_id,
    f.comanda_item_id,
    c.id AS comanda_id,
    c.mesa_numero,
    ci.produto_id,
    ci.nome_produto,
    p.categoria,
    p.image_url,
    ci.quantidade,
    f.observacoes,
    f.area_preparo,
    f.status,
    f.origem_online,
    f.created_at,
    f.updated_at
  FROM public.fila_cozinha f
  JOIN public.comanda_itens ci ON f.comanda_item_id = ci.id
  JOIN public.comandas c ON ci.comanda_id = c.id
  LEFT JOIN public.produtos p ON ci.produto_id = p.id
  WHERE (
    (p_comanda_id IS NOT NULL AND c.id = p_comanda_id)
    OR (p_mesa_numero IS NOT NULL AND c.mesa_numero = p_mesa_numero AND c.status IN ('Ocupada', 'Aguardando Pagamento'))
  )
  ORDER BY f.created_at DESC;
END;
$$;

-- Permissões de execução para anônimos e autenticados
GRANT EXECUTE ON FUNCTION public.obter_status_pedido_mesa(integer, text) TO anon, authenticated;

-- 3. Habilita Realtime na tabela fila_cozinha e comanda_itens se ainda não estiver na publicação supabase_realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'fila_cozinha'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.fila_cozinha;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'comanda_itens'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comanda_itens;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Ignora erro caso a publicação não suporte ALTER ou não exista nesta versão
    RAISE NOTICE 'Nota sobre realtime: %', SQLERRM;
END $$;
