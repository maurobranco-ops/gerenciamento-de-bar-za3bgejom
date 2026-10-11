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
} from '../types/bar'

// Bypass de tipo estático enquanto os types do Supabase gerados automaticamente não refletem a nova migração
const db = supabase as any

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
    const { error } = await db
      .from('mesas')
      .update({ capacidade, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      console.error('Erro ao atualizar capacidade da mesa:', error)
      throw error
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
  async fetchProdutos(): Promise<MenuItem[]> {
    const { data, error } = await db
      .from('produtos')
      .select('*')
      .eq('ativo', true)
      .order('nome', { ascending: true })

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
      imageUrl: p.image_url || undefined,
    }))
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
      }))

      return {
        id: c?.id || `cmd-${m.numero < 10 ? `0${m.numero}` : m.numero}`,
        tableNumber: m.numero,
        clientName: c?.cliente_nome || undefined,
        guestCount: c?.pessoas ?? 0,
        status: (m.status as TableStatus) || 'Livre',
        openedAt: c?.aberta_em || '',
        closedAt: c?.fechada_em || undefined,
        includeServiceFee: c ? Boolean(c.inclui_taxa_servico) : true,
        capacity: m.capacidade,
        items,
      }
    })
  },

  async openComanda(tableNumber: number, guestCount: number, clientName?: string): Promise<void> {
    const openedAt = new Date().toISOString()
    const comandaId = `cmd-${tableNumber < 10 ? `0${tableNumber}` : tableNumber}`

    // 1. Atualizar mesa
    await db
      .from('mesas')
      .update({ status: 'Ocupada', updated_at: openedAt })
      .eq('numero', tableNumber)

    // 2. Upsert comanda
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
      updated_at: openedAt,
    })

    // Limpa itens antigos se houver
    await db.from('comanda_itens').delete().eq('comanda_id', comandaId)
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

    // 2. Abater estoque no banco
    const newStock = Math.max(0, Number((item.stock - quantity).toFixed(2)))
    await db
      .from('produtos')
      .update({ estoque: newStock, updated_at: new Date().toISOString() })
      .eq('id', item.id)

    // 3. Atualizar mesa para 'Ocupada' se estava Livre
    await db
      .from('mesas')
      .update({ status: 'Ocupada', updated_at: new Date().toISOString() })
      .eq('numero', tableNumber)

    await db
      .from('comandas')
      .update({ status: 'Ocupada', updated_at: new Date().toISOString() })
      .eq('id', comandaId)

    // 4. Prepara fila de cozinha/bar
    if (itemId) {
      const area = ['Cervejas', 'Drinks', 'Destilados', 'Refrigerantes'].includes(item.category)
        ? 'bar'
        : 'cozinha'
      await db.from('fila_cozinha').insert({
        comanda_item_id: itemId,
        area_preparo: area,
        status: 'pendente',
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
    await db
      .from('produtos')
      .update({ estoque: newStock, updated_at: new Date().toISOString() })
      .eq('id', productId)
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

    // 2. Atualizar comanda para Fechada / Livre e limpar itens
    await db
      .from('comandas')
      .update({
        status: 'Livre',
        cliente_nome: null,
        pessoas: 0,
        fechada_em: nowIso,
        total: 0,
        updated_at: nowIso,
      })
      .eq('id', comandaId)

    await db.from('comanda_itens').delete().eq('comanda_id', comandaId)

    // 3. Inserir movimento no caixa
    const movId = `cm-${Date.now()}`
    const desc = `Pagamento Mesa ${tableNumber} (${splitGuests && splitGuests > 1 ? `${splitGuests} pessoas` : 'Integral'})`
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

    await db.from('movimentos_caixa').insert({
      id,
      data_hora: nowIso,
      descricao: description,
      tipo: type,
      forma_pagamento: paymentMethod || 'Dinheiro',
      valor: value,
      usuario: user,
    })

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
    await db.from('documentos_fiscais').update({ status: 'Cancelada' }).eq('id', id)
  },
}
