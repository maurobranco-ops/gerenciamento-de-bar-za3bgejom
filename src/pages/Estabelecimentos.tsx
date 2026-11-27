import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Building2,
  Plus,
  Pencil,
  Power,
  RefreshCw,
  Search,
  Users,
  Utensils,
  Store,
  MapPin,
  UserPlus,
  UserMinus,
  UserCheck,
  ChevronDown,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { EstabelecimentoService } from '@/services/estabelecimentoService'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import type {
  EstabelecimentoComContagens,
  UsuarioEstabelecimento,
  PerfilUsuario,
} from '@/types/tenant'

export default function Estabelecimentos() {
  const { user: currentAuthUser } = useAuth()
  const { toast } = useToast()

  const [estabelecimentos, setEstabelecimentos] = useState<EstabelecimentoComContagens[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // Modais
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [usuariosOpenFor, setUsuariosOpenFor] = useState<EstabelecimentoComContagens | null>(null)

  // Formulário de cadastro/edição
  const [nome, setNome] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [endereco, setEndereco] = useState('')
  const [qtdMesas, setQtdMesas] = useState(10)
  const [saving, setSaving] = useState(false)

  // Painel de usuários
  const [usuarios, setUsuarios] = useState<UsuarioEstabelecimento[]>([])
  const [usuariosLoading, setUsuariosLoading] = useState(false)
  const [novoUsuarioOpen, setNovoUsuarioOpen] = useState(false)
  const [nuEmail, setNuEmail] = useState('')
  const [nuNome, setNuNome] = useState('')
  const [nuSenha, setNuSenha] = useState('')
  const [nuPerfil, setNuPerfil] = useState<PerfilUsuario>('garcom')
  const [nuSubmitting, setNuSubmitting] = useState(false)
  const [vincPerfilPorUsuario, setVincPerfilPorUsuario] = useState<Record<string, PerfilUsuario>>(
    {},
  )
  const [vincSubmitting, setVincSubmitting] = useState<string | null>(null)

  const loadEstabelecimentos = useCallback(async () => {
    try {
      setLoading(true)
      const list = await EstabelecimentoService.listar()
      setEstabelecimentos(list)
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar estabelecimentos',
        description: err.message || 'Não foi possível listar os estabelecimentos.',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadEstabelecimentos()
  }, [loadEstabelecimentos])

  const abrirNovo = () => {
    setEditingId(null)
    setNome('')
    setCnpj('')
    setEndereco('')
    setQtdMesas(10)
    setFormOpen(true)
  }

  const abrirEdicao = (e: EstabelecimentoComContagens) => {
    setEditingId(e.id)
    setNome(e.nome)
    setCnpj(e.cnpj || '')
    setEndereco(e.endereco || '')
    setQtdMesas(e.qtd_mesas || 10)
    setFormOpen(true)
  }

  const salvarForm = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!nome.trim()) {
      toast({
        variant: 'destructive',
        title: 'Campo obrigatório',
        description: 'Informe o nome do estabelecimento.',
      })
      return
    }
    setSaving(true)
    try {
      if (editingId) {
        await EstabelecimentoService.atualizar({
          id: editingId,
          nome: nome.trim(),
          cnpj: cnpj.trim(),
          endereco: endereco.trim(),
          ativo: true,
          // Preserva o status atual em edição simples (sem alternar por aqui)
        } as any)
        toast({
          title: 'Estabelecimento atualizado!',
          description: `Dados de "${nome.trim()}" foram salvos com sucesso.`,
        })
        setFormOpen(false)
        await loadEstabelecimentos()
      } else {
        const res = await EstabelecimentoService.criar({
          nome: nome.trim(),
          cnpj: cnpj.trim(),
          endereco: endereco.trim(),
          qtdMesas,
        })
        toast({
          title: 'Estabelecimento criado!',
          description: `${res.mensagem} Próximo passo: cadastre o cardápio (menu Produtos) e vincule os usuários.`,
        })
        setFormOpen(false)
        await loadEstabelecimentos()
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: editingId ? 'Erro ao salvar' : 'Erro ao criar estabelecimento',
        description: err.message || 'Falha na operação.',
      })
    } finally {
      setSaving(false)
    }
  }

  const alternarAtivo = async (e: EstabelecimentoComContagens) => {
    const novoEstado = !e.ativo
    try {
      await EstabelecimentoService.atualizar({
        id: e.id,
        nome: e.nome,
        cnpj: e.cnpj || '',
        endereco: e.endereco || '',
        ativo: novoEstado,
      } as any)
      toast({
        title: novoEstado ? 'Estabelecimento ativado' : 'Estabelecimento desativado',
        description: novoEstado
          ? `"${e.nome}" voltou a aparecer no seletor de login.`
          : `"${e.nome}" foi removido do seletor de login e seus usuários perdem acesso até reativação.`,
      })
      await loadEstabelecimentos()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao alterar status',
        description: err.message || 'Falha ao ativar/desativar estabelecimento.',
      })
    }
  }

  const loadUsuarios = useCallback(
    async (estId: string) => {
      setUsuariosLoading(true)
      try {
        const list = await EstabelecimentoService.listarUsuarios(estId)
        setUsuarios(list)
        const pref: Record<string, PerfilUsuario> = {}
        list.forEach((u) => {
          pref[u.usuario_id] = u.vinculado ? (u.perfil as PerfilUsuario) : 'garcom'
        })
        setVincPerfilPorUsuario(pref)
      } catch (err: any) {
        toast({
          variant: 'destructive',
          title: 'Erro ao carregar usuários',
          description: err.message || 'Não foi possível listar os usuários.',
        })
      } finally {
        setUsuariosLoading(false)
      }
    },
    [toast],
  )

  useEffect(() => {
    if (usuariosOpenFor) loadUsuarios(usuariosOpenFor.id)
  }, [usuariosOpenFor?.id])

  const handleVincular = async (u: UsuarioEstabelecimento) => {
    if (!usuariosOpenFor) return
    setVincSubmitting(u.usuario_id)
    try {
      await EstabelecimentoService.vincularUsuario({
        userId: u.usuario_id,
        estabelecimentoId: usuariosOpenFor.id,
        perfil: vincPerfilPorUsuario[u.usuario_id] || 'garcom',
      })
      toast({
        title: 'Usuário vinculado!',
        description: `${u.nome_exibicao} agora acessa "${usuariosOpenFor.nome}" como ${vincPerfilPorUsuario[u.usuario_id] || 'garcom'}.`,
      })
      await loadUsuarios(usuariosOpenFor.id)
      await loadEstabelecimentos()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao vincular usuário',
        description: err.message || 'Falha ao vincular usuário.',
      })
    } finally {
      setVincSubmitting(null)
    }
  }

  const handleDesvincular = async (u: UsuarioEstabelecimento) => {
    if (!usuariosOpenFor) return
    if (currentAuthUser?.id === u.usuario_id) {
      toast({
        variant: 'destructive',
        title: 'Operação bloqueada',
        description: 'Você não pode desvincular o seu próprio usuário.',
      })
      return
    }
    setVincSubmitting(u.usuario_id)
    try {
      await EstabelecimentoService.desvincularUsuario(u.usuario_id)
      toast({
        title: 'Usuário desvinculado',
        description: `${u.nome_exibicao} ficou sem acesso até novo vínculo.`,
      })
      await loadUsuarios(usuariosOpenFor.id)
      await loadEstabelecimentos()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao desvincular',
        description: err.message || 'Falha ao desvincular usuário.',
      })
    } finally {
      setVincSubmitting(null)
    }
  }

  const handleNovoUsuarioSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!usuariosOpenFor) return
    if (!nuEmail.trim() || !nuSenha || !nuNome.trim()) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description: 'Preencha nome, e-mail e senha inicial.',
      })
      return
    }
    if (nuSenha.length < 6) {
      toast({
        variant: 'destructive',
        title: 'Senha muito curta',
        description: 'A senha inicial deve conter no mínimo 6 caracteres.',
      })
      return
    }
    setNuSubmitting(true)
    try {
      await EstabelecimentoService.criarUsuario({
        estabelecimentoId: usuariosOpenFor.id,
        email: nuEmail.trim(),
        senha: nuSenha,
        nome: nuNome.trim(),
        perfil: nuPerfil,
      })
      toast({
        title: 'Usuário criado!',
        description: `${nuNome.trim()} agora acessa "${usuariosOpenFor.nome}" como ${nuPerfil}.`,
      })
      setNuEmail('')
      setNuNome('')
      setNuSenha('')
      setNuPerfil('garcom')
      setNovoUsuarioOpen(false)
      await loadUsuarios(usuariosOpenFor.id)
      await loadEstabelecimentos()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar usuário',
        description: err.message || 'Falha ao cadastrar o usuário.',
      })
    } finally {
      setNuSubmitting(false)
    }
  }

  const listaFiltrada = useMemo(() => {
    const q = searchQuery.toLowerCase()
    return estabelecimentos.filter(
      (e) =>
        e.nome.toLowerCase().includes(q) ||
        (e.cnpj || '').toLowerCase().includes(q) ||
        (e.endereco || '').toLowerCase().includes(q),
    )
  }, [estabelecimentos, searchQuery])

  const stats = useMemo(
    () => ({
      total: estabelecimentos.length,
      ativos: estabelecimentos.filter((e) => e.ativo).length,
      mesas: estabelecimentos.reduce((acc, e) => acc + Number(e.qtd_mesas || 0), 0),
      usuarios: estabelecimentos.reduce((acc, e) => acc + Number(e.qtd_usuarios || 0), 0),
    }),
    [estabelecimentos],
  )

  const cnpjMask = (v: string) =>
    v
      .replace(/\D/g, '')
      .slice(0, 14)
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2')

  const formatCNPJ = (raw: string | null) => {
    if (!raw) return '—'
    const d = raw.replace(/\D/g, '')
    if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
    return raw
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
      case 'cozinha':
        return (
          <Badge className="bg-orange-500/15 text-orange-400 border-orange-500/40 text-[10px] font-bold">
            Cozinha
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
      {/* Banner Gerencial */}
      <div className="p-5 rounded-2xl bg-[#292524] border border-[#44403C] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-stone-100 flex items-center gap-2">
                Estabelecimentos (Multi-tenant)
                <Badge
                  variant="outline"
                  className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px]"
                >
                  Exclusivo Gerente
                </Badge>
              </h2>
              <p className="text-xs text-stone-400 mt-1">
                Cadastre empresas na plataforma, crie mesas iniciais e vincule a equipe de cada
                tenant. O Rachide Bar segue operando como piloto.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadEstabelecimentos}
            disabled={loading}
            className="bg-[#1C1917] border-[#44403C] text-stone-300 hover:text-white h-10 px-3 text-xs"
            title="Atualizar lista"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-500' : ''}`} />
          </Button>
          <Button
            onClick={abrirNovo}
            className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs h-10 px-4 shadow-md shadow-amber-950/30"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Novo Estabelecimento
          </Button>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-[#292524] border border-[#44403C] flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-stone-400 font-semibold">
              Total
            </div>
            <div className="text-xl font-black text-stone-100 mt-0.5">{stats.total}</div>
          </div>
          <Building2 className="w-5 h-5 text-stone-500" />
        </div>
        <div className="p-3.5 rounded-xl bg-[#292524] border border-[#44403C] flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-emerald-400 font-semibold">
              Ativos
            </div>
            <div className="text-xl font-black text-emerald-400 mt-0.5">{stats.ativos}</div>
          </div>
          <Store className="w-5 h-5 text-emerald-500/60" />
        </div>
        <div className="p-3.5 rounded-xl bg-[#292524] border border-[#44403C] flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-blue-400 font-semibold">
              Mesas (todas)
            </div>
            <div className="text-xl font-black text-blue-400 mt-0.5">{stats.mesas}</div>
          </div>
          <Utensils className="w-5 h-5 text-blue-500/60" />
        </div>
        <div className="p-3.5 rounded-xl bg-[#292524] border border-[#44403C] flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-amber-400 font-semibold">
              Usuários (todos)
            </div>
            <div className="text-xl font-black text-amber-400 mt-0.5">{stats.usuarios}</div>
          </div>
          <Users className="w-5 h-5 text-amber-500/60" />
        </div>
      </div>

      {/* Busca */}
      <div className="p-4 rounded-xl bg-[#292524] border border-[#44403C]">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-stone-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome, CNPJ ou endereço..."
            className="pl-9 bg-[#1C1917] border-[#44403C] text-xs text-stone-100 h-9"
            aria-label="Buscar estabelecimentos"
          />
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-2xl bg-[#292524] border border-[#44403C] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#1C1917] border-b border-[#44403C] text-stone-400 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Estabelecimento</th>
                <th className="py-3 px-4">CNPJ</th>
                <th className="py-3 px-4">Endereço</th>
                <th className="py-3 px-4 text-center">Mesas</th>
                <th className="py-3 px-4 text-center">Usuários</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#44403C]/60 text-stone-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-stone-400 text-xs">
                    Carregando estabelecimentos...
                  </td>
                </tr>
              ) : listaFiltrada.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-stone-400 text-xs">
                    Nenhum estabelecimento encontrado. Clique em "Novo Estabelecimento" para
                    cadastrar.
                  </td>
                </tr>
              ) : (
                listaFiltrada.map((e) => (
                  <React.Fragment key={e.id}>
                    <tr
                      className={`hover:bg-[#1C1917]/50 transition-colors ${!e.ativo ? 'opacity-60 bg-[#1C1917]/20' : ''}`}
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-bold text-xs uppercase">
                            {e.nome[0]}
                          </div>
                          <div className="font-bold text-sm text-stone-100">{e.nome}</div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-stone-300">{formatCNPJ(e.cnpj)}</td>
                      <td
                        className="py-3.5 px-4 text-stone-300 max-w-[220px] truncate"
                        title={e.endereco || ''}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-stone-500 flex-shrink-0" />
                          {e.endereco || '—'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-stone-100">
                        {e.qtd_mesas}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-stone-100">
                        {e.qtd_usuarios}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                            e.ativo
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-stone-800 text-stone-400 border-stone-700'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              e.ativo ? 'bg-emerald-500 animate-pulse' : 'bg-stone-500'
                            }`}
                          />
                          {e.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setUsuariosOpenFor(e)}
                            className="bg-[#1C1917] hover:bg-[#44403C] border-[#44403C] text-stone-200 hover:text-white h-7 px-2.5 text-xs"
                            title="Gerenciar usuários do estabelecimento"
                          >
                            <Users className="w-3.5 h-3.5 mr-1 text-blue-400" />
                            Usuários
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => abrirEdicao(e)}
                            className="bg-[#1C1917] hover:bg-[#44403C] border-[#44403C] text-stone-200 hover:text-white h-7 px-2.5 text-xs"
                            title="Editar dados do estabelecimento"
                          >
                            <Pencil className="w-3.5 h-3.5 mr-1 text-amber-500" />
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => alternarAtivo(e)}
                            className={`h-7 px-2.5 text-xs border-[#44403C] ${
                              e.ativo
                                ? 'bg-red-950/40 hover:bg-red-900/40 text-red-300 border-red-900/50'
                                : 'bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-300 border-emerald-900/50'
                            }`}
                            title={
                              e.ativo ? 'Desativar estabelecimento' : 'Reativar estabelecimento'
                            }
                          >
                            <Power className="w-3.5 h-3.5 mr-1" />
                            {e.ativo ? 'Desativar' : 'Ativar'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: CADASTRO / EDIÇÃO */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md bg-[#292524] border-[#44403C] text-stone-100 p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-stone-100 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-amber-500" />
              {editingId ? 'Editar Estabelecimento' : 'Novo Estabelecimento'}
            </DialogTitle>
            <DialogDescription className="text-xs text-stone-400">
              {editingId
                ? 'Altere os dados cadastrais do estabelecimento.'
                : 'Ao salvar, o tenant nasce com mesas iniciais, configuração padrão (Pix = CNPJ) e fica ativo no login.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={salvarForm} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="est-nome" className="text-xs text-stone-300 font-semibold">
                Nome do estabelecimento *
              </Label>
              <Input
                id="est-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Bar do Zé"
                required
                className="bg-[#1C1917] border-[#44403C] text-stone-100 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="est-cnpj" className="text-xs text-stone-300 font-semibold">
                CNPJ
              </Label>
              <Input
                id="est-cnpj"
                value={cnpj}
                onChange={(e) => setCnpj(cnpjMask(e.target.value))}
                placeholder="00.000.000/0000-00"
                inputMode="numeric"
                className="bg-[#1C1917] border-[#44403C] text-stone-100 text-sm font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="est-endereco" className="text-xs text-stone-300 font-semibold">
                Endereço
              </Label>
              <Textarea
                id="est-endereco"
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                placeholder="Rua, número, bairro, cidade - UF"
                rows={2}
                className="bg-[#1C1917] border-[#44403C] text-stone-100 text-sm"
              />
            </div>
            {!editingId && (
              <div className="space-y-1.5">
                <Label htmlFor="est-mesas" className="text-xs text-stone-300 font-semibold">
                  Quantidade de mesas iniciais
                </Label>
                <Select value={String(qtdMesas)} onValueChange={(v) => setQtdMesas(Number(v))}>
                  <SelectTrigger
                    id="est-mesas"
                    className="w-full bg-[#1C1917] border-[#44403C] text-stone-100 text-sm"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#292524] border-[#44403C] text-stone-100">
                    {[5, 10, 15, 20, 30].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} mesas
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-stone-500">
                  Mesas criadas como registros no banco (número sequencial, status Livre, capacidade
                  4). O cardápio começa vazio — cadastre-o após criar o tenant.
                </p>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormOpen(false)}
                className="bg-[#1C1917] border-[#44403C] text-stone-300 hover:text-white text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs"
              >
                {saving ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Cadastrar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: USUÁRIOS DO ESTABELECIMENTO */}
      <Dialog open={!!usuariosOpenFor} onOpenChange={(open) => !open && setUsuariosOpenFor(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-[#292524] border-[#44403C] text-stone-100 p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-stone-100 flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-500" />
              Usuários — {usuariosOpenFor?.nome}
            </DialogTitle>
            <DialogDescription className="text-xs text-stone-400">
              Vincule usuários existentes ou crie novos acessos, escolhendo o perfil (Garçom, Caixa,
              Gerente ou Cozinha).
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end">
            <Button
              onClick={() => setNovoUsuarioOpen(true)}
              className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs h-9"
            >
              <UserPlus className="w-4 h-4 mr-1.5" />
              Criar Novo Usuário
            </Button>
          </div>

          <div className="rounded-xl border border-[#44403C] overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#1C1917] border-b border-[#44403C] text-stone-400 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Usuário</th>
                  <th className="py-2.5 px-3">Tenant Atual</th>
                  <th className="py-2.5 px-3">Perfil p/ Vínculo</th>
                  <th className="py-2.5 px-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#44403C]/60 text-stone-200">
                {usuariosLoading ? (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-stone-400">
                      Carregando usuários...
                    </td>
                  </tr>
                ) : usuarios.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-stone-400">
                      Nenhum usuário cadastrado no sistema ainda.
                    </td>
                  </tr>
                ) : (
                  usuarios.map((u) => (
                    <tr key={u.usuario_id} className={!u.ativo ? 'opacity-60' : ''}>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-stone-100">{u.nome_exibicao}</div>
                        <div className="text-[10px] text-stone-500">{u.email}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        {u.vinculado ? (
                          <div className="flex items-center gap-2">
                            {getPerfilBadge(u.perfil)}
                            <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/40 text-[10px]">
                              Vinculado
                            </Badge>
                          </div>
                        ) : u.tenant_id ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] text-stone-400 border-stone-600"
                          >
                            Outro tenant
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[10px] text-stone-400 border-stone-600"
                          >
                            Sem vínculo
                          </Badge>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <Select
                          value={vincPerfilPorUsuario[u.usuario_id] || 'garcom'}
                          onValueChange={(v) =>
                            setVincPerfilPorUsuario((prev) => ({
                              ...prev,
                              [u.usuario_id]: v as PerfilUsuario,
                            }))
                          }
                        >
                          <SelectTrigger
                            aria-label={`Perfil para ${u.nome_exibicao}`}
                            className="h-8 w-[110px] bg-[#1C1917] border-[#44403C] text-stone-100 text-xs"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#292524] border-[#44403C] text-stone-100">
                            <SelectItem value="garcom">Garçom</SelectItem>
                            <SelectItem value="caixa">Caixa</SelectItem>
                            <SelectItem value="gerente">Gerente</SelectItem>
                            <SelectItem value="cozinha">Cozinha</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {u.vinculado ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={
                              vincSubmitting === u.usuario_id ||
                              currentAuthUser?.id === u.usuario_id
                            }
                            onClick={() => handleDesvincular(u)}
                            className="h-7 px-2.5 text-xs bg-red-950/40 hover:bg-red-900/40 text-red-300 border-red-900/50"
                            title="Desvincular usuário deste estabelecimento"
                          >
                            <UserMinus className="w-3.5 h-3.5 mr-1" />
                            Desvincular
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            disabled={vincSubmitting === u.usuario_id}
                            onClick={() => handleVincular(u)}
                            className="h-7 px-2.5 text-xs bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold"
                            title="Vincular usuário a este estabelecimento"
                          >
                            <UserCheck className="w-3.5 h-3.5 mr-1" />
                            Vincular
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL: NOVO USUÁRIO */}
      <Dialog open={novoUsuarioOpen} onOpenChange={setNovoUsuarioOpen}>
        <DialogContent className="max-w-md bg-[#292524] border-[#44403C] text-stone-100 p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-stone-100 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-amber-500" />
              Criar Usuário para {usuariosOpenFor?.nome}
            </DialogTitle>
            <DialogDescription className="text-xs text-stone-400">
              O acesso é criado no Supabase Auth e já vinculado a este estabelecimento.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleNovoUsuarioSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nu-nome" className="text-xs text-stone-300 font-semibold">
                Nome *
              </Label>
              <Input
                id="nu-nome"
                value={nuNome}
                onChange={(e) => setNuNome(e.target.value)}
                autoComplete="off"
                required
                className="bg-[#1C1917] border-[#44403C] text-stone-100 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nu-email" className="text-xs text-stone-300 font-semibold">
                E-mail de acesso *
              </Label>
              <Input
                id="nu-email"
                type="email"
                value={nuEmail}
                onChange={(e) => setNuEmail(e.target.value)}
                autoComplete="off"
                required
                className="bg-[#1C1917] border-[#44403C] text-stone-100 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nu-senha" className="text-xs text-stone-300 font-semibold">
                Senha inicial * (mín. 6)
              </Label>
              <Input
                id="nu-senha"
                type="password"
                value={nuSenha}
                onChange={(e) => setNuSenha(e.target.value)}
                autoComplete="new-password"
                required
                minLength={6}
                className="bg-[#1C1917] border-[#44403C] text-stone-100 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nu-perfil" className="text-xs text-stone-300 font-semibold">
                Perfil de acesso *
              </Label>
              <Select value={nuPerfil} onValueChange={(v) => setNuPerfil(v as PerfilUsuario)}>
                <SelectTrigger
                  id="nu-perfil"
                  className="w-full bg-[#1C1917] border-[#44403C] text-stone-100 text-sm"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#292524] border-[#44403C] text-stone-100">
                  <SelectItem value="garcom">Garçom</SelectItem>
                  <SelectItem value="caixa">Caixa</SelectItem>
                  <SelectItem value="gerente">Gerente</SelectItem>
                  <SelectItem value="cozinha">Cozinha</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setNovoUsuarioOpen(false)}
                className="bg-[#1C1917] border-[#44403C] text-stone-300 hover:text-white text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={nuSubmitting}
                className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs"
              >
                {nuSubmitting ? 'Criando...' : 'Criar e Vincular'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
