import React, { useState } from 'react'
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  Beer,
  LayoutDashboard,
  ClipboardList,
  UtensilsCrossed,
  Boxes,
  BadgeDollarSign,
  FileSpreadsheet,
  ReceiptText,
  ChevronLeft,
  ChevronRight,
  Search,
  Bell,
  User,
  ShieldAlert,
  X,
  Plus,
  SlidersHorizontal,
  ChefHat,
  PackagePlus,
  Settings,
} from 'lucide-react'
import { useBar } from '../context/BarContext'
import { useAuth } from '../hooks/use-auth'
import { UserRole } from '../types/bar'
import { Button } from './ui/button'
import { Input } from './ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Badge } from './ui/badge'
import { QrCode, LogOut, Users } from 'lucide-react'

interface NavItem {
  title: string
  path: string
  icon: React.ComponentType<{ className?: string }>
  roles: UserRole[]
  badgeCount?: (ctx: any) => number
}

const NAV_ITEMS: NavItem[] = [
  {
    title: 'Dashboard',
    path: '/',
    icon: LayoutDashboard,
    roles: ['Gerente'],
  },
  {
    title: 'Comandas & Mesas',
    path: '/comandas',
    icon: ClipboardList,
    roles: ['Garçom', 'Caixa', 'Gerente'],
  },
  {
    title: 'Fila Cozinha & Bar',
    path: '/fila-cozinha',
    icon: ChefHat,
    roles: ['Garçom', 'Caixa', 'Gerente'],
    badgeCount: (ctx) =>
      ctx.filaCozinha?.filter((i: any) => i.status === 'pendente' || i.status === 'preparando')
        .length || 0,
  },
  {
    title: 'QR Code Mesas',
    path: '/pedidos-online',
    icon: QrCode,
    roles: ['Garçom', 'Caixa', 'Gerente'],
  },
  {
    title: 'Cadastros de Produtos',
    path: '/produtos-admin',
    icon: PackagePlus,
    roles: ['Gerente'],
  },
  {
    title: 'Configurar Mesas',
    path: '/mesas-config',
    icon: SlidersHorizontal,
    roles: ['Gerente'],
  },
  {
    title: 'Cardápio',
    path: '/cardapio',
    icon: UtensilsCrossed,
    roles: ['Garçom', 'Gerente'],
  },
  {
    title: 'Estoque',
    path: '/estoque',
    icon: Boxes,
    roles: ['Gerente'],
  },
  {
    title: 'Fluxo de Caixa',
    path: '/fluxo-caixa',
    icon: BadgeDollarSign,
    roles: ['Caixa', 'Gerente'],
  },
  {
    title: 'DRE Gerencial',
    path: '/dre',
    icon: FileSpreadsheet,
    roles: ['Gerente'],
  },
  {
    title: 'Módulo Fiscal',
    path: '/fiscal',
    icon: ReceiptText,
    roles: ['Gerente'],
  },
  {
    title: 'Usuários & Equipe',
    path: '/usuarios',
    icon: Users,
    roles: ['Gerente'],
  },
  {
    title: 'Configurações',
    path: '/configuracoes',
    icon: Settings,
    roles: ['Gerente'],
  },
]

export default function Layout() {
  const barContext = useBar()
  const { user, profile, signOut } = useAuth()
  const { role, setRole, menuItems, comandas, checkRoleAccess, addItemToComanda, filaCozinha } =
    barContext
  const [collapsed, setCollapsed] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [notifOpen, setNotifOpen] = useState(false)
  const [selectedProductToAdd, setSelectedProductToAdd] = useState<{
    id: string
    name: string
  } | null>(null)
  const [selectedTableForAdd, setSelectedTableForAdd] = useState<number>(1)

  const location = useLocation()
  const navigate = useNavigate()

  // Format today's date in pt-BR
  const todayFormatted = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())

  // Dynamic screen title based on current path
  const currentNav = NAV_ITEMS.find((item) => item.path === location.pathname)
  const currentTitle = currentNav?.title || 'Rachide Bar'

  // Filter items by role
  const visibleNavItems = NAV_ITEMS.filter((item) => item.roles.includes(role))

  // Search filtered products
  const searchResults = searchQuery.trim()
    ? menuItems.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.category.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : []

  // Notifications calculation
  const { unreadOnlineOrdersCount } = barContext

  const openComandasCount = comandas.filter(
    (c) => c.status === 'Ocupada' || c.status === 'Aguardando Pagamento',
  ).length
  const pendingKitchenCount = filaCozinha.filter(
    (i) => i.status === 'pendente' || i.status === 'preparando',
  ).length
  const lowStockCount = menuItems.filter((m) => m.stock <= m.minStock).length

  // Atualizar título da aba do navegador dinamicamente com pedidos pendentes
  React.useEffect(() => {
    const totalPending = pendingKitchenCount
    if (totalPending > 0) {
      document.title = `(${totalPending}) Rachide Bar • Fila Ativa`
    } else {
      document.title = 'Rachide Bar — Gestão Gastronômica'
    }
  }, [pendingKitchenCount])

  // Handle protected route click
  const handleNavClick = (e: React.MouseEvent, item: NavItem) => {
    if (!item.roles.includes(role)) {
      e.preventDefault()
      checkRoleAccess(item.roles, `acessar ${item.title}`)
    }
  }

  const handleConfirmAddToTable = () => {
    if (!selectedProductToAdd) return
    const prod = menuItems.find((m) => m.id === selectedProductToAdd.id)
    if (prod) {
      addItemToComanda(selectedTableForAdd, prod, 1)
      setSelectedProductToAdd(null)
      setSearchOpen(false)
      navigate('/comandas')
    }
  }

  return (
    <div className="min-h-screen bg-[#1C1917] text-[#F5F5F4] flex flex-col font-sans">
      {/* Top Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-[#292524] border-b border-[#44403C] z-30 flex items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-3">
          {/* Mobile brand badge */}
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-[#1C1917] shadow-md shadow-amber-950/40">
              <Beer className="w-5 h-5 fill-current" />
            </div>
            <span className="font-extrabold text-lg tracking-tight hidden sm:inline text-stone-100">
              Rachide <span className="text-amber-500">Bar</span>
            </span>
          </div>

          <div className="h-5 w-px bg-stone-700 mx-2 hidden sm:block" />

          <h1 className="text-base sm:text-lg font-bold text-stone-200 capitalize">
            {currentTitle}
          </h1>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Current date display */}
          <span className="text-xs text-stone-400 capitalize hidden md:inline-block">
            {todayFormatted}
          </span>

          {/* Global Search Button */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1C1917] hover:bg-[#44403C] border border-[#44403C] text-xs text-stone-300 transition-colors"
            title="Buscar produto"
          >
            <Search className="w-4 h-4 text-amber-500" />
            <span className="hidden sm:inline">Buscar produto...</span>
            <kbd className="hidden sm:inline px-1.5 py-0.5 text-[10px] bg-stone-800 rounded border border-stone-700 text-stone-400">
              Ctrl+K
            </kbd>
          </button>

          {/* Notifications Dropdown */}
          <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
            <DropdownMenuTrigger asChild>
              <button
                className={`relative p-2 rounded-lg bg-[#1C1917] hover:bg-[#44403C] border border-[#44403C] text-stone-300 transition-colors ${
                  unreadOnlineOrdersCount > 0 ? 'border-amber-500 ring-2 ring-amber-500/30' : ''
                }`}
                title="Notificações"
              >
                <Bell
                  className={`w-4 h-4 ${unreadOnlineOrdersCount > 0 ? 'text-amber-400 animate-bounce' : 'text-amber-500'}`}
                />
                {(openComandasCount > 0 || lowStockCount > 0 || unreadOnlineOrdersCount > 0) && (
                  <span
                    className={`absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full text-[10px] font-bold text-stone-950 ${
                      unreadOnlineOrdersCount > 0 ? 'bg-amber-400 animate-pulse' : 'bg-amber-500'
                    }`}
                  >
                    {unreadOnlineOrdersCount > 0
                      ? unreadOnlineOrdersCount
                      : lowStockCount + (openComandasCount > 0 ? 1 : 0)}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-80 bg-[#292524] border-[#44403C] text-stone-100 p-2"
            >
              <DropdownMenuLabel className="text-xs font-semibold text-stone-400 uppercase tracking-wider flex items-center justify-between">
                <span>Central de Notificações</span>
                {unreadOnlineOrdersCount > 0 && (
                  <Badge className="bg-amber-500 text-stone-950 text-[10px] font-bold">
                    {unreadOnlineOrdersCount} on-line
                  </Badge>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-[#44403C]" />
              <div className="space-y-2 py-2">
                {unreadOnlineOrdersCount > 0 && (
                  <div
                    onClick={() => {
                      barContext.clearUnreadOnlineOrders()
                      navigate('/fila-cozinha')
                      setNotifOpen(false)
                    }}
                    className="p-2.5 rounded-lg bg-amber-500/15 border border-amber-500/40 flex items-start gap-3 cursor-pointer hover:bg-amber-500/25 transition-colors"
                  >
                    <div className="p-1.5 rounded-md bg-amber-500 text-stone-950">
                      <QrCode className="w-4 h-4" />
                    </div>
                    <div className="text-xs">
                      <p className="font-bold text-amber-300">Novo Pedido On-line!</p>
                      <p className="text-stone-300 mt-0.5">
                        {unreadOnlineOrdersCount} novo(s) pedido(s) via QR Code na fila de preparo.
                      </p>
                    </div>
                  </div>
                )}

                <div className="p-2.5 rounded-lg bg-[#1C1917] border border-stone-800 flex items-start gap-3">
                  <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-500">
                    <ClipboardList className="w-4 h-4" />
                  </div>
                  <div className="text-xs">
                    <p className="font-semibold text-stone-200">Vendas em Andamento</p>
                    <p className="text-stone-400 mt-0.5">
                      {openComandasCount} mesa(s) ativas com consumo em aberto no momento.
                    </p>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-[#1C1917] border border-stone-800 flex items-start gap-3">
                  <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-400">
                    <ChefHat className="w-4 h-4" />
                  </div>
                  <div className="text-xs">
                    <p className="font-semibold text-stone-200">Fila de Cozinha & Bar</p>
                    <p className="text-stone-400 mt-0.5">
                      {pendingKitchenCount} pedido(s) aguardando ou em preparo nas praças.
                    </p>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-[#1C1917] border border-stone-800 flex items-start gap-3">
                  <div className="p-1.5 rounded-md bg-red-500/10 text-red-400">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div className="text-xs">
                    <p className="font-semibold text-stone-200">Alerta de Estoque</p>
                    <p className="text-stone-400 mt-0.5">
                      {lowStockCount} produto(s) atingiram nível crítico ou esgotaram.
                    </p>
                  </div>
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Profile & Logout */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="bg-[#1C1917] border-[#44403C] text-stone-200 hover:bg-[#44403C] hover:text-white flex items-center gap-2 text-xs"
              >
                <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold text-xs border border-amber-500/40">
                  {role[0]}
                </div>
                <div className="text-left hidden sm:block">
                  <div className="font-semibold leading-none">{profile?.nome_exibicao || role}</div>
                  <div className="text-[10px] text-stone-400">{role}</div>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-60 bg-[#292524] border-[#44403C] text-stone-100 p-1"
            >
              <DropdownMenuLabel className="text-xs text-stone-400">
                <div className="font-bold text-stone-200">
                  {profile?.nome_exibicao || 'Usuário'}
                </div>
                <div className="text-[10px] text-stone-400 truncate">
                  {user?.email || 'Autenticado'}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-[#44403C]" />
              <div className="px-2 py-1 text-[11px] text-stone-400 font-medium">
                Alternar visualização rápida:
              </div>
              {(['Garçom', 'Caixa', 'Gerente'] as UserRole[]).map((r) => (
                <DropdownMenuItem
                  key={r}
                  onClick={() => setRole(r)}
                  className={`cursor-pointer flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg focus:bg-[#44403C] focus:text-stone-100 ${
                    role === r ? 'bg-amber-500/15 text-amber-400 font-semibold' : 'text-stone-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-stone-400" />
                    <span>{r}</span>
                  </div>
                  {role === r && (
                    <Badge
                      variant="outline"
                      className="bg-amber-500/20 text-amber-400 border-amber-500/40 text-[9px]"
                    >
                      Ativo
                    </Badge>
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator className="bg-[#44403C]" />
              <DropdownMenuItem
                onClick={async () => {
                  await signOut()
                  navigate('/login')
                }}
                className="cursor-pointer text-xs py-2 px-2.5 text-red-400 hover:text-red-300 focus:bg-red-950/40 focus:text-red-300 flex items-center gap-2"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sair da conta</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main Container with Sidebar + Content */}
      <div className="flex flex-1 pt-16 pb-16 md:pb-6">
        {/* Fixed Desktop Sidebar */}
        <aside
          className={`hidden md:flex flex-col fixed top-16 bottom-0 left-0 bg-[#292524] border-r border-[#44403C] z-20 transition-all duration-300 ease-in-out ${
            collapsed ? 'w-[72px]' : 'w-[280px]'
          }`}
        >
          {/* Profile Badge in Sidebar */}
          <div className="p-4 border-b border-[#44403C]/80">
            {!collapsed ? (
              <div className="p-3 rounded-xl bg-[#1C1917]/80 border border-[#44403C] flex items-center justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-wider font-semibold text-stone-400">
                    Acesso Ativo
                  </div>
                  <div className="text-sm font-bold text-amber-400 flex items-center gap-1.5 mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    {role}
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="bg-stone-800 text-stone-300 border-stone-700 text-[10px]"
                >
                  v1.3.0
                </Badge>
              </div>
            ) : (
              <div className="flex justify-center" title={`Perfil: ${role}`}>
                <div className="w-10 h-10 rounded-xl bg-[#1C1917] border border-[#44403C] flex items-center justify-center text-amber-500 font-bold text-sm">
                  {role[0]}
                </div>
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const hasAccess = item.roles.includes(role)
              const isActive = location.pathname === item.path

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={(e) => handleNavClick(e, item)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                    isActive
                      ? 'bg-amber-500 text-stone-950 font-bold shadow-md shadow-amber-950/30'
                      : hasAccess
                        ? 'text-stone-300 hover:bg-[#44403C] hover:text-stone-100'
                        : 'text-stone-500 opacity-50 cursor-not-allowed hover:bg-transparent'
                  }`}
                  title={collapsed ? `${item.title}${!hasAccess ? ' (Restrito)' : ''}` : undefined}
                >
                  <Icon
                    className={`w-5 h-5 flex-shrink-0 transition-colors ${
                      isActive ? 'text-stone-950' : hasAccess ? 'text-amber-500' : 'text-stone-600'
                    }`}
                  />
                  {!collapsed && (
                    <div className="flex items-center justify-between flex-1 truncate">
                      <span className="truncate">{item.title}</span>
                      {!hasAccess ? (
                        <span className="text-[10px] text-stone-500 uppercase font-semibold">
                          Bloqueado
                        </span>
                      ) : (
                        item.badgeCount &&
                        item.badgeCount(barContext) > 0 && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-500 text-stone-950">
                            {item.badgeCount(barContext)}
                          </span>
                        )
                      )}
                    </div>
                  )}
                </NavLink>
              )
            })}
          </nav>

          {/* Collapse Sidebar Button */}
          <div className="p-3 border-t border-[#44403C]/80">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-[#1C1917] hover:bg-[#44403C] text-xs text-stone-400 hover:text-stone-200 transition-colors border border-[#44403C]"
            >
              {collapsed ? (
                <ChevronRight className="w-4 h-4 text-amber-500" />
              ) : (
                <>
                  <ChevronLeft className="w-4 h-4 text-amber-500" />
                  <span>Recolher Menu</span>
                </>
              )}
            </button>
          </div>
        </aside>

        {/* Dynamic Content Area */}
        <main
          className={`flex-1 transition-all duration-300 ease-in-out px-4 py-6 lg:px-8 max-w-[1340px] mx-auto w-full ${
            collapsed ? 'md:ml-[72px]' : 'md:ml-[280px]'
          }`}
        >
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (< 768px) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#292524] border-t border-[#44403C] z-30 flex items-center justify-around px-2">
        {visibleNavItems.slice(0, 5).map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.path
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-[11px] font-medium transition-colors ${
                isActive ? 'text-amber-500 font-bold' : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span className="truncate max-w-[64px] text-center">{item.title.split(' ')[0]}</span>
            </NavLink>
          )
        })}
      </nav>

      {/* Footer */}
      <footer
        className={`hidden md:block py-3 px-6 text-center text-xs text-stone-500 border-t border-[#292524] transition-all duration-300 ${
          collapsed ? 'ml-[72px]' : 'ml-[280px]'
        }`}
      >
        <div className="flex items-center justify-between max-w-[1280px] mx-auto">
          <span>
            Rachide Bar v1.3.0 — Gestão Gastronômica, KDS Térmico, Fotos & Gestão de Usuários
          </span>
          <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Supabase Conectado & Operante com Auth por Perfil
          </span>
        </div>
      </footer>

      {/* Global Product Search Modal */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-xl bg-[#292524] border-[#44403C] text-stone-100 p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-stone-100">
              <Search className="w-5 h-5 text-amber-500" />
              Busca Global de Produtos do Rachide Bar
            </DialogTitle>
          </DialogHeader>

          <div className="mt-2 space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-stone-400" />
              <Input
                placeholder="Digite o nome do produto ou categoria (ex: Heineken, Picanha, Chopp)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-[#1C1917] border-[#44403C] text-stone-100 focus:ring-amber-500 text-sm"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-3 text-stone-400 hover:text-stone-200"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
              {searchQuery.trim() === '' ? (
                <div className="py-8 text-center text-stone-400 text-xs">
                  Comece a digitar para encontrar itens no cardápio e verificar estoques em tempo
                  real.
                </div>
              ) : searchResults.length === 0 ? (
                <div className="py-8 text-center text-stone-400 text-sm">
                  Nenhum produto encontrado com o termo &quot;{searchQuery}&quot;.
                </div>
              ) : (
                searchResults.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-[#1C1917] border border-[#44403C] flex items-center justify-between hover:border-amber-500/50 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-stone-100 text-sm">{item.name}</span>
                        <Badge
                          variant="outline"
                          className="bg-[#292524] text-stone-300 border-stone-700 text-[10px]"
                        >
                          {item.category}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs">
                        <span className="text-amber-400 font-bold tabular-nums">
                          R$ {item.price.toFixed(2)}
                        </span>
                        <span className="text-stone-400">
                          Estoque:{' '}
                          <span
                            className={
                              item.stock <= 0
                                ? 'text-red-400 font-bold'
                                : item.stock <= item.minStock
                                  ? 'text-amber-400 font-semibold'
                                  : 'text-emerald-400 font-semibold'
                            }
                          >
                            {item.stock} {item.unit}
                          </span>
                        </span>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => setSelectedProductToAdd({ id: item.id, name: item.name })}
                      disabled={item.stock <= 0}
                      className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs h-8"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Pedir
                    </Button>
                  </div>
                ))
              )}
            </div>

            {/* Quick table selection popup if item clicked */}
            {selectedProductToAdd && (
              <div className="p-4 rounded-xl bg-[#1C1917] border border-amber-500/50 space-y-3">
                <div className="text-xs font-semibold text-amber-400">
                  Adicionar &quot;{selectedProductToAdd.name}&quot; para qual mesa?
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedTableForAdd}
                    onChange={(e) => setSelectedTableForAdd(Number(e.target.value))}
                    className="flex-1 bg-[#292524] border border-[#44403C] rounded-lg px-3 py-1.5 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
                  >
                    {comandas.map((c) => (
                      <option key={c.tableNumber} value={c.tableNumber}>
                        Mesa {c.tableNumber} ({c.status} {c.clientName ? `- ${c.clientName}` : ''})
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    onClick={handleConfirmAddToTable}
                    className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs"
                  >
                    Confirmar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedProductToAdd(null)}
                    className="text-stone-400 text-xs"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
