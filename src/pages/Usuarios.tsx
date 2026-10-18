import React, { useState, useEffect, useMemo } from 'react'
import {
  Users,
  UserPlus,
  Shield,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  Search,
  Lock,
  Mail,
  User,
  RefreshCw,
  BadgeAlert,
  Sparkles,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { UserService, ManagedUser } from '@/services/userService'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'

export default function Usuarios() {
  const { user: currentAuthUser, role } = useAuth()
  const { toast } = useToast()

  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterPerfil, setFilterPerfil] = useState<string>('todos')

  // Modais
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editRoleModalOpen, setEditRoleModalOpen] = useState(false)
  const [resetPasswordModalOpen, setResetPasswordModalOpen] = useState(false)

  // Usuário selecionado para ação
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null)

  // Formulário de Criação
  const [createNome, setCreateNome] = useState('')
  const [createEmail, setCreateEmail] = useState('')
  const [createSenha, setCreateSenha] = useState('')
  const [createPerfil, setCreatePerfil] = useState<'garcom' | 'caixa' | 'gerente'>('garcom')
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false)

  // Formulário de Alteração de Perfil
  const [editNome, setEditNome] = useState('')
  const [editPerfil, setEditPerfil] = useState<'garcom' | 'caixa' | 'gerente'>('garcom')
  const [editAtivo, setEditAtivo] = useState(true)
  const [isSubmittingRole, setIsSubmittingRole] = useState(false)

  // Formulário de Redefinição de Senha
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmittingReset, setIsSubmittingReset] = useState(false)

  const loadUsers = async () => {
    try {
      setLoading(true)
      const list = await UserService.listUsers()
      setUsers(list)
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar equipe',
        description: err.message || 'Não foi possível carregar os usuários.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  // Filtragem
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchSearch =
        u.nome_exibicao.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase())
      const matchPerfil = filterPerfil === 'todos' || u.perfil === filterPerfil
      return matchSearch && matchPerfil
    })
  }, [users, searchQuery, filterPerfil])

  // Contagens
  const stats = useMemo(() => {
    return {
      total: users.length,
      gerentes: users.filter((u) => u.perfil === 'gerente').length,
      caixas: users.filter((u) => u.perfil === 'caixa').length,
      garcons: users.filter((u) => u.perfil === 'garcom').length,
    }
  }, [users])

  // Submissão Criar
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createEmail.trim() || !createSenha || !createNome.trim()) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description: 'Preencha o nome, e-mail e senha do novo usuário.',
      })
      return
    }

    if (createSenha.length < 6) {
      toast({
        variant: 'destructive',
        title: 'Senha muito curta',
        description: 'A senha provisória deve conter no mínimo 6 caracteres.',
      })
      return
    }

    setIsSubmittingCreate(true)
    try {
      await UserService.createUser({
        nome: createNome.trim(),
        email: createEmail.trim(),
        password: createSenha,
        perfil: createPerfil,
      })

      toast({
        title: 'Usuário cadastrado!',
        description: `${createNome} agora tem acesso ao Rachide Bar como ${createPerfil}.`,
      })
      setCreateModalOpen(false)
      setCreateNome('')
      setCreateEmail('')
      setCreateSenha('')
      setCreatePerfil('garcom')
      await loadUsers()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar usuário',
        description: err.message || 'Não foi possível cadastrar o usuário.',
      })
    } finally {
      setIsSubmittingCreate(false)
    }
  }

  // Abrir Modal de Edição de Perfil
  const handleOpenEditRole = (u: ManagedUser) => {
    setSelectedUser(u)
    setEditNome(u.nome_exibicao)
    setEditPerfil(u.perfil)
    setEditAtivo(u.ativo)
    setEditRoleModalOpen(true)
  }

  // Submissão Alterar Perfil
  const handleEditRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return

    const isSelf = currentAuthUser?.id === selectedUser.id
    if (isSelf && editPerfil !== 'gerente') {
      toast({
        variant: 'destructive',
        title: 'Operação bloqueada',
        description: 'Você não pode rebaixar seu próprio perfil de Gerente.',
      })
      return
    }

    setIsSubmittingRole(true)
    try {
      await UserService.updateUserRole({
        userId: selectedUser.id,
        perfil: editPerfil,
        nome: editNome.trim(),
        ativo: editAtivo,
      })

      toast({
        title: 'Perfil atualizado!',
        description: `Dados de ${selectedUser.nome_exibicao} foram salvos com sucesso.`,
      })
      setEditRoleModalOpen(false)
      setSelectedUser(null)
      await loadUsers()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao alterar perfil',
        description: err.message || 'Falha ao salvar modificação.',
      })
    } finally {
      setIsSubmittingRole(false)
    }
  }

  // Abrir Modal de Redefinir Senha
  const handleOpenResetPassword = (u: ManagedUser) => {
    setSelectedUser(u)
    setNewPassword('')
    setConfirmPassword('')
    setResetPasswordModalOpen(true)
  }

  // Submissão Redefinir Senha
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return

    if (newPassword.length < 6) {
      toast({
        variant: 'destructive',
        title: 'Senha muito curta',
        description: 'A nova senha deve possuir no mínimo 6 caracteres.',
      })
      return
    }

    if (newPassword !== confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'Senhas divergentes',
        description: 'A confirmação de senha não coincide.',
      })
      return
    }

    setIsSubmittingReset(true)
    try {
      await UserService.resetPassword(selectedUser.id, newPassword)

      toast({
        title: 'Senha redefinida!',
        description: `A nova senha de ${selectedUser.nome_exibicao} já está ativa para login.`,
      })
      setResetPasswordModalOpen(false)
      setSelectedUser(null)
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao redefinir senha',
        description: err.message || 'Falha ao atualizar a senha no Supabase.',
      })
    } finally {
      setIsSubmittingReset(false)
    }
  }

  const getPerfilBadge = (p: string) => {
    switch (p) {
      case 'gerente':
        return (
          <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/40 text-[10px] font-bold">
            Gerente
          </Badge>
        )
      case 'caixa':
        return (
          <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/40 text-[10px] font-bold">
            Caixa
          </Badge>
        )
      default:
        return (
          <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/40 text-[10px] font-bold">
            Garçom
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Top Banner Gerencial */}
      <div className="p-5 rounded-2xl bg-[#292524] border border-[#44403C] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-stone-100 flex items-center gap-2">
                Gestão de Usuários & Equipe
                <Badge
                  variant="outline"
                  className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px]"
                >
                  Exclusivo Gerente
                </Badge>
              </h2>
              <p className="text-xs text-stone-400 mt-1">
                Cadastre funcionários, defina permissões de acesso (Garçom, Caixa ou Gerente) e
                redefina senhas com segurança via Supabase Auth.
              </p>
            </div>
          </div>
        </div>

        {/* Botão Novo Usuário */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadUsers}
            disabled={loading}
            className="bg-[#1C1917] border-[#44403C] text-stone-300 hover:text-white h-10 px-3 text-xs"
            title="Atualizar lista"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-500' : ''}`} />
          </Button>

          <Button
            onClick={() => setCreateModalOpen(true)}
            className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs h-10 px-4 shadow-md shadow-amber-950/30"
          >
            <UserPlus className="w-4 h-4 mr-1.5" />
            Novo Usuário
          </Button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-[#292524] border border-[#44403C] flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-stone-400 font-semibold">
              Total de Contas
            </div>
            <div className="text-xl font-black text-stone-100 mt-0.5">{stats.total}</div>
          </div>
          <Users className="w-6 h-6 text-stone-500" />
        </div>

        <div className="p-3.5 rounded-xl bg-[#292524] border border-[#44403C] flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-amber-400 font-semibold">
              Gerentes
            </div>
            <div className="text-xl font-black text-amber-400 mt-0.5">{stats.gerentes}</div>
          </div>
          <Shield className="w-6 h-6 text-amber-500/60" />
        </div>

        <div className="p-3.5 rounded-xl bg-[#292524] border border-[#44403C] flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-blue-400 font-semibold">
              Operadores Caixa
            </div>
            <div className="text-xl font-black text-blue-400 mt-0.5">{stats.caixas}</div>
          </div>
          <Sparkles className="w-6 h-6 text-blue-500/60" />
        </div>

        <div className="p-3.5 rounded-xl bg-[#292524] border border-[#44403C] flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-emerald-400 font-semibold">
              Garçons de Salão
            </div>
            <div className="text-xl font-black text-emerald-400 mt-0.5">{stats.garcons}</div>
          </div>
          <CheckCircle2 className="w-6 h-6 text-emerald-500/60" />
        </div>
      </div>

      {/* Barra de Filtro e Busca */}
      <div className="p-4 rounded-xl bg-[#292524] border border-[#44403C] flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-stone-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome ou e-mail..."
            className="pl-9 bg-[#1C1917] border-[#44403C] text-xs text-stone-100 h-9"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-[#1C1917] p-1 rounded-lg border border-[#44403C] text-xs overflow-x-auto">
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'gerente', label: 'Gerentes' },
            { id: 'caixa', label: 'Caixas' },
            { id: 'garcom', label: 'Garçons' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setFilterPerfil(item.id)}
              className={`px-3 py-1 rounded-md font-semibold transition-all whitespace-nowrap ${
                filterPerfil === item.id
                  ? 'bg-amber-500 text-stone-950 font-bold'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela de Usuários */}
      <div className="rounded-2xl bg-[#292524] border border-[#44403C] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#1C1917] border-b border-[#44403C] text-stone-400 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Nome & Identificação</th>
                <th className="py-3 px-4">E-mail de Acesso</th>
                <th className="py-3 px-4">Perfil / Permissão</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Ações Gerenciais</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#44403C]/60 text-stone-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-stone-400 text-xs">
                    Carregando usuários do Supabase...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-stone-400 text-xs">
                    Nenhum usuário encontrado para os critérios de busca.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isCurrent = currentAuthUser?.id === u.id
                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-[#1C1917]/50 transition-colors ${
                        !u.ativo ? 'opacity-60 bg-[#1C1917]/20' : ''
                      }`}
                    >
                      {/* Nome */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-bold text-xs uppercase">
                            {u.nome_exibicao[0] || u.email[0]}
                          </div>
                          <div>
                            <div className="font-bold text-sm text-stone-100 flex items-center gap-2">
                              {u.nome_exibicao}
                              {isCurrent && (
                                <Badge
                                  variant="outline"
                                  className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[9px]"
                                >
                                  Você
                                </Badge>
                              )}
                            </div>
                            <span className="text-[10px] text-stone-500 font-mono">
                              ID: {u.id.slice(0, 8)}...
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* E-mail */}
                      <td className="py-3.5 px-4">
                        <span className="font-medium text-stone-300">{u.email}</span>
                      </td>

                      {/* Perfil */}
                      <td className="py-3.5 px-4">{getPerfilBadge(u.perfil)}</td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                            u.ativo
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-stone-800 text-stone-400 border-stone-700'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              u.ativo ? 'bg-emerald-500 animate-pulse' : 'bg-stone-500'
                            }`}
                          />
                          {u.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenEditRole(u)}
                            className="bg-[#1C1917] hover:bg-[#44403C] border-[#44403C] text-stone-200 hover:text-white h-7 px-2.5 text-xs"
                            title="Alterar perfil de acesso"
                          >
                            <Shield className="w-3.5 h-3.5 mr-1 text-amber-500" />
                            Perfil
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenResetPassword(u)}
                            className="bg-[#1C1917] hover:bg-[#44403C] border-[#44403C] text-stone-200 hover:text-white h-7 px-2.5 text-xs"
                            title="Redefinir senha de acesso"
                          >
                            <KeyRound className="w-3.5 h-3.5 mr-1 text-blue-400" />
                            Redefinir Senha
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dica sobre contas padrão */}
      <div className="p-4 rounded-xl bg-[#292524] border border-[#44403C] text-xs text-stone-400 flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-stone-200">Contas de demonstração do sistema:</span>
          <span className="block mt-0.5 text-stone-300">
            • Gerente: <code className="text-amber-400">gerente@rachide.bar</code> (senha:{' '}
            <code className="text-amber-400">rachide123</code>)<br />• Caixa:{' '}
            <code className="text-amber-400">caixa@rachide.bar</code> (senha:{' '}
            <code className="text-amber-400">rachide123</code>)<br />• Garçom:{' '}
            <code className="text-amber-400">garcom@rachide.bar</code> (senha:{' '}
            <code className="text-amber-400">rachide123</code>)
          </span>
        </div>
      </div>

      {/* MODAL: NOVO USUÁRIO */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="max-w-md bg-[#292524] border-[#44403C] text-stone-100 p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-stone-100 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-amber-500" />
              Cadastrar Novo Usuário
            </DialogTitle>
            <DialogDescription className="text-xs text-stone-400">
              O usuário poderá fazer login imediatamente com o e-mail e senha cadastrados.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-4 pt-2 text-xs">
            <div>
              <Label className="text-stone-300 font-semibold mb-1 block">Nome Completo *</Label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-2.5 text-stone-500" />
                <Input
                  required
                  value={createNome}
                  onChange={(e) => setCreateNome(e.target.value)}
                  placeholder="Ex: Beatriz Lima"
                  className="pl-9 bg-[#1C1917] border-[#44403C] text-stone-100 text-xs h-9"
                />
              </div>
            </div>

            <div>
              <Label className="text-stone-300 font-semibold mb-1 block">
                E-mail corporativo *
              </Label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-2.5 text-stone-500" />
                <Input
                  required
                  type="email"
                  name="new-user-email"
                  autoComplete="off"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  placeholder="beatriz@rachide.bar"
                  className="pl-9 bg-[#1C1917] border-[#44403C] text-stone-100 text-xs h-9"
                />
              </div>
            </div>

            <div>
              <Label className="text-stone-300 font-semibold mb-1 block">
                Senha Inicial (mínimo 6 dígitos) *
              </Label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-2.5 text-stone-500" />
                <Input
                  required
                  type="password"
                  name="new-password"
                  autoComplete="new-password"
                  value={createSenha}
                  onChange={(e) => setCreateSenha(e.target.value)}
                  placeholder="••••••••"
                  className="pl-9 bg-[#1C1917] border-[#44403C] text-stone-100 text-xs h-9"
                />
              </div>
            </div>
            <div>
              <Label className="text-stone-300 font-semibold mb-1 block">Perfil de Acesso *</Label>
              <select
                value={createPerfil}
                onChange={(e) => setCreatePerfil(e.target.value as 'garcom' | 'caixa' | 'gerente')}
                className="w-full bg-[#1C1917] border border-[#44403C] rounded-lg px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
              >
                <option value="garcom">
                  Garçom (Lançar comandas, ver cardápio, fila de pedidos)
                </option>
                <option value="caixa">Caixa (Comandas, fila, fechamento e fluxo de caixa)</option>
                <option value="gerente">
                  Gerente (Acesso total, cadastros, DRE, fiscal e equipe)
                </option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#44403C]">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCreateModalOpen(false)}
                className="text-stone-400 text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmittingCreate}
                className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs"
              >
                {isSubmittingCreate ? 'Cadastrando...' : 'Criar Usuário'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: EDITAR PERFIL */}
      <Dialog open={editRoleModalOpen} onOpenChange={setEditRoleModalOpen}>
        <DialogContent className="max-w-md bg-[#292524] border-[#44403C] text-stone-100 p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-stone-100 flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-500" />
              Alterar Perfil de Acesso
            </DialogTitle>
            <DialogDescription className="text-xs text-stone-400">
              Modifique a função e status de {selectedUser?.email}.
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <form onSubmit={handleEditRoleSubmit} className="space-y-4 pt-2 text-xs">
              <div>
                <Label className="text-stone-300 font-semibold mb-1 block">Nome de Exibição</Label>
                <Input
                  value={editNome}
                  onChange={(e) => setEditNome(e.target.value)}
                  className="bg-[#1C1917] border-[#44403C] text-stone-100 text-xs h-9"
                />
              </div>

              <div>
                <Label className="text-stone-300 font-semibold mb-1 block">Perfil / Papel *</Label>
                <select
                  value={editPerfil}
                  onChange={(e) => setEditPerfil(e.target.value as 'garcom' | 'caixa' | 'gerente')}
                  className="w-full bg-[#1C1917] border border-[#44403C] rounded-lg px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="garcom">Garçom</option>
                  <option value="caixa">Caixa</option>
                  <option value="gerente">Gerente</option>
                </select>
                {currentAuthUser?.id === selectedUser.id && (
                  <p className="text-[11px] text-amber-400/90 mt-1 flex items-center gap-1">
                    <BadgeAlert className="w-3.5 h-3.5 inline" />
                    Você não pode remover o perfil Gerente da sua própria conta.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-[#1C1917] border border-[#44403C]">
                <div>
                  <span className="font-semibold text-stone-200">Acesso Ativo</span>
                  <p className="text-[11px] text-stone-400">
                    Se desativado, o funcionário não conseguirá logar.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={editAtivo}
                  disabled={currentAuthUser?.id === selectedUser.id}
                  onChange={(e) => setEditAtivo(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 bg-[#292524] border-[#44403C]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#44403C]">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setEditRoleModalOpen(false)}
                  className="text-stone-400 text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmittingRole}
                  className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs"
                >
                  {isSubmittingRole ? 'Salvando...' : 'Salvar Perfil'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL: REDEFINIR SENHA */}
      <Dialog open={resetPasswordModalOpen} onOpenChange={setResetPasswordModalOpen}>
        <DialogContent className="max-w-md bg-[#292524] border-[#44403C] text-stone-100 p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-stone-100 flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-blue-400" />
              Redefinir Senha do Usuário
            </DialogTitle>
            <DialogDescription className="text-xs text-stone-400">
              Digite a nova senha para {selectedUser?.nome_exibicao} ({selectedUser?.email}).
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <form onSubmit={handleResetPasswordSubmit} className="space-y-4 pt-2 text-xs">
              <div>
                <Label className="text-stone-300 font-semibold mb-1 block">
                  Nova Senha (mín. 6 caracteres) *
                </Label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-2.5 text-stone-500" />
                  <Input
                    required
                    type="password"
                    name="new-password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-9 bg-[#1C1917] border-[#44403C] text-stone-100 text-xs h-9"
                  />
                </div>
              </div>

              <div>
                <Label className="text-stone-300 font-semibold mb-1 block">
                  Confirmar Nova Senha *
                </Label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-2.5 text-stone-500" />
                  <Input
                    required
                    type="password"
                    name="confirm-new-password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-9 bg-[#1C1917] border-[#44403C] text-stone-100 text-xs h-9"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#44403C]">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setResetPasswordModalOpen(false)}
                  className="text-stone-400 text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmittingReset}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
                >
                  {isSubmittingReset ? 'Redefinindo...' : 'Atualizar Senha'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
