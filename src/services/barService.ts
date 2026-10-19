import { supabase } from '@/lib/supabase/client'
import {
  TableRecord,
  MenuItem,
  Comanda,
  ComandaItem,
  CashMovement,
  StockMovement,
  FiscalDocument,
  CashRegisterDay,
  PaymentMethod,
  TableStatus,
  FilaCozinhaItem,
  KitchenStatus,
  AreaPreparo,
  BarSettings,
  DetalhesContaMesa,
  StatusContaCliente,
} from '../types/bar'

export const DEFAULT_BAR_SETTINGS: BarSettings = {
  id: 'principal',
  taxaServicoPadrao: 10,
  taxaEntregaDelivery: 7.5,
  razaoSocial: 'Rachide Bar & Petiscaria EIRELI',
  nomeFantasia: 'Rachide Bar',
  cnpj: '14.293.842/0001-84',
  inscricaoEstadual: '114.293.842.110',
  enderecoCompleto: 'Rua dos Boêmios, 142 - Vila Madalena, São Paulo - SP',
  telefone: '(11) 3849-2041',
  impressoraFiscalNome: 'Epson TM-T20X (Térmica 80mm)',
  impressoraFiscalAtiva: true,
  impressoraCozinhaNome: 'Bematech MP-4200 TH (Cozinha)',
  impressoraCozinhaAtiva: true,
  pixChave: '14293842000184',
  pixBeneficiarioNome: 'Rachide Bar',
  pixCidade: 'SAO PAULO',
}

// Bypass de tipo estático enquanto os types do Supabase gerados automaticamente não refletem a nova migração
const db = supabase as any

export interface SaveProductPayload {
  id?: string
  nome: string
  categoria: string
  preco: number
  descricao?: string
  unidade: string
  estoque: number
  estoque_minimo: number
  area_preparo: AreaPreparo
  ativo?: boolean
  image_url?: string
}

export const BarService = {
  // --- MESAS ---
  async fetchMesas(): Promise<TableRecord[]> {
    const { data, error } = await db.from('mesas').select('*').order('numero', { ascending: true })

    if (error) {
      console.error('Erro ao buscar mesas:', error)
      throw error
    }

    return (data || []).map((m: any) => ({
      id: m.id,
      numero: m.numero,
      status: m.status as TableStatus,
      capacidade: m.capacidade,
      createdAt: m.created_at,
      updatedAt: m.updated_at,
    }))
  },

  async addMesa(numero: number, capacidade: number): Promise<TableRecord> {
    const { data, error } = await db
      .from('mesas')
      .insert({
        numero,
        capacidade,
        status: 'Livre',
      })
      .select()
      .single()

    if (error || !data) {
      console.error('Erro ao adicionar mesa:', error)
      throw error || new Error('Não foi possível obter dados da nova mesa.')
    }

    // Também cria comanda vazia vinculada à mesa para manter integridade
    const comandaId = `cmd-${numero < 10 ? `0${numero}` : numero}`
    await db.from('comandas').upsert({
      id: comandaId,
      mesa_numero: numero,
      cliente_nome: null,
      pessoas: 0,
      status: 'Livre',
      total: 0,
      inclui_taxa_servico: true,
    })

    return {
      id: data.id,
      numero: data.numero,
      status: data.status as TableStatus,
      capacidade: data.capacidade,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
  },

  async updateMesaCapacidade(id: string, capacidade: number): Promise<void> {
    const { error: rpcError } = await db.rpc('gerente_atualizar_capacidade_mesa', {
      p_mesa_id: id,
      p_capacidade: capacidade,
    })

    if (rpcError) {
      console.warn(
        'RPC gerente_atualizar_capacidade_mesa falhou, tentando fallback direto:',
        rpcError,
      )
      const { error } = await db
        .from('mesas')
        .update({ capacidade, updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) {
        console.error('Erro ao atualizar capacidade da mesa:', error)
        throw error
      }
    }
  },

  async deleteMesa(id: string, numero: number): Promise<void> {
    // Primeiro remove a comanda se estiver Livre
    await db.from('comandas').delete().eq('mesa_numero', numero).eq('status', 'Livre')

    const { error } = await db.from('mesas').delete().eq('id', id)

    if (error) {
      console.error('Erro ao excluir mesa:', error)
      throw error
    }
  },

  // --- PRODUTOS ---
  async fetchProdutos(includeInactive = false): Promise<MenuItem[]> {
    let query = db.from('produtos').select('*').order('nome', { ascending: true })
    if (!includeInactive) {
      query = query.eq('ativo', true)
    }

    const { data, error } = await query

    if (error) {
      console.error('Erro ao buscar produtos:', error)
      throw error
    }

    return (data || []).map((p: any) => ({
      id: p.id,
      name: p.nome,
      category: p.categoria,
      price: Number(p.preco),
      description: p.descricao || '',
      unit: p.unidade,
      stock: Number(p.estoque),
      minStock: Number(p.estoque_minimo),
      areaPreparo: (p.area_preparo as AreaPreparo) || 'bar',
      ativo: p.ativo !== false,
      imageUrl: p.image_url || undefined,
    }))
  },

  async createProduto(payload: SaveProductPayload): Promise<MenuItem> {
    const id = payload.id || `prod-${Date.now()}`
    const nowIso = new Date().toISOString()
    const { data, error } = await db
      .from('produtos')
      .insert({
        id,
        nome: payload.nome.trim(),
        categoria: payload.categoria,
        preco: Number(payload.preco),
        descricao: payload.descricao || '',
        unidade: payload.unidade,
        estoque: Number(payload.estoque || 0),
        estoque_minimo: Number(payload.estoque_minimo || 0),
        area_preparo: payload.area_preparo || 'bar',
        ativo: payload.ativo !== false,
        image_url: payload.image_url || null,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select()
      .single()

    if (error || !data) {
      console.error('Erro ao criar produto:', error)
      throw error || new Error('Não foi possível criar o produto.')
    }

    return {
      id: data.id,
      name: data.nome,
      category: data.categoria,
      price: Number(data.preco),
      description: data.descricao || '',
      unit: data.unidade,
      stock: Number(data.estoque),
      minStock: Number(data.estoque_minimo),
      areaPreparo: data.area_preparo as AreaPreparo,
      ativo: data.ativo,
      imageUrl: data.image_url || undefined,
    }
  },

  async updateProduto(id: string, payload: Partial<SaveProductPayload>): Promise<MenuItem> {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    }
    if (payload.nome !== undefined) updateData.nome = payload.nome.trim()
    if (payload.categoria !== undefined) updateData.categoria = payload.categoria
    if (payload.preco !== undefined) updateData.preco = Number(payload.preco)
    if (payload.descricao !== undefined) updateData.descricao = payload.descricao
    if (payload.unidade !== undefined) updateData.unidade = payload.unidade
    if (payload.estoque !== undefined) updateData.estoque = Number(payload.estoque)
    if (payload.estoque_minimo !== undefined)
      updateData.estoque_minimo = Number(payload.estoque_minimo)
    if (payload.area_preparo !== undefined) updateData.area_preparo = payload.area_preparo
    if (payload.ativo !== undefined) updateData.ativo = payload.ativo
    if (payload.image_url !== undefined) updateData.image_url = payload.image_url

    const { data, error } = await db
      .from('produtos')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error || !data) {
      console.error('Erro ao atualizar produto:', error)
      throw error || new Error('Falha ao atualizar dados do produto.')
    }

    return {
      id: data.id,
      name: data.nome,
      category: data.categoria,
      price: Number(data.preco),
      description: data.descricao || '',
      unit: data.unidade,
      stock: Number(data.estoque),
      minStock: Number(data.estoque_minimo),
      areaPreparo: data.area_preparo as AreaPreparo,
      ativo: data.ativo,
      imageUrl: data.image_url || undefined,
    }
  },

  async toggleProdutoAtivo(id: string, currentAtivo: boolean): Promise<boolean> {
    const newAtivo = !currentAtivo
    const { error } = await db
      .from('produtos')
      .update({ ativo: newAtivo, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      console.error('Erro ao alterar status do produto:', error)
      throw error
    }
    return newAtivo
  },

  async updateProdutoEstoque(
    id: string,
    currentStock: number,
    minStock: number,
    unit: MenuItem['unit'],
  ): Promise<void> {
    const { error } = await db
      .from('produtos')
      .update({
        estoque: currentStock,
        estoque_minimo: minStock,
        unidade: unit,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      console.error('Erro ao atualizar estoque do produto:', error)
      throw error
    }
  },

  // --- COMANDAS & ITENS ---
  async fetchComandas(): Promise<Comanda[]> {
    const { data: mesasData, error: mesasErr } = await db
      .from('mesas')
      .select('*')
      .order('numero', { ascending: true })

    if (mesasErr) {
      console.error('Erro ao buscar mesas para comandas:', mesasErr)
      throw mesasErr
    }

    const { data: comandasData, error: cmdErr } = await db
      .from('comandas')
      .select('*, comanda_itens(*)')

    if (cmdErr) {
      console.error('Erro ao buscar comandas:', cmdErr)
      throw cmdErr
    }

    const comandasMap = new Map<number, any>()
    ;(comandasData || []).forEach((c: any) => {
      comandasMap.set(c.mesa_numero, c)
    })

    return (mesasData || []).map((m: any) => {
      const c = comandasMap.get(m.numero)
      const items: ComandaItem[] = (c?.comanda_itens || []).map((ci: any) => ({
        id: ci.id,
        menuItemId: ci.produto_id,
        name: ci.nome_produto,
        price: Number(ci.preco_unitario),
        quantity: ci.quantidade,
        observations: ci.observacoes || undefined,
        origemOnline: Boolean(ci.origem_online),
      }))

      // Salvaguarda: se a mesa for Livre OU (Ocupada e statusConta for 'fechada'), sanitiza para 'nenhum'
      const rawStatusConta = (c?.status_conta as StatusContaCliente) || 'nenhum'
      const statusMesa = (m.status as TableStatus) || 'Livre'
      const isLivre = statusMesa === 'Livre'
      const isOcupada = statusMesa === 'Ocupada' || c?.status === 'Ocupada'
      const statusContaSanitizado: StatusContaCliente =
        isLivre || (isOcupada && rawStatusConta === 'fechada') ? 'nenhum' : rawStatusConta
      const contaSolicitadaSanitizada =
        statusContaSanitizado === 'nenhum' ? false : Boolean(c?.conta_solicitada)

      return {
        id: c?.id || `cmd-${m.numero < 10 ? `0${m.numero}` : m.numero}`,
        tableNumber: m.numero,
        clientName: c?.cliente_nome || undefined,
        guestCount: c?.pessoas ?? 0,
        status: statusMesa,
        openedAt: c?.aberta_em || '',
        closedAt: c?.fechada_em || undefined,
        includeServiceFee: c ? Boolean(c.inclui_taxa_servico) : true,
        capacity: m.capacidade,
        contaSolicitada: contaSolicitadaSanitizada,
        contaSolicitadaEm:
          statusContaSanitizado === 'nenhum' ? undefined : c?.conta_solicitada_em || undefined,
        formaPagamentoSolicitada:
          statusContaSanitizado === 'nenhum'
            ? undefined
            : (c?.forma_pagamento_solicitada as PaymentMethod | undefined),
        statusConta: statusContaSanitizado,
        motivoRecusaConta:
          statusContaSanitizado === 'recusada' ? c?.motivo_recusa_conta || undefined : undefined,
        items,
      }
    })
  },

  /**
   * Helper central de salvaguarda: campos do fluxo de conta totalmente limpos
   */
  getCleanContaFlowFields() {
    return {
      status_conta: 'nenhum' as const,
      conta_solicitada: false,
      conta_solicitada_em: null,
      forma_pagamento_solicitada: null,
      motivo_recusa_conta: null,
    }
  },

  async openComanda(tableNumber: number, guestCount: number, clientName?: string): Promise<void> {
    const openedAt = new Date().toISOString()
    const comandaId = `cmd-${tableNumber < 10 ? `0${tableNumber}` : tableNumber}`

    // 1. Atualizar mesa
    await db
      .from('mesas')
      .update({ status: 'Ocupada', updated_at: openedAt })
      .eq('numero', tableNumber)

    // 2. Upsert comanda com salvaguarda total do fluxo de conta
    await db.from('comandas').upsert({
      id: comandaId,
      mesa_numero: tableNumber,
      cliente_nome: clientName || `Mesa ${tableNumber}`,
      pessoas: guestCount || 1,
      status: 'Ocupada',
      aberta_em: openedAt,
      fechada_em: null,
      inclui_taxa_servico: true,
      total: 0,
      ...this.getCleanContaFlowFields(),
      updated_at: openedAt,
    })

    // Limpa itens antigos se houver
    await db.from('comanda_itens').delete().eq('comanda_id', comandaId)
  },

  /**
   * Inicia atendimento on-line registrando o nome do cliente na comanda
   * e resetando todo estado residual de conta
   */
  async iniciarAtendimentoOnline(
    mesaNumero: number,
    clienteNome: string,
  ): Promise<{
    sucesso: boolean
    comanda_id?: string
    mesa_numero?: number
    cliente_nome?: string
    mensagem: string
  }> {
    const { data, error } = await db.rpc('iniciar_atendimento_online', {
      p_mesa_numero: mesaNumero,
      p_cliente_nome: clienteNome,
    })

    if (error) {
      console.error('Erro ao chamar RPC iniciar_atendimento_online:', error)
      throw error
    }

    return data
  },

  async addItemToComanda(tableNumber: number, item: MenuItem, quantity = 1): Promise<void> {
    const comandaId = `cmd-${tableNumber < 10 ? `0${tableNumber}` : tableNumber}`

    // 1. Checar se item já existe na comanda
    const { data: existing } = await db
      .from('comanda_itens')
      .select('*')
      .eq('comanda_id', comandaId)
      .eq('produto_id', item.id)
      .maybeSingle()

    let itemId = existing?.id
    if (existing) {
      await db
        .from('comanda_itens')
        .update({
          quantidade: existing.quantidade + quantity,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
    } else {
      itemId = `ci-${Date.now()}-${Math.floor(Math.random() * 1000)}`
      await db.from('comanda_itens').insert({
        id: itemId,
        comanda_id: comandaId,
        produto_id: item.id,
        nome_produto: item.name,
        preco_unitario: item.price,
        quantidade: quantity,
      })
    }

    // 2. Abater estoque no banco via RPC segura com fallback
    const newStock = Math.max(0, Number((item.stock - quantity).toFixed(2)))
    const { error: stockRpcErr } = await db.rpc('abater_estoque_comanda', {
      p_produto_id: item.id,
      p_delta: quantity,
    })
    if (stockRpcErr) {
      console.warn('RPC abater_estoque_comanda fallback:', stockRpcErr)
      await db
        .from('produtos')
        .update({ estoque: newStock, updated_at: new Date().toISOString() })
        .eq('id', item.id)
    }

    // 3. Atualizar mesa para 'Ocupada' com salvaguarda de fluxo de conta
    const nowIso = new Date().toISOString()
    await db
      .from('mesas')
      .update({ status: 'Ocupada', updated_at: nowIso })
      .eq('numero', tableNumber)

    // Ao colocar pedidos e manter a mesa ocupada, garante que status_conta residual nunca persista
    await db
      .from('comandas')
      .update({
        status: 'Ocupada',
        ...this.getCleanContaFlowFields(),
        updated_at: nowIso,
      })
      .eq('id', comandaId)

    // 4. Prepara fila de cozinha/bar conforme campo area_preparo do produto (ou fallback pela categoria)
    if (itemId) {
      let area: AreaPreparo = 'bar'
      if (item.areaPreparo) {
        area = item.areaPreparo
      } else {
        // Fallback baseado na categoria
        area = ['Cervejas', 'Drinks', 'Destilados', 'Refrigerantes'].includes(item.category)
          ? 'bar'
          : 'cozinha'
      }

      await db.from('fila_cozinha').insert({
        comanda_item_id: itemId,
        area_preparo: area,
        status: 'pendente',
        observacoes: null,
      })
    }
  },

  async updateComandaItemQuantity(
    itemId: string,
    delta: number,
    productId: string,
    currentQty: number,
    currentProductStock: number,
  ): Promise<void> {
    const newQty = currentQty + delta
    if (newQty <= 0) {
      await db.from('comanda_itens').delete().eq('id', itemId)
    } else {
      await db
        .from('comanda_itens')
        .update({
          quantidade: newQty,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId)
    }

    const newStock = Math.max(0, Number((currentProductStock - delta).toFixed(2)))
    const { error: stockRpcErr } = await db.rpc('abater_estoque_comanda', {
      p_produto_id: productId,
      p_delta: delta,
    })
    if (stockRpcErr) {
      console.warn('RPC abater_estoque_comanda fallback:', stockRpcErr)
      await db
        .from('produtos')
        .update({ estoque: newStock, updated_at: new Date().toISOString() })
        .eq('id', productId)
    }
  },

  async toggleServiceFee(tableNumber: number, currentValue: boolean): Promise<void> {
    const comandaId = `cmd-${tableNumber < 10 ? `0${tableNumber}` : tableNumber}`
    await db
      .from('comandas')
      .update({
        inclui_taxa_servico: !currentValue,
        updated_at: new Date().toISOString(),
      })
      .eq('id', comandaId)
  },

  async closeAndPayComanda(
    tableNumber: number,
    paymentMethod: PaymentMethod,
    amountPaid: number,
    roleUser: string,
    clientName?: string,
    splitGuests?: number,
  ): Promise<{ newMovement: CashMovement; newFiscal: FiscalDocument }> {
    const comandaId = `cmd-${tableNumber < 10 ? `0${tableNumber}` : tableNumber}`
    const nowIso = new Date().toISOString()

    // 1. Atualizar mesa para Livre
    await db.from('mesas').update({ status: 'Livre', updated_at: nowIso }).eq('numero', tableNumber)

    // 2. Atualizar comanda para Fechada / Livre e limpar itens com salvaguarda de campos de conta
    await db
      .from('comandas')
      .update({
        status: 'Livre',
        cliente_nome: null,
        pessoas: 0,
        fechada_em: nowIso,
        total: 0,
        ...this.getCleanContaFlowFields(),
        updated_at: nowIso,
      })
      .eq('id', comandaId)

    await db.from('comanda_itens').delete().eq('comanda_id', comandaId)

    // 3. Inserir movimento no caixa
    const movId = `cm-${Date.now()}`
    const desc = `Pagamento Mesa ${tableNumber} (${splitGuests && splitGuests > 1 ? `${splitGuests} pessoas` : 'Integral'})`
    const { error: movRpcErr } = await db.rpc('registrar_movimento_caixa_seguro', {
      p_id: movId,
      p_tipo: 'Entrada',
      p_descricao: desc,
      p_valor: amountPaid,
      p_forma_pagamento: paymentMethod,
      p_comanda_id: comandaId,
    })
    if (movRpcErr) {
      console.warn('RPC registrar_movimento_caixa_seguro fallback direto:', movRpcErr)
      const { error: movErr } = await db.from('movimentos_caixa').insert({
        id: movId,
        data_hora: nowIso,
        descricao: desc,
        tipo: 'Entrada',
        forma_pagamento: paymentMethod,
        valor: amountPaid,
        usuario: roleUser,
        comanda_id: comandaId,
      })
      if (movErr) console.error('Erro ao salvar movimento de caixa:', movErr)
    }

    // 4. Inserir documento fiscal simulado
    const seq = Math.floor(100 + Math.random() * 900)
    const docNumber = `NFC-e 000.${seq}`
    const fiscId = `fisc-${Date.now()}`
    const accessKey = `3525031429384200018465001000000${Math.floor(1000000000 + Math.random() * 9000000000)}`

    const { error: fiscErr } = await db.from('documentos_fiscais').insert({
      id: fiscId,
      numero: docNumber,
      serie: '001',
      tipo: 'NFC-e',
      emitido_em: nowIso,
      valor: amountPaid,
      status: 'Autorizada',
      nome_cliente: clientName || 'Consumidor Final',
      comanda_id: comandaId,
      chave_acesso: accessKey,
    })
    if (fiscErr) console.error('Erro ao salvar doc fiscal:', fiscErr)

    return {
      newMovement: {
        id: movId,
        datetime: nowIso,
        description: desc,
        type: 'Entrada',
        paymentMethod,
        value: amountPaid,
        user: roleUser,
        comandaId,
      },
      newFiscal: {
        id: fiscId,
        number: docNumber,
        serie: '001',
        type: 'NFC-e',
        issuedAt: nowIso,
        value: amountPaid,
        status: 'Autorizada',
        clientName: clientName || 'Consumidor Final',
        comandaId,
        accessKey,
      },
    }
  },

  // --- ESTOQUE & MOVIMENTAÇÕES ---
  async fetchStockMovements(): Promise<StockMovement[]> {
    const { data, error } = await db
      .from('movimentacoes_estoque')
      .select('*')
      .order('data_hora', { ascending: false })

    if (error) {
      console.error('Erro ao buscar movimentações de estoque:', error)
      throw error
    }

    return (data || []).map((m: any) => ({
      id: m.id,
      datetime: m.data_hora,
      productId: m.produto_id,
      productName: m.nome_produto,
      type: m.tipo as 'Entrada' | 'Saída',
      quantity: Number(m.quantidade),
      unit: m.unidade,
      user: m.usuario,
      supplier: m.fornecedor || undefined,
      notes: m.motivo || undefined,
    }))
  },

  async addStockSupply(
    productId: string,
    quantity: number,
    supplier: string,
    user: string,
    productName: string,
    unit: MenuItem['unit'],
    currentStock: number,
    notes?: string,
  ): Promise<StockMovement> {
    const nowIso = new Date().toISOString()
    const smId = `sm-${Date.now()}`
    const newStock = Number((currentStock + quantity).toFixed(2))

    // 1. Atualizar produto
    await db.from('produtos').update({ estoque: newStock, updated_at: nowIso }).eq('id', productId)

    // 2. Inserir movimento
    await db.from('movimentacoes_estoque').insert({
      id: smId,
      data_hora: nowIso,
      produto_id: productId,
      nome_produto: productName,
      tipo: 'Entrada',
      quantidade: quantity,
      unidade: unit,
      usuario: user,
      fornecedor: supplier,
      motivo: notes || null,
    })

    return {
      id: smId,
      datetime: nowIso,
      productId,
      productName,
      type: 'Entrada',
      quantity,
      unit,
      user,
      supplier,
      notes,
    }
  },

  // --- CAIXA ---
  async fetchCashDays(): Promise<CashRegisterDay[]> {
    const { data, error } = await db
      .from('caixa_diarios')
      .select('*')
      .order('data', { ascending: false })

    if (error) {
      console.error('Erro ao buscar dias de caixa:', error)
      throw error
    }

    return (data || []).map((d: any) => ({
      date: d.data,
      openingBalance: Number(d.saldo_abertura),
      isClosed: Boolean(d.fechado),
      closedAt: d.fechado_em || undefined,
      closedBy: d.fechado_por || undefined,
    }))
  },

  async fetchCashMovements(): Promise<CashMovement[]> {
    const { data, error } = await db
      .from('movimentos_caixa')
      .select('*')
      .order('data_hora', { ascending: false })

    if (error) {
      console.error('Erro ao buscar movimentos de caixa:', error)
      throw error
    }

    return (data || []).map((m: any) => ({
      id: m.id,
      datetime: m.data_hora,
      description: m.descricao,
      type: m.tipo as 'Entrada' | 'Saída',
      paymentMethod: (m.forma_pagamento as PaymentMethod) || 'Dinheiro',
      value: Number(m.valor),
      user: m.usuario,
      comandaId: m.comanda_id || undefined,
    }))
  },

  async addCashMovement(
    type: 'Entrada' | 'Saída',
    description: string,
    value: number,
    user: string,
    paymentMethod?: PaymentMethod,
  ): Promise<CashMovement> {
    const nowIso = new Date().toISOString()
    const id = `cm-${Date.now()}`

    const { error: movRpcErr } = await db.rpc('registrar_movimento_caixa_seguro', {
      p_id: id,
      p_tipo: type,
      p_descricao: description,
      p_valor: value,
      p_forma_pagamento: paymentMethod || 'Dinheiro',
      p_comanda_id: null,
    })

    if (movRpcErr) {
      console.warn('RPC registrar_movimento_caixa_seguro fallback direto:', movRpcErr)
      const { error } = await db.from('movimentos_caixa').insert({
        id,
        data_hora: nowIso,
        descricao: description,
        tipo: type,
        forma_pagamento: paymentMethod || 'Dinheiro',
        valor: value,
        usuario: user,
      })
      if (error) {
        console.error('Erro ao adicionar movimento no caixa:', error)
        throw error
      }
    }

    return {
      id,
      datetime: nowIso,
      description,
      type,
      paymentMethod: paymentMethod || 'Dinheiro',
      value,
      user,
    }
  },

  async closeCashRegister(date: string, closedBy: string): Promise<void> {
    const nowIso = new Date().toISOString()
    await db.from('caixa_diarios').upsert({
      data: date,
      fechado: true,
      fechado_em: nowIso,
      fechado_por: closedBy,
    })
  },

  // --- DOCUMENTOS FISCAIS ---
  async fetchFiscalDocs(): Promise<FiscalDocument[]> {
    const { data, error } = await db
      .from('documentos_fiscais')
      .select('*')
      .order('emitido_em', { ascending: false })

    if (error) {
      console.error('Erro ao buscar documentos fiscais:', error)
      throw error
    }

    return (data || []).map((d: any) => ({
      id: d.id,
      number: d.numero,
      serie: d.serie,
      type: d.tipo as FiscalDocument['type'],
      issuedAt: d.emitido_em,
      value: Number(d.valor),
      status: d.status as 'Autorizada' | 'Cancelada',
      clientName: d.nome_cliente || undefined,
      docNumber: d.documento_cliente || undefined,
      comandaId: d.comanda_id || undefined,
      accessKey: d.chave_acesso || undefined,
    }))
  },

  async issueFiscalDoc(data: {
    type: 'NFC-e' | 'NF-e'
    comandaId?: string
    clientName?: string
    docNumber?: string
    value: number
  }): Promise<FiscalDocument> {
    const nowIso = new Date().toISOString()
    const docPrefix = data.type === 'NFC-e' ? 'NFC-e' : 'NF-e'
    const seq = Math.floor(100 + Math.random() * 900)
    const number = `${docPrefix} 000.${seq}`
    const id = `fisc-${Date.now()}`
    const accessKey = `35250314293842000184${data.type === 'NFC-e' ? '65' : '55'}001000000${seq}1098472810`

    await db.from('documentos_fiscais').insert({
      id,
      numero: number,
      serie: '001',
      tipo: data.type,
      emitido_em: nowIso,
      valor: data.value,
      status: 'Autorizada',
      nome_cliente: data.clientName || 'Consumidor Final',
      documento_cliente: data.docNumber || null,
      comanda_id: data.comandaId || null,
      chave_acesso: accessKey,
    })

    return {
      id,
      number,
      serie: '001',
      type: data.type,
      issuedAt: nowIso,
      value: data.value,
      status: 'Autorizada',
      clientName: data.clientName || 'Consumidor Final',
      docNumber: data.docNumber,
      comandaId: data.comandaId,
      accessKey,
    }
  },

  async cancelFiscalDoc(id: string): Promise<void> {
    const { error: rpcErr } = await db.rpc('cancelar_documento_fiscal', {
      p_documento_id: id,
    })
    if (rpcErr) {
      console.warn('RPC cancelar_documento_fiscal fallback direto:', rpcErr)
      const { error } = await db
        .from('documentos_fiscais')
        .update({ status: 'Cancelada' })
        .eq('id', id)
      if (error) throw error
    }
  },

  // --- FILA DE COZINHA & BAR ---
  async fetchFilaCozinha(): Promise<FilaCozinhaItem[]> {
    const { data, error } = await db
      .from('fila_cozinha')
      .select(`
        id,
        comanda_item_id,
        area_preparo,
        status,
        observacoes,
        created_at,
        updated_at,
        comanda_itens (
          id,
          nome_produto,
          quantidade,
          preco_unitario,
          comanda_id,
          comandas (
            id,
            mesa_numero,
            cliente_nome
          )
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Erro ao buscar fila da cozinha:', error)
      throw error
    }

    return (data || []).map((row: any) => {
      const item = row.comanda_itens
      const comanda = item?.comandas
      return {
        id: row.id,
        comandaItemId: row.comanda_item_id,
        areaPreparo: (row.area_preparo as AreaPreparo) || 'cozinha',
        status: (row.status as KitchenStatus) || 'pendente',
        observacoes: row.observacoes || undefined,
        origemOnline: Boolean(row.origem_online),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        nomeProduto: item?.nome_produto,
        quantidade: item?.quantidade,
        precoUnitario: item ? Number(item.preco_unitario) : undefined,
        mesaNumero: comanda?.mesa_numero,
        clienteNome: comanda?.cliente_nome,
        comandaId: item?.comanda_id,
      }
    })
  },

  async updateFilaStatus(id: string, status: KitchenStatus): Promise<void> {
    // Tenta primeiro a RPC segura atualizar_status_item_fila que valida o perfil no banco
    const { error: rpcErr } = await db.rpc('atualizar_status_item_fila', {
      p_item_id: id,
      p_novo_status: status,
    })

    if (rpcErr) {
      console.warn('RPC atualizar_status_item_fila fallback direto:', rpcErr)
      const { error } = await db
        .from('fila_cozinha')
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (error) {
        console.error('Erro ao atualizar status da fila de cozinha:', error)
        throw error
      }
    }
  },

  async deleteFilaItem(id: string): Promise<void> {
    const { error } = await db.from('fila_cozinha').delete().eq('id', id)
    if (error) {
      console.error('Erro ao remover item da fila:', error)
      throw error
    }
  },

  // --- PEDIDOS ON-LINE (RPC PARA ANON & AUTH) ---
  async enviarPedidoOnline(payload: {
    mesaNumero: number
    clienteNome: string
    itens: Array<{ produto_id: string; quantidade: number; observacoes?: string }>
  }): Promise<{ sucesso: boolean; comanda_id: string; mensagem: string }> {
    const { data, error } = await db.rpc('enviar_pedido_online', {
      p_mesa_numero: payload.mesaNumero,
      p_cliente_nome: payload.clienteNome,
      p_itens: payload.itens,
    })

    if (error) {
      console.error('Erro ao chamar RPC enviar_pedido_online:', error)
      throw error
    }

    return data
  },

  // --- PEDIR A CONTA & FECHAMENTO PELO CAIXA ---
  async solicitarContaMesa(
    mesaNumero: number,
    formaPagamento: PaymentMethod,
    desejaNfce: boolean = false,
  ): Promise<{
    sucesso: boolean
    codigo?: string
    comanda_id?: string
    mesa_numero?: number
    forma_pagamento?: string
    nfce_solicitada?: boolean
    subtotal?: number
    taxa_servico?: number
    total?: number
    status_conta?: StatusContaCliente
    mensagem: string
  }> {
    const { data, error } = await (db.rpc as any)('solicitar_conta_mesa', {
      p_mesa_numero: mesaNumero,
      p_forma_pagamento: formaPagamento,
      p_deseja_nfce: desejaNfce,
    })

    if (error) {
      console.error('Erro ao chamar RPC solicitar_conta_mesa:', error)
      throw error
    }

    return data
  },

  async obterDetalhesContaMesa(mesaNumero: number): Promise<DetalhesContaMesa> {
    const { data, error } = await (db.rpc as any)('obter_detalhes_conta_mesa', {
      p_mesa_numero: mesaNumero,
    })

    if (error) {
      console.error('Erro ao chamar RPC obter_detalhes_conta_mesa:', error)
      throw error
    }

    const rawStatus = (data?.status_conta as StatusContaCliente) || 'nenhum'
    const statusMesa = data?.status_mesa
    const isOcupada = statusMesa === 'Ocupada'
    // Se a mesa estiver sendo reaberta / Ocupada com resíduo anterior 'fechada', sanitiza
    const statusContaSanitizado: StatusContaCliente =
      isOcupada && rawStatus === 'fechada' ? 'nenhum' : rawStatus

    let nfceDoc: FiscalDocument | null = null
    if (data?.nfce_documento) {
      const doc = data.nfce_documento
      nfceDoc = {
        id: doc.id,
        number: doc.numero,
        serie: doc.serie || '001',
        type: doc.tipo || 'NFC-e',
        issuedAt: doc.emitido_em,
        value: Number(doc.valor || 0),
        status: doc.status || 'Autorizada',
        clientName: doc.nome_cliente || undefined,
        docNumber: doc.documento_cliente || undefined,
        accessKey: doc.chave_acesso || undefined,
      }
    }

    return {
      encontrada: Boolean(data?.encontrada),
      comandaId: data?.comanda_id,
      mesaNumero: data?.mesa_numero,
      clienteNome: data?.cliente_nome,
      pessoas: data?.pessoas,
      statusMesa: data?.status_mesa,
      contaSolicitada: Boolean(data?.conta_solicitada),
      contaSolicitadaEm: data?.conta_solicitada_em || undefined,
      formaPagamentoSolicitada: data?.forma_pagamento_solicitada || undefined,
      statusConta: statusContaSanitizado,
      nfceSolicitada: Boolean(data?.nfce_solicitada),
      nfceDocumento: nfceDoc,
      fechadaEm: data?.fechada_em || undefined,
      motivoRecusaConta:
        statusContaSanitizado === 'recusada' ? data?.motivo_recusa_conta : undefined,
      subtotal: data?.subtotal !== undefined ? Number(data.subtotal) : undefined,
      taxaPercentual:
        data?.taxa_percentual !== undefined ? Number(data.taxa_percentual) : undefined,
      taxaServico: data?.taxa_servico !== undefined ? Number(data.taxa_servico) : undefined,
      incluiTaxaServico: Boolean(data?.inclui_taxa_servico),
      total: data?.total !== undefined ? Number(data.total) : undefined,
      itens: data?.itens || [],
      barInfo: data?.bar_info
        ? {
            razaoSocial: data.bar_info.razao_social,
            nomeFantasia: data.bar_info.nome_fantasia,
            cnpj: data.bar_info.cnpj,
            inscricaoEstadual: data.bar_info.inscricao_estadual,
            enderecoCompleto: data.bar_info.endereco_completo,
            telefone: data.bar_info.telefone,
            impressoraFiscalNome: data.bar_info.impressora_fiscal_nome,
          }
        : undefined,
      pixChave: data?.pix_chave || undefined,
      pixBeneficiarioNome: data?.pix_beneficiario_nome || undefined,
      pixCidade: data?.pix_cidade || undefined,
    }
  },

  async obterNfceComandaMesa(mesaNumero: number): Promise<{
    sucesso: boolean
    documento?: FiscalDocument
    barInfo?: any
    mensagem?: string
  }> {
    const { data, error } = await (db.rpc as any)('obter_nfce_comanda_mesa', {
      p_mesa_numero: mesaNumero,
    })

    if (error) {
      console.error('Erro ao chamar RPC obter_nfce_comanda_mesa:', error)
      throw error
    }

    if (!data?.sucesso || !data?.documento) {
      return { sucesso: false, mensagem: data?.mensagem || 'Documento não encontrado.' }
    }

    const doc = data.documento
    return {
      sucesso: true,
      documento: {
        id: doc.id,
        number: doc.numero,
        serie: doc.serie || '001',
        type: doc.tipo || 'NFC-e',
        issuedAt: doc.emitido_em,
        value: Number(doc.valor || 0),
        status: doc.status || 'Autorizada',
        clientName: doc.nome_cliente || undefined,
        docNumber: doc.documento_cliente || undefined,
        accessKey: doc.chave_acesso || undefined,
      },
      barInfo: data.bar_info,
    }
  },

  async caixaAutorizarFecharConta(params: {
    mesaNumero: number
    formaPagamento: PaymentMethod
    valorPago: number
    marcarEmProcessamentoPix?: boolean
  }): Promise<{
    sucesso: boolean
    comanda_id?: string
    mesa_numero?: number
    status_conta?: StatusContaCliente
    movimento_id?: string
    fiscal_numero?: string
    valor_pago?: number
    forma_pagamento?: string
    mensagem: string
  }> {
    const { data, error } = await db.rpc('caixa_autorizar_fechar_conta', {
      p_mesa_numero: params.mesaNumero,
      p_forma_pagamento: params.formaPagamento,
      p_valor_pago: params.valorPago,
      p_marcar_em_processamento_pix: Boolean(params.marcarEmProcessamentoPix),
    })

    if (error) {
      console.error('Erro ao chamar RPC caixa_autorizar_fechar_conta:', error)
      throw error
    }

    return data
  },

  async caixaRecusarAdiarConta(
    mesaNumero: number,
    motivo: string,
  ): Promise<{
    sucesso: boolean
    mesa_numero: number
    status_mesa: TableStatus
    status_conta: StatusContaCliente
    motivo: string
    mensagem: string
  }> {
    const { data, error } = await db.rpc('caixa_recusar_adiar_conta', {
      p_mesa_numero: mesaNumero,
      p_motivo: motivo,
    })

    if (error) {
      console.error('Erro ao chamar RPC caixa_recusar_adiar_conta:', error)
      throw error
    }

    return data
  },

  // --- CONFIGURAÇÕES DO BAR ---
  async fetchConfiguracoes(): Promise<BarSettings> {
    const { data, error } = await db
      .from('configuracoes_bar')
      .select('*')
      .eq('id', 'principal')
      .maybeSingle()

    if (error) {
      console.error('Erro ao buscar configurações do bar:', error)
      return DEFAULT_BAR_SETTINGS
    }

    if (!data) return DEFAULT_BAR_SETTINGS

    return {
      id: data.id,
      taxaServicoPadrao: Number(data.taxa_servico_padrao ?? 10),
      taxaEntregaDelivery: Number(data.taxa_entrega_delivery ?? 7.5),
      razaoSocial: data.razao_social || DEFAULT_BAR_SETTINGS.razaoSocial,
      nomeFantasia: data.nome_fantasia || DEFAULT_BAR_SETTINGS.nomeFantasia,
      cnpj: data.cnpj || DEFAULT_BAR_SETTINGS.cnpj,
      inscricaoEstadual: data.inscricao_estadual || DEFAULT_BAR_SETTINGS.inscricaoEstadual,
      enderecoCompleto: data.endereco_completo || DEFAULT_BAR_SETTINGS.enderecoCompleto,
      telefone: data.telefone || DEFAULT_BAR_SETTINGS.telefone,
      impressoraFiscalNome:
        data.impressora_fiscal_nome || DEFAULT_BAR_SETTINGS.impressoraFiscalNome,
      impressoraFiscalAtiva: data.impressora_fiscal_ativa ?? true,
      impressoraCozinhaNome:
        data.impressora_cozinha_nome || DEFAULT_BAR_SETTINGS.impressoraCozinhaNome,
      impressoraCozinhaAtiva: data.impressora_cozinha_ativa ?? true,
      pixChave: data.pix_chave ?? DEFAULT_BAR_SETTINGS.pixChave,
      pixBeneficiarioNome: data.pix_beneficiario_nome || DEFAULT_BAR_SETTINGS.pixBeneficiarioNome,
      pixCidade: data.pix_cidade || DEFAULT_BAR_SETTINGS.pixCidade,
      updatedAt: data.updated_at,
    }
  },

  async updateConfiguracoes(settings: Partial<BarSettings>): Promise<BarSettings> {
    const payload: any = {
      updated_at: new Date().toISOString(),
    }
    if (settings.taxaServicoPadrao !== undefined) {
      payload.taxa_servico_padrao = Number(settings.taxaServicoPadrao)
    }
    if (settings.taxaEntregaDelivery !== undefined) {
      payload.taxa_entrega_delivery = Number(settings.taxaEntregaDelivery)
    }
    if (settings.razaoSocial !== undefined) payload.razao_social = settings.razaoSocial
    if (settings.nomeFantasia !== undefined) payload.nome_fantasia = settings.nomeFantasia
    if (settings.cnpj !== undefined) payload.cnpj = settings.cnpj
    if (settings.inscricaoEstadual !== undefined)
      payload.inscricao_estadual = settings.inscricaoEstadual
    if (settings.enderecoCompleto !== undefined)
      payload.endereco_completo = settings.enderecoCompleto
    if (settings.telefone !== undefined) payload.telefone = settings.telefone
    if (settings.impressoraFiscalNome !== undefined)
      payload.impressora_fiscal_nome = settings.impressoraFiscalNome
    if (settings.impressoraFiscalAtiva !== undefined)
      payload.impressora_fiscal_ativa = settings.impressoraFiscalAtiva
    if (settings.impressoraCozinhaNome !== undefined)
      payload.impressora_cozinha_nome = settings.impressoraCozinhaNome
    if (settings.impressoraCozinhaAtiva !== undefined)
      payload.impressora_cozinha_ativa = settings.impressoraCozinhaAtiva
    if (settings.pixChave !== undefined) payload.pix_chave = settings.pixChave
    if (settings.pixBeneficiarioNome !== undefined)
      payload.pix_beneficiario_nome = settings.pixBeneficiarioNome
    if (settings.pixCidade !== undefined) payload.pix_cidade = settings.pixCidade

    const { data, error } = await db
      .from('configuracoes_bar')
      .upsert({ id: 'principal', ...payload })
      .select()
      .single()

    if (error || !data) {
      console.error('Erro ao atualizar configurações:', error)
      throw error || new Error('Não foi possível salvar as configurações.')
    }

    return {
      id: data.id,
      taxaServicoPadrao: Number(data.taxa_servico_padrao),
      taxaEntregaDelivery: Number(data.taxa_entrega_delivery),
      razaoSocial: data.razao_social,
      nomeFantasia: data.nome_fantasia,
      cnpj: data.cnpj,
      inscricaoEstadual: data.inscricao_estadual,
      enderecoCompleto: data.endereco_completo,
      telefone: data.telefone,
      impressoraFiscalNome: data.impressora_fiscal_nome,
      impressoraFiscalAtiva: data.impressora_fiscal_ativa,
      impressoraCozinhaNome: data.impressora_cozinha_nome,
      impressoraCozinhaAtiva: data.impressora_cozinha_ativa,
      pixChave: data.pix_chave ?? DEFAULT_BAR_SETTINGS.pixChave,
      pixBeneficiarioNome: data.pix_beneficiario_nome || DEFAULT_BAR_SETTINGS.pixBeneficiarioNome,
      pixCidade: data.pix_cidade || DEFAULT_BAR_SETTINGS.pixCidade,
      updatedAt: data.updated_at,
    }
  },
}
