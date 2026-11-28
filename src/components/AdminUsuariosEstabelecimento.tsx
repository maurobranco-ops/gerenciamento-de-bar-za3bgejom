import { useEffect, useState } from 'react'
import {
  EstabelecimentoService,
  type AdminUsuarioEstabelecimento,
  type PerfilGestao,
} from '@/services/estabelecimentoService'
import type { EstabelecimentoComContagens } from '@/types/tenant'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { KeyRound, Loader2, Plus, Power, Trash2, Users } from 'lucide-react'

const PERFIS: { value: PerfilGestao; label: string }[] = [
  { value: 'gerente', label: 'Gerente' },
  { value: 'garcom', label: 'Garçom' },
  { value: 'caixa', label: 'Caixa' },
  { value: 'cozinha', label: 'Cozinha' },
]

const perfilLabel = (perfil: string) => PERFIS.find((p) => p.value === perfil)?.label ?? perfil

const SELECT_CLASS =
  'flex h-10 w-full rounded-md border border-[#44403C] bg-[#1C1917] px-3 text-sm text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500'

interface Props {
  estabelecimento: EstabelecimentoComContagens | null
  onOpenChange: (open: boolean) => void
  onChanged: () => void
}

/** Lista e gerencia os usuários de UM estabelecimento, a partir da Administração da plataforma. */
export function AdminUsuariosEstabelecimento({ estabelecimento, onOpenChange, onChanged }: Props) {
  const { toast } = useToast()
  const estabelecimentoId = estabelecimento?.id

  const [usuarios, setUsuarios] = useState<AdminUsuarioEstabelecimento[]>([])
  const [loading, setLoading] = useState(false)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [novoEmail, setNovoEmail] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [novoPerfil, setNovoPerfil] = useState<PerfilGestao>('gerente')
  const [resetId, setResetId] = useState<string | null>(null)
  const [resetSenha, setResetSenha] = useState('')
  const [resetSaving, setResetSaving] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [excluirAlvo, setExcluirAlvo] = useState<AdminUsuarioEstabelecimento | null>(null)
  const [excluirSaving, setExcluirSaving] = useState(false)

  const carregar = async () => {
    if (!estabelecimentoId) return
    setLoading(true)
    try {
      setUsuarios(await EstabelecimentoService.adminListarUsuarios(estabelecimentoId))
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar usuários',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setUsuarios([])
    setMostrarForm(false)
    setResetId(null)
    setResetSenha('')
    setNovoNome('')
    setNovoEmail('')
    setNovaSenha('')
    setNovoPerfil('gerente')
    if (estabelecimentoId) carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estabelecimentoId])

  const criarUsuario = async () => {
    if (!estabelecimentoId) return
    const email = novoEmail.trim()
    if (!novoNome.trim()) {
      toast({ title: 'Informe o nome do usuário', variant: 'destructive' })
      return
    }
    if (!email.includes('@')) {
      toast({ title: 'Informe um e-mail válido', variant: 'destructive' })
      return
    }
    if (novaSenha.length < 6) {
      toast({ title: 'A senha provisória deve ter no mínimo 6 caracteres', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      await EstabelecimentoService.adminCriarUsuario({
        estabelecimentoId,
        nome: novoNome.trim(),
        email,
        senha: novaSenha,
        perfil: novoPerfil,
      })
      toast({
        title: 'Usuário criado',
        description: `${novoNome.trim()} já pode entrar com a senha provisória.`,
      })
      setNovoNome('')
      setNovoEmail('')
      setNovaSenha('')
      setNovoPerfil('gerente')
      setMostrarForm(false)
      await carregar()
      onChanged()
    } catch (err: any) {
      toast({
        title: 'Erro ao criar usuário',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const redefinirSenha = async (userId: string) => {
    if (!estabelecimentoId) return
    if (resetSenha.length < 6) {
      toast({ title: 'A senha provisória deve ter no mínimo 6 caracteres', variant: 'destructive' })
      return
    }
    setResetSaving(true)
    try {
      await EstabelecimentoService.adminRedefinirSenhaUsuario(estabelecimentoId, userId, resetSenha)
      toast({ title: 'Senha provisória redefinida' })
      setResetId(null)
      setResetSenha('')
    } catch (err: any) {
      toast({
        title: 'Erro ao redefinir senha',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setResetSaving(false)
    }
  }

  const alternarAtivo = async (u: AdminUsuarioEstabelecimento) => {
    if (!estabelecimentoId) return
    setTogglingId(u.usuario_id)
    try {
      await EstabelecimentoService.adminAtivarUsuario(estabelecimentoId, u.usuario_id, !u.ativo)
      toast({
        title: u.ativo ? 'Usuário desativado' : 'Usuário ativado',
        description: u.ativo
          ? `${u.nome_exibicao} não consegue mais entrar neste estabelecimento.`
          : `${u.nome_exibicao} voltou a poder entrar.`,
      })
      await carregar()
      onChanged()
    } catch (err: any) {
      toast({
        title: 'Erro ao alterar usuário',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setTogglingId(null)
    }
  }

  // Exclusão definitiva: remove o perfil e a conta de login (RPC admin_excluir_usuario_estabelecimento)
  const confirmarExcluir = async () => {
    if (!estabelecimentoId || !excluirAlvo) return
    setExcluirSaving(true)
    try {
      await EstabelecimentoService.adminExcluirUsuario(estabelecimentoId, excluirAlvo.usuario_id)
      toast({
        title: 'Usuário excluído',
        description: `${excluirAlvo.nome_exibicao} (${excluirAlvo.email}) perdeu o acesso definitivamente.`,
      })
      setExcluirAlvo(null)
      await carregar()
      onChanged()
    } catch (err: any) {
      toast({
        title: 'Erro ao excluir usuário',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setExcluirSaving(false)
    }
  }

  return (
    <Dialog open={!!estabelecimento} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#292524] border-[#44403C] text-stone-100 max-w-2xl max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-500" />
            Usuários — {estabelecimento?.nome}
          </DialogTitle>
          <DialogDescription className="text-stone-400 text-xs">
            Crie acessos com senha provisória, redefina senhas e ative ou desative usuários deste
            estabelecimento.
          </DialogDescription>
        </DialogHeader>

        {/* Lista */}
        <div className="rounded-lg border border-[#44403C] divide-y divide-[#44403C]">
          {loading ? (
            <div className="p-3 space-y-2">
              {[0, 1].map((i) => (
                <Skeleton key={i} className="h-12 w-full bg-[#1C1917]" />
              ))}
            </div>
          ) : usuarios.length === 0 ? (
            <p className="p-6 text-center text-sm text-stone-400">
              Este estabelecimento ainda não tem usuários. Crie o primeiro Gerente abaixo.
            </p>
          ) : (
            usuarios.map((u) => (
              <div key={u.usuario_id} className="p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2 justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-stone-100 truncate">
                      {u.nome_exibicao}
                    </div>
                    <div className="text-xs text-stone-400 truncate">{u.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-amber-500/30 text-amber-300">
                      {perfilLabel(u.perfil)}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={
                        u.ativo
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : 'bg-red-500/15 text-red-400 border-red-500/30'
                      }
                    >
                      {u.ativo ? 'Ativo' : 'Inativo'}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setResetId(resetId === u.usuario_id ? null : u.usuario_id)
                        setResetSenha('')
                      }}
                      aria-label={`Redefinir senha de ${u.nome_exibicao}`}
                      title="Redefinir senha provisória"
                      className="text-stone-400 hover:text-amber-400 hover:bg-amber-500/10 h-8 w-8 p-0"
                    >
                      <KeyRound className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExcluirAlvo(u)}
                      disabled={excluirSaving}
                      aria-label={`Excluir ${u.nome_exibicao}`}
                      title="Excluir usuário (remove o acesso definitivamente)"
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 w-8 p-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => alternarAtivo(u)}
                      disabled={togglingId === u.usuario_id}
                      aria-label={
                        u.ativo ? `Desativar ${u.nome_exibicao}` : `Ativar ${u.nome_exibicao}`
                      }
                      title={u.ativo ? 'Desativar acesso' : 'Ativar acesso'}
                      className={
                        u.ativo
                          ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 w-8 p-0'
                          : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 h-8 w-8 p-0'
                      }
                    >
                      {togglingId === u.usuario_id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Power className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {resetId === u.usuario_id && (
                  <div className="flex flex-wrap items-end gap-2 p-3 rounded-lg bg-[#1C1917] border border-[#44403C]">
                    <div className="space-y-1.5 flex-1 min-w-[200px]">
                      <Label htmlFor={`reset-${u.usuario_id}`} className="text-xs text-stone-300">
                        Nova senha provisória
                      </Label>
                      <Input
                        id={`reset-${u.usuario_id}`}
                        type="password"
                        autoComplete="new-password"
                        value={resetSenha}
                        onChange={(e) => setResetSenha(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className="bg-[#292524] border-[#44403C] text-stone-100 text-sm"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setResetId(null)
                        setResetSenha('')
                      }}
                      disabled={resetSaving}
                      className="text-stone-400"
                    >
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => redefinirSenha(u.usuario_id)}
                      disabled={resetSaving}
                      className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold"
                    >
                      {resetSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar senha'}
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Criar usuário */}
        {!mostrarForm ? (
          <Button
            variant="outline"
            onClick={() => setMostrarForm(true)}
            className="bg-[#1C1917] border-[#44403C] text-stone-200 hover:bg-[#44403C]"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Novo usuário
          </Button>
        ) : (
          <div className="space-y-3 p-4 rounded-lg border border-[#44403C] bg-[#1C1917]">
            <h3 className="text-sm font-bold text-stone-200">Novo usuário</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="novo-usuario-nome" className="text-xs text-stone-300">
                  Nome *
                </Label>
                <Input
                  id="novo-usuario-nome"
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  autoComplete="off"
                  className="bg-[#292524] border-[#44403C] text-stone-100 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="novo-usuario-email" className="text-xs text-stone-300">
                  E-mail *
                </Label>
                <Input
                  id="novo-usuario-email"
                  type="email"
                  value={novoEmail}
                  onChange={(e) => setNovoEmail(e.target.value)}
                  autoComplete="off"
                  className="bg-[#292524] border-[#44403C] text-stone-100 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="novo-usuario-senha" className="text-xs text-stone-300">
                  Senha provisória *
                </Label>
                <Input
                  id="novo-usuario-senha"
                  type="password"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Mínimo 6 caracteres"
                  className="bg-[#292524] border-[#44403C] text-stone-100 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="novo-usuario-perfil" className="text-xs text-stone-300">
                  Perfil *
                </Label>
                <select
                  id="novo-usuario-perfil"
                  value={novoPerfil}
                  onChange={(e) => setNovoPerfil(e.target.value as PerfilGestao)}
                  className={SELECT_CLASS}
                >
                  {PERFIS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setMostrarForm(false)}
                disabled={saving}
                className="text-stone-400"
              >
                Cancelar
              </Button>
              <Button
                onClick={criarUsuario}
                disabled={saving}
                className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar usuário'}
              </Button>
            </div>
          </div>
        )}

        {/* Confirmação de exclusão de usuário */}
        <Dialog
          open={!!excluirAlvo}
          onOpenChange={(open) => {
            if (!open) setExcluirAlvo(null)
          }}
        >
          <DialogContent className="bg-[#292524] border-[#44403C] text-stone-100 max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-400" />
                Excluir usuário
              </DialogTitle>
              <DialogDescription className="text-stone-400 text-sm">
                Remover <span className="text-stone-100 font-semibold">
                  {excluirAlvo?.email}
                </span>{' '}
                deste estabelecimento? O perfil e a conta de login serão excluídos definitivamente e
                o usuário deixará de acessar o sistema.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setExcluirAlvo(null)}
                disabled={excluirSaving}
                className="bg-[#1C1917] border-[#44403C] text-stone-200 hover:bg-[#44403C]"
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={confirmarExcluir}
                disabled={excluirSaving}
                className="bg-red-600 hover:bg-red-700 text-white font-bold"
              >
                {excluirSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-1.5" />
                    Excluir definitivamente
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  )
}
