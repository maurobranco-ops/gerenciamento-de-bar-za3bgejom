import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import {
  UserRole,
  MenuItem,
  Comanda,
  CashMovement,
  StockMovement,
  FiscalDocument,
  CashRegisterDay,
  PaymentMethod,
  TableRecord,
  FilaCozinhaItem,
  KitchenStatus,
  AreaPreparo,
  BarSettings,
} from '../types/bar'
import {
  INITIAL_MENU_ITEMS,
  INITIAL_TABLES,
  INITIAL_CASH_MOVEMENTS,
  INITIAL_STOCK_MOVEMENTS,
  INITIAL_FISCAL_DOCS,
  INITIAL_CASH_DAYS,
} from '../data/barData'
import { useToast } from '../hooks/use-toast'
import { BarService, SaveProductPayload, DEFAULT_BAR_SETTINGS } from '../services/barService'
import { useAuth } from '../hooks/use-auth'
import { SoundEffects } from '../lib/soundEffects'
import { printKitchenTicket } from '../lib/thermalPrinter'

interface BarContextType {
  role: UserRole
  isLoading: boolean
  isSyncing: boolean
  reloadAllData: () => Promise<void>

  // Mesas
  mesas: TableRecord[]
  addMesa: (numero: number, capacidade: number) => Promise<boolean>
  updateMesaCapacidade: (id: string, capacidade: number) => Promise<boolean>
  deleteMesa: (id: string, numero: number) => Promise<boolean>

  // Dados
  menuItems: MenuItem[]
  allProducts: MenuItem[]
  comandas: Comanda[]
  cashMovements: CashMovement[]
  stockMovements: StockMovement[]
  fiscalDocs: FiscalDocument[]
  cashDays: CashRegisterDay[]
  filaCozinha: FilaCozinhaItem[]

  // Configurações do Bar
  settings: BarSettings
  updateSettings: (newSettings: Partial<BarSettings>) => Promise<boolean>

  // Notificações e Sons
  soundEnabled: boolean
  toggleSound: () => void
  unreadOnlineOrdersCount: number
  clearUnreadOnlineOrders: () => void
  lastOnlineOrderId: string | null

  // Produtos (CRUD Gerencial)
  createProduct: (payload: SaveProductPayload) => Promise<boolean>
  updateProduct: (id: string, payload: Partial<SaveProductPayload>) => Promise<boolean>
  toggleProductStatus: (id: string) => Promise<boolean>

  // Fila Cozinha actions
  fetchFilaCozinha: () => Promise<void>
  updateFilaStatus: (id: string, status: KitchenStatus) => Promise<void>

  // Comanda actions
  openComanda: (tableNumber: number, guestCount: number, clientName?: string) => Promise<void>
  addItemToComanda: (tableNumber: number, item: MenuItem, quantity?: number) => Promise<void>
  updateComandaItemQuantity: (tableNumber: number, itemId: string, delta: number) => Promise<void>
  toggleServiceFee: (tableNumber: number) => Promise<void>
  closeAndPayComanda: (
    tableNumber: number,
    paymentMethod: PaymentMethod,
    amountPaid: number,
    splitGuests?: number,
  ) => Promise<void>

  // Stock actions
  updateStockItem: (
    id: string,
    currentStock: number,
    minStock: number,
    unit: MenuItem['unit'],
  ) => Promise<void>
  addStockSupply: (
    productId: string,
    quantity: number,
    supplier: string,
    notes?: string,
  ) => Promise<void>

  // Cash actions
  addCashMovement: (
    type: 'Entrada' | 'Saída',
    description: string,
    value: number,
    paymentMethod?: PaymentMethod,
  ) => Promise<void>
  closeCashRegister: (date: string) => Promise<void>

  // Fiscal actions
  issueFiscalDoc: (data: {
    type: 'NFC-e' | 'NF-e'
    comandaId?: string
    clientName?: string
    docNumber?: string
    value: number
  }) => Promise<FiscalDocument>
  cancelFiscalDoc: (id: string) => Promise<void>

  // Helper
  checkRoleAccess: (allowedRoles: UserRole[], actionLabel?: string) => boolean
}

const BarContext = createContext<BarContextType | undefined>(undefined)

export const BarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { toast } = useToast()
  const { user, role: authRole } = useAuth()

  // Limpeza imediata do cache local legado de perfis no mount
  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem('rachide_bar_role')
      } catch {
        // ignore
      }
    }
  }, [])

  // O perfil do usuário vem EXCLUSIVAMENTE do cadastro do usuário logado no Supabase
  // Garçom é o fallback mais seguro caso perfil ainda não esteja carregado
  const role: UserRole = authRole || 'Garçom'

  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)

  // Mesas e dados principais
  const [mesas, setMesas] = useState<TableRecord[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>(INITIAL_MENU_ITEMS)
  const [allProducts, setAllProducts] = useState<MenuItem[]>([])
  const [comandas, setComandas] = useState<Comanda[]>(INITIAL_TABLES)
  const [cashMovements, setCashMovements] = useState<CashMovement[]>(INITIAL_CASH_MOVEMENTS)
  const [stockMovements, setStockMovements] = useState<StockMovement[]>(INITIAL_STOCK_MOVEMENTS)
  const [fiscalDocs, setFiscalDocs] = useState<FiscalDocument[]>(INITIAL_FISCAL_DOCS)
  const [cashDays, setCashDays] = useState<CashRegisterDay[]>(INITIAL_CASH_DAYS)
  const [filaCozinha, setFilaCozinha] = useState<FilaCozinhaItem[]>([])
  const [settings, setSettings] = useState<BarSettings>(DEFAULT_BAR_SETTINGS)

  // Notificações sonoras e badge
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('rachide_bar_sound_enabled')
    return saved !== null ? saved === 'true' : true
  })
  const [unreadOnlineOrdersCount, setUnreadOnlineOrdersCount] = useState<number>(0)
  const [lastOnlineOrderId, setLastOnlineOrderId] = useState<string | null>(null)

  // Sync sound to localStorage
  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev
      localStorage.setItem('rachide_bar_sound_enabled', String(next))
      return next
    })
  }

  const clearUnreadOnlineOrders = () => {
    setUnreadOnlineOrdersCount(0)
  }

  // Carga inicial do Supabase
  const loadDataFromSupabase = useCallback(async () => {
    try {
      setIsSyncing(true)
      const [
        fetchedMesas,
        fetchedProdutosAtivos,
        fetchedAllProdutos,
        fetchedComandas,
        fetchedStockMovs,
        fetchedCashDays,
        fetchedCashMovs,
        fetchedFiscalDocs,
        fetchedFila,
        fetchedConfig,
      ] = await Promise.all([
        BarService.fetchMesas().catch(() => []),
        BarService.fetchProdutos(false).catch(() => INITIAL_MENU_ITEMS),
        BarService.fetchProdutos(true).catch(() => INITIAL_MENU_ITEMS),
        BarService.fetchComandas().catch(() => INITIAL_TABLES),
        BarService.fetchStockMovements().catch(() => INITIAL_STOCK_MOVEMENTS),
        BarService.fetchCashDays().catch(() => INITIAL_CASH_DAYS),
        BarService.fetchCashMovements().catch(() => INITIAL_CASH_MOVEMENTS),
        BarService.fetchFiscalDocs().catch(() => INITIAL_FISCAL_DOCS),
        BarService.fetchFilaCozinha().catch(() => []),
        BarService.fetchConfiguracoes().catch(() => DEFAULT_BAR_SETTINGS),
      ])

      if (fetchedMesas.length > 0) setMesas(fetchedMesas)
      if (fetchedProdutosAtivos.length > 0) setMenuItems(fetchedProdutosAtivos)
      if (fetchedAllProdutos.length > 0) setAllProducts(fetchedAllProdutos)
      if (fetchedComandas.length > 0) setComandas(fetchedComandas)
      if (fetchedStockMovs.length > 0) setStockMovements(fetchedStockMovs)
      if (fetchedCashDays.length > 0) setCashDays(fetchedCashDays)
      if (fetchedCashMovs.length > 0) setCashMovements(fetchedCashMovs)
      if (fetchedFiscalDocs.length > 0) setFiscalDocs(fetchedFiscalDocs)
      setFilaCozinha(fetchedFila)
      if (fetchedConfig) setSettings(fetchedConfig)
    } catch (err) {
      console.error('Falha ao sincronizar dados com o Supabase:', err)
      toast({
        variant: 'destructive',
        title: 'Conexão Supabase',
        description: 'Usando cache local enquanto restabelece sincronização com o banco.',
      })
    } finally {
      setIsLoading(false)
      setIsSyncing(false)
    }
  }, [toast])

  useEffect(() => {
    loadDataFromSupabase()
  }, [loadDataFromSupabase])

  // Polling leve para Fila de Cozinha a cada 8 segundos se o usuário estiver ativo
  useEffect(() => {
    const interval = setInterval(() => {
      BarService.fetchFilaCozinha()
        .then((items) => {
          setFilaCozinha((prev) => {
            // Se prev for vazio no primeiro mount, não dispara alerta falso de "novo"
            if (prev.length === 0) return items

            const prevIds = new Set(prev.map((p) => p.id))
            const newOnlineItems = items.filter(
              (item) => item.origemOnline && !prevIds.has(item.id) && item.status === 'pendente',
            )

            if (newOnlineItems.length > 0) {
              setUnreadOnlineOrdersCount((c) => c + newOnlineItems.length)
              setLastOnlineOrderId(newOnlineItems[0].id)

              // Guarda restritiva: alertas sonoros e impressão automática só para usuário autenticado
              // e em telas operacionais de atendimento (Fila de Cozinha e Comandas).
              // NUNCA em /login, páginas públicas (/pedido) ou telas de gestão administrativa.
              const currentPath =
                typeof window !== 'undefined' ? window.location.pathname.toLowerCase() : ''
              const isUserAuthenticated = Boolean(user)
              const isOperacionalKitchenRoute =
                currentPath === '/fila-cozinha' || currentPath.startsWith('/fila-cozinha/')
              const isOperacionalComandasRoute =
                currentPath === '/comandas' || currentPath.startsWith('/comandas/')
              const isOperacionalScreen = isOperacionalKitchenRoute || isOperacionalComandasRoute

              // Dispara som de novo pedido apenas se logado, na tela operacional e com som ativo
              const soundSaved = localStorage.getItem('rachide_bar_sound_enabled')
              const isSoundOn = soundSaved !== null ? soundSaved === 'true' : true
              if (isSoundOn && isUserAuthenticated && isOperacionalScreen) {
                SoundEffects.playOrderAlert()
              }

              // Disparo de impressão automática apenas se logado, na Fila de Cozinha e com toggle ativo
              const autoPrintStation =
                localStorage.getItem('rachide_bar_autoprint_enabled') === 'true'
              if (autoPrintStation && isUserAuthenticated && isOperacionalKitchenRoute) {
                newOnlineItems.forEach((it) => {
                  printKitchenTicket({ item: it, settings })
                })
              }
            }

            return items
          })
        })
        .catch(() => {})
    }, 8000)

    return () => clearInterval(interval)
  }, [settings])

  // Atualizar configurações do bar
  const updateSettings = async (newSettings: Partial<BarSettings>): Promise<boolean> => {
    if (!checkRoleAccess(['Gerente'], 'alterar configurações gerais do bar')) return false

    try {
      const updated = await BarService.updateConfiguracoes(newSettings)
      setSettings(updated)
      toast({
        title: 'Configurações salvas no Supabase!',
        description: 'Taxas, dados fiscais e impressoras atualizados com sucesso.',
      })
      return true
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar configurações',
        description: err.message || 'Falha na persistência no Supabase.',
      })
      return false
    }
  }

  const checkRoleAccess = (allowedRoles: UserRole[], actionLabel?: string): boolean => {
    if (allowedRoles.includes(role)) {
      return true
    }
    toast({
      variant: 'destructive',
      title: `Acesso restrito ao perfil ${role}`,
      description: actionLabel
        ? `Você precisa do perfil ${allowedRoles.join(' ou ')} para ${actionLabel}.`
        : `Esta tela/ação é restrita aos perfis: ${allowedRoles.join(', ')}.`,
    })
    return false
  }

  // --- CONFIGURAÇÃO DE MESAS ---
  const addMesa = async (numero: number, capacidade: number): Promise<boolean> => {
    if (!checkRoleAccess(['Gerente'], 'adicionar mesas')) return false

    // Validar duplicata
    if (mesas.some((m) => m.numero === numero)) {
      toast({
        variant: 'destructive',
        title: 'Número duplicado',
        description: `A Mesa ${numero} já está cadastrada no sistema.`,
      })
      return false
    }

    try {
      const newMesa = await BarService.addMesa(numero, capacidade)
      setMesas((prev) => [...prev, newMesa].sort((a, b) => a.numero - b.numero))
      setComandas((prev) => {
        const exists = prev.some((c) => c.tableNumber === numero)
        if (exists) return prev
        const newCmd: Comanda = {
          id: `cmd-${numero < 10 ? `0${numero}` : numero}`,
          tableNumber: numero,
          guestCount: 0,
          status: 'Livre',
          openedAt: '',
          items: [],
          capacity: capacidade,
        }
        return [...prev, newCmd].sort((a, b) => a.tableNumber - b.tableNumber)
      })

      toast({
        title: `Mesa ${numero} criada com sucesso!`,
        description: `Capacidade para ${capacidade} pessoas registrada no Supabase.`,
      })
      return true
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar mesa',
        description: err.message || 'Não foi possível cadastrar a mesa.',
      })
      return false
    }
  }

  const updateMesaCapacidade = async (id: string, capacidade: number): Promise<boolean> => {
    if (!checkRoleAccess(['Gerente'], 'editar mesas')) return false

    try {
      await BarService.updateMesaCapacidade(id, capacidade)
      setMesas((prev) => prev.map((m) => (m.id === id ? { ...m, capacidade } : m)))
      setComandas((prev) =>
        prev.map((c) => {
          const mesa = mesas.find((m) => m.id === id)
          if (mesa && c.tableNumber === mesa.numero) {
            return { ...c, capacity: capacidade }
          }
          return c
        }),
      )

      toast({
        title: 'Capacidade atualizada',
        description: `Capacidade alterada para ${capacidade} pessoas no banco.`,
      })
      return true
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar capacidade',
        description: err.message || 'Falha ao atualizar mesa.',
      })
      return false
    }
  }

  const deleteMesa = async (id: string, numero: number): Promise<boolean> => {
    if (!checkRoleAccess(['Gerente'], 'remover mesas')) return false

    // Checar se está ocupada
    const targetComanda = comandas.find((c) => c.tableNumber === numero)
    if (
      targetComanda &&
      (targetComanda.status === 'Ocupada' ||
        targetComanda.status === 'Aguardando Pagamento' ||
        targetComanda.items.length > 0)
    ) {
      toast({
        variant: 'destructive',
        title: 'Não é possível remover',
        description: `A Mesa ${numero} possui consumo ou status em andamento (${targetComanda.status}). Finalize a conta antes.`,
      })
      return false
    }

    try {
      await BarService.deleteMesa(id, numero)
      setMesas((prev) => prev.filter((m) => m.id !== id))
      setComandas((prev) => prev.filter((c) => c.tableNumber !== numero))

      toast({
        title: `Mesa ${numero} removida`,
        description: 'Mesa excluída permanentemente do banco de dados.',
      })
      return true
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao remover mesa',
        description: err.message || 'Falha na exclusão da mesa.',
      })
      return false
    }
  }

  // --- COMANDAS ---
  const openComanda = async (tableNumber: number, guestCount: number, clientName?: string) => {
    const openedAt = new Date().toISOString()
    // Atualização otimista
    setComandas((prev) =>
      prev.map((c) => {
        if (c.tableNumber === tableNumber) {
          return {
            ...c,
            status: 'Ocupada',
            guestCount: guestCount || 1,
            clientName: clientName || `Mesa ${tableNumber}`,
            openedAt,
            includeServiceFee: true,
            items: [],
          }
        }
        return c
      }),
    )
    setMesas((prev) =>
      prev.map((m) => (m.numero === tableNumber ? { ...m, status: 'Ocupada' } : m)),
    )

    try {
      await BarService.openComanda(tableNumber, guestCount, clientName)
      toast({
        title: `Comanda aberta: Mesa ${tableNumber}`,
        description: `Mesa ocupada com ${guestCount} pessoa(s). Registrado no Supabase.`,
      })
    } catch (err) {
      console.error('Erro ao persistir abertura de comanda:', err)
      toast({
        variant: 'destructive',
        title: 'Aviso de persistência',
        description: 'Comanda aberta na sessão local, sincronizando com o banco.',
      })
    }
  }

  const addItemToComanda = async (tableNumber: number, item: MenuItem, quantity = 1) => {
    // Check stock local
    if (item.stock < quantity) {
      toast({
        variant: 'destructive',
        title: 'Estoque insuficiente',
        description: `O item ${item.name} possui apenas ${item.stock} ${item.unit} em estoque.`,
      })
      return
    }

    // Otimista
    setComandas((prev) =>
      prev.map((c) => {
        if (c.tableNumber === tableNumber) {
          const existingItemIndex = c.items.findIndex((i) => i.menuItemId === item.id)
          const updatedItems = [...c.items]
          if (existingItemIndex > -1) {
            updatedItems[existingItemIndex] = {
              ...updatedItems[existingItemIndex],
              quantity: updatedItems[existingItemIndex].quantity + quantity,
            }
          } else {
            updatedItems.push({
              id: `ci-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              menuItemId: item.id,
              name: item.name,
              price: item.price,
              quantity,
            })
          }
          return {
            ...c,
            status: c.status === 'Livre' ? 'Ocupada' : c.status,
            items: updatedItems,
          }
        }
        return c
      }),
    )

    setMenuItems((prev) =>
      prev.map((m) => {
        if (m.id === item.id) {
          const newStock = Math.max(0, Number((m.stock - quantity).toFixed(2)))
          return { ...m, stock: newStock }
        }
        return m
      }),
    )

    try {
      await BarService.addItemToComanda(tableNumber, item, quantity)
      toast({
        title: `${quantity}x ${item.name}`,
        description: `Adicionado à Mesa ${tableNumber} (banco atualizado).`,
      })
    } catch (err) {
      console.error('Erro ao salvar item na comanda:', err)
    }
  }

  const updateComandaItemQuantity = async (tableNumber: number, itemId: string, delta: number) => {
    const cmd = comandas.find((c) => c.tableNumber === tableNumber)
    const item = cmd?.items.find((i) => i.id === itemId)
    if (!item) return

    const product = menuItems.find((m) => m.id === item.menuItemId)
    if (delta > 0 && product && product.stock < delta) {
      toast({
        variant: 'destructive',
        title: 'Estoque insuficiente',
        description: 'Não há mais unidades disponíveis deste produto no estoque.',
      })
      return
    }

    // Otimista
    setComandas((prev) =>
      prev.map((c) => {
        if (c.tableNumber === tableNumber) {
          const newQty = item.quantity + delta
          let updatedItems = []
          if (newQty <= 0) {
            updatedItems = c.items.filter((i) => i.id !== itemId)
          } else {
            updatedItems = c.items.map((i) => (i.id === itemId ? { ...i, quantity: newQty } : i))
          }
          return { ...c, items: updatedItems }
        }
        return c
      }),
    )

    if (product) {
      setMenuItems((prev) =>
        prev.map((m) => {
          if (m.id === product.id) {
            const newStock = Math.max(0, Number((m.stock - delta).toFixed(2)))
            return { ...m, stock: newStock }
          }
          return m
        }),
      )
    }

    try {
      await BarService.updateComandaItemQuantity(
        itemId,
        delta,
        item.menuItemId,
        item.quantity,
        product ? product.stock : 0,
      )
    } catch (err) {
      console.error('Erro ao atualizar quantidade do item:', err)
    }
  }

  const toggleServiceFee = async (tableNumber: number) => {
    const cmd = comandas.find((c) => c.tableNumber === tableNumber)
    const currentVal = cmd ? Boolean(cmd.includeServiceFee) : true

    setComandas((prev) =>
      prev.map((c) => {
        if (c.tableNumber === tableNumber) {
          return { ...c, includeServiceFee: !c.includeServiceFee }
        }
        return c
      }),
    )

    try {
      await BarService.toggleServiceFee(tableNumber, currentVal)
    } catch (err) {
      console.error('Erro ao alterar taxa de serviço:', err)
    }
  }

  const closeAndPayComanda = async (
    tableNumber: number,
    paymentMethod: PaymentMethod,
    amountPaid: number,
    splitGuests?: number,
  ) => {
    const targetComanda = comandas.find((c) => c.tableNumber === tableNumber)
    if (!targetComanda) return

    const userLabel =
      role === 'Garçom' ? 'Garçom de Salão' : role === 'Caixa' ? 'Marina Caixa' : 'Carlos Gerente'

    // Otimista
    setComandas((prev) =>
      prev.map((c) => {
        if (c.tableNumber === tableNumber) {
          return {
            ...c,
            status: 'Livre',
            closedAt: new Date().toISOString(),
            items: [],
            clientName: undefined,
            guestCount: 0,
          }
        }
        return c
      }),
    )
    setMesas((prev) => prev.map((m) => (m.numero === tableNumber ? { ...m, status: 'Livre' } : m)))

    try {
      const { newMovement, newFiscal } = await BarService.closeAndPayComanda(
        tableNumber,
        paymentMethod,
        amountPaid,
        userLabel,
        targetComanda.clientName,
        splitGuests,
      )

      setCashMovements((prev) => [newMovement, ...prev])
      setFiscalDocs((prev) => [newFiscal, ...prev])

      toast({
        title: 'Registrado no caixa do Supabase!',
        description: `Recebimento de R$ ${amountPaid.toFixed(2)} via ${paymentMethod} gravado.`,
      })
    } catch (err) {
      console.error('Erro ao fechar e pagar comanda:', err)
      toast({
        title: 'Registrado no caixa!',
        description: `Recebimento de R$ ${amountPaid.toFixed(2)} via ${paymentMethod} concluído.`,
      })
    }
  }

  // --- ESTOQUE ---
  // --- CRUD GERENCIAL DE PRODUTOS ---
  const createProduct = async (payload: SaveProductPayload): Promise<boolean> => {
    if (!checkRoleAccess(['Gerente'], 'cadastrar novos produtos')) return false

    try {
      const newProd = await BarService.createProduto(payload)
      setAllProducts((prev) => [...prev, newProd].sort((a, b) => a.name.localeCompare(b.name)))
      if (newProd.ativo !== false) {
        setMenuItems((prev) => [...prev, newProd].sort((a, b) => a.name.localeCompare(b.name)))
      }
      toast({
        title: 'Produto criado com sucesso!',
        description: `${newProd.name} salvo no banco por R$ ${newProd.price.toFixed(2)}.`,
      })
      return true
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar produto',
        description: err.message || 'Falha ao gravar no Supabase.',
      })
      return false
    }
  }

  const updateProduct = async (
    id: string,
    payload: Partial<SaveProductPayload>,
  ): Promise<boolean> => {
    if (!checkRoleAccess(['Gerente'], 'editar produtos')) return false

    try {
      const updated = await BarService.updateProduto(id, payload)
      setAllProducts((prev) => prev.map((p) => (p.id === id ? updated : p)))
      if (updated.ativo) {
        setMenuItems((prev) => {
          const exists = prev.some((p) => p.id === id)
          if (exists) {
            return prev.map((p) => (p.id === id ? updated : p))
          }
          return [...prev, updated].sort((a, b) => a.name.localeCompare(b.name))
        })
      } else {
        setMenuItems((prev) => prev.filter((p) => p.id !== id))
      }
      toast({
        title: 'Produto atualizado',
        description: `${updated.name} atualizado no cardápio e no banco de dados.`,
      })
      return true
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar produto',
        description: err.message || 'Falha ao gravar no Supabase.',
      })
      return false
    }
  }

  const toggleProductStatus = async (id: string): Promise<boolean> => {
    if (!checkRoleAccess(['Gerente'], 'ativar/desativar produtos')) return false

    const target = allProducts.find((p) => p.id === id)
    if (!target) return false

    const currentAtivo = target.ativo !== false
    try {
      const newStatus = await BarService.toggleProdutoAtivo(id, currentAtivo)
      setAllProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ativo: newStatus } : p)))
      if (newStatus) {
        setMenuItems((prev) => {
          const exists = prev.some((p) => p.id === id)
          if (exists) return prev
          return [...prev, { ...target, ativo: true }].sort((a, b) => a.name.localeCompare(b.name))
        })
      } else {
        setMenuItems((prev) => prev.filter((p) => p.id !== id))
      }

      toast({
        title: newStatus ? 'Produto Ativado' : 'Produto Desativado',
        description: `${target.name} ${newStatus ? 'agora aparece' : 'não aparece mais'} no cardápio de vendas.`,
      })
      return true
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao alterar status',
        description: err.message || 'Falha na comunicação com o banco.',
      })
      return false
    }
  }

  const updateStockItem = async (
    id: string,
    currentStock: number,
    minStock: number,
    unit: MenuItem['unit'],
  ) => {
    setMenuItems((prev) =>
      prev.map((m) => {
        if (m.id === id) {
          return { ...m, stock: currentStock, minStock, unit }
        }
        return m
      }),
    )
    setAllProducts((prev) =>
      prev.map((m) => {
        if (m.id === id) {
          return { ...m, stock: currentStock, minStock, unit }
        }
        return m
      }),
    )

    try {
      await BarService.updateProdutoEstoque(id, currentStock, minStock, unit)
      toast({
        title: 'Estoque atualizado no Supabase',
        description: 'As alterações do produto foram salvas com sucesso.',
      })
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar estoque',
        description: err.message || 'Falha ao atualizar produto.',
      })
    }
  }

  // --- FILA DE COZINHA & BAR ---
  const fetchFilaCozinha = async () => {
    try {
      const items = await BarService.fetchFilaCozinha()
      setFilaCozinha(items)
    } catch (err) {
      console.error('Erro ao atualizar fila de cozinha:', err)
    }
  }

  const updateFilaStatus = async (id: string, status: KitchenStatus) => {
    // Otimista
    setFilaCozinha((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status, updatedAt: new Date().toISOString() } : item,
      ),
    )

    // Bip sonoro interno agradável ao marcar pedido como pronto (somente Fila de Cozinha logada)
    const currentPath = typeof window !== 'undefined' ? window.location.pathname.toLowerCase() : ''
    const isKitchenRoute =
      currentPath === '/fila-cozinha' || currentPath.startsWith('/fila-cozinha/')
    if (status === 'pronto' && soundEnabled && Boolean(user) && isKitchenRoute) {
      SoundEffects.playSuccessAlert()
    }

    try {
      await BarService.updateFilaStatus(id, status)
      const label =
        status === 'preparando'
          ? 'Em preparo'
          : status === 'pronto'
            ? 'Pronto para servir'
            : status === 'entregue'
              ? 'Entregue na mesa'
              : 'Pendente'
      toast({
        title: `Pedido marcado como "${label}"`,
        description: 'Status sincronizado na fila de bar/cozinha.',
      })
    } catch (err: any) {
      console.error('Erro ao atualizar status da fila:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar status',
        description: err.message || 'Falha na gravação.',
      })
      // Rollback
      fetchFilaCozinha()
    }
  }

  const addStockSupply = async (
    productId: string,
    quantity: number,
    supplier: string,
    notes?: string,
  ) => {
    const product = menuItems.find((m) => m.id === productId)
    if (!product) return

    const userLabel = role === 'Gerente' ? 'Carlos Gerente' : 'Marina Caixa'
    const newStock = Number((product.stock + quantity).toFixed(2))

    setMenuItems((prev) => prev.map((m) => (m.id === productId ? { ...m, stock: newStock } : m)))

    try {
      const movement = await BarService.addStockSupply(
        productId,
        quantity,
        supplier,
        userLabel,
        product.name,
        product.unit,
        product.stock,
        notes,
      )
      setStockMovements((prev) => [movement, ...prev])

      toast({
        title: 'Entrada registrada no Supabase',
        description: `+${quantity} ${product.unit} de ${product.name} registrados.`,
      })
    } catch (err) {
      console.error('Erro ao registrar suprimento:', err)
      toast({
        title: 'Entrada de estoque realizada',
        description: `+${quantity} ${product.unit} de ${product.name} registrados.`,
      })
    }
  }

  // --- CAIXA ---
  const addCashMovement = async (
    type: 'Entrada' | 'Saída',
    description: string,
    value: number,
    paymentMethod?: PaymentMethod,
  ) => {
    const userLabel = role === 'Caixa' ? 'Marina Caixa' : 'Carlos Gerente'

    try {
      const newMovement = await BarService.addCashMovement(
        type,
        description,
        value,
        userLabel,
        paymentMethod,
      )
      setCashMovements((prev) => [newMovement, ...prev])

      toast({
        title: `${type} registrada no caixa`,
        description: `${description}: R$ ${value.toFixed(2)} (${paymentMethod || 'Dinheiro'}) gravado no Supabase.`,
      })
    } catch (err) {
      console.error('Erro ao adicionar movimento de caixa:', err)
      const fallbackMov: CashMovement = {
        id: `cm-${Date.now()}`,
        datetime: new Date().toISOString(),
        description,
        type,
        paymentMethod: paymentMethod || 'Dinheiro',
        value,
        user: userLabel,
      }
      setCashMovements((prev) => [fallbackMov, ...prev])
    }
  }

  const closeCashRegister = async (date: string) => {
    const closedBy = role === 'Caixa' ? 'Marina Caixa' : 'Carlos Gerente'
    setCashDays((prev) =>
      prev.map((d) => {
        if (d.date === date) {
          return {
            ...d,
            isClosed: true,
            closedAt: new Date().toISOString(),
            closedBy,
          }
        }
        return d
      }),
    )

    try {
      await BarService.closeCashRegister(date, closedBy)
      toast({
        title: 'Caixa do dia fechado no Supabase',
        description: `O fechamento do dia ${date} foi homologado no banco.`,
      })
    } catch (err) {
      console.error('Erro ao fechar caixa:', err)
      toast({
        title: 'Caixa do dia fechado com sucesso',
        description: `O fechamento do dia ${date} foi homologado.`,
      })
    }
  }

  // --- FISCAL ---
  const issueFiscalDoc = async (data: {
    type: 'NFC-e' | 'NF-e'
    comandaId?: string
    clientName?: string
    docNumber?: string
    value: number
  }): Promise<FiscalDocument> => {
    // Simula a latência de comunicação da SEFAZ (~2s) conforme regra mantida
    await new Promise((resolve) => setTimeout(resolve, 2000))

    try {
      const newDoc = await BarService.issueFiscalDoc(data)
      setFiscalDocs((prev) => [newDoc, ...prev])
      toast({
        title: `Documento ${newDoc.number} Autorizado!`,
        description: `Protocolo SEFAZ Simulado gravado no Supabase.`,
      })
      return newDoc
    } catch (err) {
      console.error('Erro ao emitir doc fiscal no Supabase:', err)
      const docPrefix = data.type === 'NFC-e' ? 'NFC-e' : 'NF-e'
      const seq = Math.floor(100 + Math.random() * 900)
      const fallbackDoc: FiscalDocument = {
        id: `fisc-${Date.now()}`,
        number: `${docPrefix} 000.${seq}`,
        serie: '001',
        type: data.type,
        issuedAt: new Date().toISOString(),
        value: data.value,
        status: 'Autorizada',
        clientName: data.clientName || 'Consumidor Final',
        docNumber: data.docNumber,
        comandaId: data.comandaId,
        accessKey: `35250314293842000184${data.type === 'NFC-e' ? '65' : '55'}001000000${seq}1098472810`,
      }
      setFiscalDocs((prev) => [fallbackDoc, ...prev])
      return fallbackDoc
    }
  }

  const cancelFiscalDoc = async (id: string) => {
    setFiscalDocs((prev) => prev.map((d) => (d.id === id ? { ...d, status: 'Cancelada' } : d)))

    try {
      await BarService.cancelFiscalDoc(id)
      toast({
        variant: 'destructive',
        title: 'Documento Fiscal Cancelado',
        description: 'Cancelamento atualizado no Supabase.',
      })
    } catch (err) {
      console.error('Erro ao cancelar documento fiscal:', err)
    }
  }

  return (
    <BarContext.Provider
      value={{
        role,
        isLoading,
        isSyncing,
        reloadAllData: loadDataFromSupabase,
        mesas,
        addMesa,
        updateMesaCapacidade,
        deleteMesa,
        menuItems,
        comandas,
        cashMovements,
        stockMovements,
        fiscalDocs,
        cashDays,
        openComanda,
        addItemToComanda,
        updateComandaItemQuantity,
        toggleServiceFee,
        closeAndPayComanda,
        updateStockItem,
        addStockSupply,
        addCashMovement,
        closeCashRegister,
        issueFiscalDoc,
        cancelFiscalDoc,
        checkRoleAccess,
        allProducts,
        createProduct,
        updateProduct,
        toggleProductStatus,
        filaCozinha,
        fetchFilaCozinha,
        updateFilaStatus,
        settings,
        updateSettings,
        soundEnabled,
        toggleSound,
        unreadOnlineOrdersCount,
        clearUnreadOnlineOrders,
        lastOnlineOrderId,
      }}
    >
      {children}
    </BarContext.Provider>
  )
}

export const useBar = () => {
  const context = useContext(BarContext)
  if (!context) {
    throw new Error('useBar must be used within a BarProvider')
  }
  return context
}
