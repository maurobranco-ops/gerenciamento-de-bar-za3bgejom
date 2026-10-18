-- Migration: limpar_itens_antigos_fila_cozinha
-- Limpeza de registros de teste muito antigos (>24h) da fila de cozinha
-- Mantém a integridade referencial com comanda_itens e comandas.

DO $$
BEGIN
  -- 1. Remove itens entregues com mais de 24h para limpar o histórico visível
  DELETE FROM public.fila_cozinha
  WHERE status = 'entregue'
    AND created_at < (NOW() - INTERVAL '24 hours');

  -- 2. Atualiza itens antigos (>24h) que estavam travados em 'pronto', 'preparando' ou 'pendente'
  -- para que não fiquem na fila ativa com centenas de horas, ou remove-os se forem testes antigos.
  -- Conforme solicitação do usuário: itens velhos/teste com mais de 24h em estado não-entregue podem ser marcados entregues ou removidos.
  -- Vamos remover da fila de preparo para limpar definitivamente as colunas do KDS e fila ativa.
  DELETE FROM public.fila_cozinha
  WHERE created_at < (NOW() - INTERVAL '24 hours');
END $$;
