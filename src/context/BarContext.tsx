import React, { createContext, useContext, useState, useEffect } from 'react'
import {
  UserRole,
  MenuItem,
  Comanda,
  CashMovement,
  StockMovement,
  FiscalDocument,
  CashRegisterDay,
  PaymentMethod,
  ComandaItem,
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

interface BarContextType {
  role: UserRole
  setRole: (role: UserRole) => void
  menuItems: MenuItem[]
  comandas: Comanda[]
  cashMovements: CashMovement[]
  stockMovements: StockMovement[]
  fiscalDocs: FiscalDocument[]
  cashDays: CashRegisterDay[]

  // Comanda actions
  openComanda: (tableNumber: number, guestCount: number, clientName?: string) => void
  addItemToComanda: (tableNumber: number, item: MenuItem, quantity?: number) => void
  updateComandaItemQuantity: (tableNumber: number, itemId: string, delta: number) => void
  toggleServiceFee: (tableNumber: number) => void
  closeAndPayComanda: (
    tableNumber: number,
    paymentMethod: PaymentMethod,
    amountPaid: number,
    splitGuests?: number,
  ) => void

  // Stock actions
  updateStockItem: (
    id: string,
    currentStock: number,
    minStock: number,
    unit: MenuItem['unit'],
  ) => void
  addStockSupply: (productId: string, quantity: number, supplier: string, notes?: string) => void

  // Cash actions
  addCashMovement: (
    type: 'Entrada' | 'Saída',
    description: string,
    value: number,
    paymentMethod?: PaymentMethod,
  ) => void
  closeCashRegister: (date: string) => void

  // Fiscal actions
  issueFiscalDoc: (data: {
    type: 'NFC-e' | 'NF-e'
    comandaId?: string
    clientName?: string
    docNumber?: string
    value: number
  }) => Promise<FiscalDocument>
  cancelFiscalDoc: (id: string) => void

  // Helper
  checkRoleAccess: (allowedRoles: UserRole[], actionLabel?: string) => boolean
}

const BarContext = createContext<BarContextType | undefined>(undefined)

const STORAGE_KEYS = {
  ROLE: 'rachide_bar_role',
  MENU: 'rachide_bar_menu',
  COMANDAS: 'rachide_bar_comandas',
  CASH: 'rachide_bar_cash',
  STOCK: 'rachide_bar_stock',
  FISCAL: 'rachide_bar_fiscal',
  DAYS: 'rachide_bar_days',
}

export const BarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { toast } = useToast()

  const [role, setRoleState] = useState<UserRole>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ROLE)
    return (saved as UserRole) || 'Gerente'
  })

  const [menuItems, setMenuItems] = useState<MenuItem[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.MENU)
    return saved ? JSON.parse(saved) : INITIAL_MENU_ITEMS
  })

  const [comandas, setComandas] = useState<Comanda[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.COMANDAS)
    return saved ? JSON.parse(saved) : INITIAL_TABLES
  })

  const [cashMovements, setCashMovements] = useState<CashMovement[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CASH)
    return saved ? JSON.parse(saved) : INITIAL_CASH_MOVEMENTS
  })

  const [stockMovements, setStockMovements] = useState<StockMovement[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.STOCK)
    return saved ? JSON.parse(saved) : INITIAL_STOCK_MOVEMENTS
  })

  const [fiscalDocs, setFiscalDocs] = useState<FiscalDocument[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.FISCAL)
    return saved ? JSON.parse(saved) : INITIAL_FISCAL_DOCS
  })

  const [cashDays, setCashDays] = useState<CashRegisterDay[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.DAYS)
    return saved ? JSON.parse(saved) : INITIAL_CASH_DAYS
  })

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ROLE, role)
  }, [role])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MENU, JSON.stringify(menuItems))
  }, [menuItems])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.COMANDAS, JSON.stringify(comandas))
  }, [comandas])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CASH, JSON.stringify(cashMovements))
  }, [cashMovements])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.STOCK, JSON.stringify(stockMovements))
  }, [stockMovements])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.FISCAL, JSON.stringify(fiscalDocs))
  }, [fiscalDocs])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.DAYS, JSON.stringify(cashDays))
  }, [cashDays])

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole)
    toast({
      title: `Perfil alterado para ${newRole}`,
      description: `Menus e permissões atualizados conforme o perfil de ${newRole}.`,
    })
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

  const openComanda = (tableNumber: number, guestCount: number, clientName?: string) => {
    setComandas((prev) =>
      prev.map((c) => {
        if (c.tableNumber === tableNumber) {
          return {
            ...c,
            status: 'Ocupada',
            guestCount: guestCount || 1,
            clientName: clientName || `Mesa ${tableNumber}`,
            openedAt: new Date().toISOString(),
            includeServiceFee: true,
            items: [],
          }
        }
        return c
      }),
    )
    toast({
      title: `Comanda aberta: Mesa ${tableNumber}`,
      description: `Mesa ocupada com ${guestCount} pessoa(s). Pronta para adicionar pedidos.`,
    })
  }

  const addItemToComanda = (tableNumber: number, item: MenuItem, quantity = 1) => {
    // Check stock
    if (item.stock < quantity) {
      toast({
        variant: 'destructive',
        title: 'Estoque insuficiente',
        description: `O item ${item.name} possui apenas ${item.stock} ${item.unit} em estoque.`,
      })
      return
    }

    setComandas((prev) =>
      prev.map((c) => {
        if (c.tableNumber === tableNumber) {
          const existingItemIndex = c.items.findIndex((i) => i.menuItemId === item.id)
          let updatedItems = [...c.items]
          if (existingItemIndex > -1) {
            updatedItems[existingItemIndex] = {
              ...updatedItems[existingItemIndex],
              quantity: updatedItems[existingItemIndex].quantity + quantity,
            }
          } else {
            const newItem: ComandaItem = {
              id: `ci-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              menuItemId: item.id,
              name: item.name,
              price: item.price,
              quantity,
            }
            updatedItems.push(newItem)
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

    // Deduct stock
    setMenuItems((prev) =>
      prev.map((m) => {
        if (m.id === item.id) {
          const newStock = Math.max(0, Number((m.stock - quantity).toFixed(2)))
          return { ...m, stock: newStock }
        }
        return m
      }),
    )

    toast({
      title: `${quantity}x ${item.name}`,
      description: `Adicionado à Mesa ${tableNumber}.`,
    })
  }

  const updateComandaItemQuantity = (tableNumber: number, itemId: string, delta: number) => {
    let targetMenuItemId = ''
    let canUpdate = true

    setComandas((prev) =>
      prev.map((c) => {
        if (c.tableNumber === tableNumber) {
          const item = c.items.find((i) => i.id === itemId)
          if (!item) return c
          targetMenuItemId = item.menuItemId
          const newQty = item.quantity + delta

          // Check if adding and if stock permits
          if (delta > 0) {
            const m = menuItems.find((mi) => mi.id === targetMenuItemId)
            if (m && m.stock < delta) {
              canUpdate = false
              return c
            }
          }

          let updatedItems: ComandaItem[] = []
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

    if (!canUpdate) {
      toast({
        variant: 'destructive',
        title: 'Estoque insuficiente',
        description: 'Não há mais unidades disponíveis deste produto no estoque.',
      })
      return
    }

    if (targetMenuItemId) {
      setMenuItems((prev) =>
        prev.map((m) => {
          if (m.id === targetMenuItemId) {
            // If delta is +1, stock reduces by 1. If delta is -1, stock increases by 1
            const newStock = Math.max(0, Number((m.stock - delta).toFixed(2)))
            return { ...m, stock: newStock }
          }
          return m
        }),
      )
    }
  }

  const toggleServiceFee = (tableNumber: number) => {
    setComandas((prev) =>
      prev.map((c) => {
        if (c.tableNumber === tableNumber) {
          return { ...c, includeServiceFee: !c.includeServiceFee }
        }
        return c
      }),
    )
  }

  const closeAndPayComanda = (
    tableNumber: number,
    paymentMethod: PaymentMethod,
    amountPaid: number,
    splitGuests?: number,
  ) => {
    const targetComanda = comandas.find((c) => c.tableNumber === tableNumber)
    if (!targetComanda) return

    // 1. Mark comanda as Fechada/Livre or Fechada
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

    // 2. Register Cash Movement
    const newMovement: CashMovement = {
      id: `cm-${Date.now()}`,
      datetime: new Date().toISOString(),
      description: `Pagamento Mesa ${tableNumber} (${splitGuests && splitGuests > 1 ? `${splitGuests} pessoas` : 'Integral'})`,
      type: 'Entrada',
      paymentMethod,
      value: amountPaid,
      user:
        role === 'Garçom'
          ? 'Garçom de Salão'
          : role === 'Caixa'
            ? 'Marina Caixa'
            : 'Carlos Gerente',
      comandaId: targetComanda.id,
    }

    setCashMovements((prev) => [newMovement, ...prev])

    // 3. Register Fiscal Document simulation automatically
    const docNumber = `NFC-e 000.${Math.floor(100 + Math.random() * 900)}`
    const newFiscal: FiscalDocument = {
      id: `fisc-${Date.now()}`,
      number: docNumber,
      serie: '001',
      type: 'NFC-e',
      issuedAt: new Date().toISOString(),
      value: amountPaid,
      status: 'Autorizada',
      clientName: targetComanda.clientName || 'Consumidor Final',
      comandaId: targetComanda.id,
      accessKey: `3525031429384200018465001000000${Math.floor(1000000000 + Math.random() * 9000000000)}`,
    }
    setFiscalDocs((prev) => [newFiscal, ...prev])

    toast({
      title: 'Registrado no caixa!',
      description: `Recebimento de R$ ${amountPaid.toFixed(2)} via ${paymentMethod} concluído com sucesso.`,
    })
  }

  const updateStockItem = (
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
    toast({
      title: 'Estoque atualizado',
      description: 'As alterações do produto foram salvas com sucesso.',
    })
  }

  const addStockSupply = (
    productId: string,
    quantity: number,
    supplier: string,
    notes?: string,
  ) => {
    const product = menuItems.find((m) => m.id === productId)
    if (!product) return

    const newStock = Number((product.stock + quantity).toFixed(2))

    setMenuItems((prev) => prev.map((m) => (m.id === productId ? { ...m, stock: newStock } : m)))

    const movement: StockMovement = {
      id: `sm-${Date.now()}`,
      datetime: new Date().toISOString(),
      productId,
      productName: product.name,
      type: 'Entrada',
      quantity,
      unit: product.unit,
      user: role === 'Gerente' ? 'Carlos Gerente' : 'Marina Caixa',
      supplier,
      notes,
    }

    setStockMovements((prev) => [movement, ...prev])

    toast({
      title: 'Entrada de estoque realizada',
      description: `+${quantity} ${product.unit} de ${product.name} registrados.`,
    })
  }

  const addCashMovement = (
    type: 'Entrada' | 'Saída',
    description: string,
    value: number,
    paymentMethod?: PaymentMethod,
  ) => {
    const newMovement: CashMovement = {
      id: `cm-${Date.now()}`,
      datetime: new Date().toISOString(),
      description,
      type,
      paymentMethod: paymentMethod || 'Dinheiro',
      value,
      user: role === 'Caixa' ? 'Marina Caixa' : 'Carlos Gerente',
    }

    setCashMovements((prev) => [newMovement, ...prev])

    toast({
      title: `${type} registrada no caixa`,
      description: `${description}: R$ ${value.toFixed(2)} (${paymentMethod || 'Dinheiro'})`,
    })
  }

  const closeCashRegister = (date: string) => {
    setCashDays((prev) =>
      prev.map((d) => {
        if (d.date === date) {
          return {
            ...d,
            isClosed: true,
            closedAt: new Date().toISOString(),
            closedBy: role === 'Caixa' ? 'Marina Caixa' : 'Carlos Gerente',
          }
        }
        return d
      }),
    )
    toast({
      title: 'Caixa do dia fechado com sucesso',
      description: `O fechamento do dia ${date} foi homologado.`,
    })
  }

  const issueFiscalDoc = async (data: {
    type: 'NFC-e' | 'NF-e'
    comandaId?: string
    clientName?: string
    docNumber?: string
    value: number
  }): Promise<FiscalDocument> => {
    // Simulates network latency
    await new Promise((resolve) => setTimeout(resolve, 2000))

    const docPrefix = data.type === 'NFC-e' ? 'NFC-e' : 'NF-e'
    const seq = Math.floor(100 + Math.random() * 900)
    const newDoc: FiscalDocument = {
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

    setFiscalDocs((prev) => [newDoc, ...prev])
    toast({
      title: `Documento ${newDoc.number} Autorizado!`,
      description: `Protocolo SEFAZ Simulado: ${newDoc.accessKey?.substring(0, 20)}...`,
    })

    return newDoc
  }

  const cancelFiscalDoc = (id: string) => {
    setFiscalDocs((prev) =>
      prev.map((d) => {
        if (d.id === id) {
          return { ...d, status: 'Cancelada' }
        }
        return d
      }),
    )
    toast({
      variant: 'destructive',
      title: 'Documento Fiscal Cancelado',
      description: 'Cancelamento homologado no ambiente de homologação simulado.',
    })
  }

  return (
    <BarContext.Provider
      value={{
        role,
        setRole,
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
