import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { EstabelecimentoService } from '@/services/estabelecimentoService'
import { EstabelecimentoComContagens } from '@/types/tenant'
import { AdminUsuariosEstabelecimento } from '@/components/AdminUsuariosEstabelecimento'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Building2,
  Plus,
  Pencil,
  Power,
  ShieldCheck,
  MapPin,
  Hash,
  Layers,
  Loader2,
  RefreshCw,
  Users,
} from 'lucide-react'

interface FormState {
  nome: string
  cnpj: string
  endereco: string
  quantidade_mesas: number
}

const EMPTY_FORM: FormState = {
  nome: '',
  cnpj: '',
  endereco: '',
  quantidade_mesas: 10,
}

export default function Administracao() {
  const { profile, refreshProfile } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [estabelecimentos, setEstabelecimentos] = useState<EstabelecimentoComContagens[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTarget, setEditingTarget] = useState<EstabelecimentoComContagens | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<EstabelecimentoComContagens | null>(null)
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  // Gerente inicial (opcional, só no cadastro de novo estabelecimento)
  const [gerenteNome, setGerenteNome] = useState('')
  const [gerenteEmail, setGerenteEmail] = useState('')
  const [gerenteSenha, setGerenteSenha] = useState('')
  // Estabelecimento cujos usuários estão sendo gerenciados
  const [gerenciarTarget, setGerenciarTarget] = useState<EstabelecimentoComContagens | null>(null)

  // A página só é útil com o papel de admin da PLATAFORMA; qualquer outra role
  // é mandada de volta para o app operacional.
  const isAdmin = profile?.perfil === 'admin'

  useEffect(() => {
    if (!isAdmin) {
      navigate('/', { replace: true })
      return
    }
    loadEstabelecimentos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  const loadEstabelecimentos = async (showFeedback = false) => {
    if (showFeedback) setRefreshing(true)
    try {
      const data = await EstabelecimentoService.adminListar()
      setEstabelecimentos(data)
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao carregar',
        description: err?.message || 'Não foi possível listar os estabelecimentos.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const openCreateDialog = () => {
    setEditingTarget(null)
    setForm(EMPTY_FORM)
    setGerenteNome('')
    setGerenteEmail('')
    setGerenteSenha('')
    setFormErrors({})
    setDialogOpen(true)
  }

  const openEditDialog = (e: EstabelecimentoComContagens) => {
    setEditingTarget(e)
    setForm({
      nome: e.nome || '',
      cnpj: e.cnpj || '',
      endereco: e.endereco || '',
      quantidade_mesas: e.qtd_mesas ?? 0,
    })
    setFormErrors({})
    setDialogOpen(true)
  }

  const validate = (): boolean => {
    const errs: Partial<Record<keyof FormState, string>> = {}
    if (!form.nome.trim()) errs.nome = 'Informe o nome do estabelecimento.'
    if (!form.cnpj.trim()) errs.cnpj = 'Informe o CNPJ.'
    else if (form.cnpj.replace(/\D/g, '').length !== 14) errs.cnpj = 'CNPJ deve ter 14 dígitos.'
    if (!form.endereco.trim()) errs.endereco = 'Informe o endereço.'
    if (form.quantidade_mesas < 1) errs.quantidade_mesas = 'Ao menos 1 mesa.'
    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    const criarGerente =
      !editingTarget &&
      (gerenteNome.trim() !== '' || gerenteEmail.trim() !== '' || gerenteSenha !== '')
    if (criarGerente) {
      if (!gerenteNome.trim() || !gerenteEmail.trim().includes('@') || gerenteSenha.length < 6) {
        toast({
          title: 'Dados do Gerente inicial incompletos',
          description:
            'Informe nome, e-mail válido e senha provisória de no mínimo 6 caracteres — ou deixe os três campos vazios.',
          variant: 'destructive',
        })
        return
      }
    }
    setSaving(true)
    try {
      if (editingTarget) {
        await EstabelecimentoService.adminEditar(editingTarget.id, {
          nome: form.nome.trim(),
          cnpj: form.cnpj.trim(),
          endereco: form.endereco.trim(),
          quantidade_mesas: Number(form.quantidade_mesas),
        })
        toast({
          title: 'Estabelecimento atualizado',
          description: `${form.nome} foi atualizado com sucesso.`,
        })
      } else {
        const novo = await EstabelecimentoService.adminCriar({
          nome: form.nome.trim(),
          cnpj: form.cnpj.trim(),
          endereco: form.endereco.trim(),
          quantidade_mesas: Number(form.quantidade_mesas),
        })
        if (criarGerente) {
          try {
            await EstabelecimentoService.adminCriarUsuario({
              estabelecimentoId: novo.id,
              nome: gerenteNome.trim(),
              email: gerenteEmail.trim(),
              senha: gerenteSenha,
              perfil: 'gerente',
            })
          } catch (err: any) {
            toast({
              title: 'Estabelecimento cadastrado, mas o Gerente não foi criado',
              description: `${err?.message || 'Erro desconhecido.'} Use "Gerenciar usuários" na linha do estabelecimento.`,
              variant: 'destructive',
            })
            setDialogOpen(false)
            await loadEstabelecimentos()
            return
          }
        }
        toast({
          title: 'Estabelecimento cadastrado',
          description: criarGerente
            ? `${form.nome} nasceu ativo com o Gerente ${gerenteNome.trim()} já criado.`
            : `${form.nome} nasceu ativo e já aparece no seletor do login.`,
        })
      }
      setDialogOpen(false)
      await loadEstabelecimentos()
    } catch (err: any) {
      toast({
        title: editingTarget ? 'Erro ao editar' : 'Erro ao cadastrar',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleToggleAtivo = async () => {
    if (!confirmTarget) return
    setToggling(confirmTarget.id)
    try {
      await EstabelecimentoService.adminAtivarDesativar(confirmTarget.id, !confirmTarget.ativo)
      toast({
        title: confirmTarget.ativo ? 'Estabelecimento desativado' : 'Estabelecimento ativado',
        description: confirmTarget.ativo
          ? `${confirmTarget.nome} não aparece mais no seletor do login.`
          : `${confirmTarget.nome} voltou a aparecer no seletor do login.`,
      })
      setConfirmTarget(null)
      await loadEstabelecimentos()
    } catch (err: any) {
      toast({
        title: 'Erro ao alterar status',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setToggling(null)
    }
  }

  const ativos = estabelecimentos.filter((e) => e.ativo).length

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      {/* Cabeçalho da página */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-amber-500" />
            <h1 className="text-2xl font-black text-stone-100">Administração da Plataforma</h1>
          </div>
          <p className="text-sm text-stone-400 mt-1">
            Gerencie todos os estabelecimentos da plataforma Bares e Restaurantes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadEstabelecimentos(true)}
            disabled={refreshing}
            className="bg-[#292524] border-[#44403C] text-stone-300 hover:bg-[#44403C]"
            aria-label="Recarregar lista de estabelecimentos"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline ml-1.5">Recarregar</span>
          </Button>
          <Button
            size="sm"
            onClick={openCreateDialog}
            className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Novo Estabelecimento
          </Button>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl bg-[#292524] border border-[#44403C]">
          <div className="text-2xl font-black text-amber-400">{estabelecimentos.length}</div>
          <div className="text-xs text-stone-400 mt-0.5">Estabelecimentos</div>
        </div>
        <div className="p-4 rounded-xl bg-[#292524] border border-[#44403C]">
          <div className="text-2xl font-black text-emerald-400">{ativos}</div>
          <div className="text-xs text-stone-400 mt-0.5">Ativos</div>
        </div>
        <div className="p-4 rounded-xl bg-[#292524] border border-[#44403C]">
          <div className="text-2xl font-black text-red-400">{estabelecimentos.length - ativos}</div>
          <div className="text-xs text-stone-400 mt-0.5">Desativados</div>
        </div>
      </div>

      {/* Lista */}
      <div className="rounded-xl border border-[#44403C] bg-[#292524] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#44403C]/70">
          <h2 className="text-sm font-bold text-stone-200 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-amber-500" />
            Todos os Estabelecimentos
          </h2>
        </div>

        {loading ? (
          <div className="p-4 space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full bg-[#1C1917]" />
            ))}
          </div>
        ) : estabelecimentos.length === 0 ? (
          <div className="p-10 text-center">
            <Building2 className="w-10 h-10 mx-auto text-stone-600 mb-3" />
            <p className="text-sm font-semibold text-stone-300">Nenhum estabelecimento ainda</p>
            <p className="text-xs text-stone-500 mt-1">
              Cadastre o primeiro usando o botão "Novo Estabelecimento".
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-[#44403C] hover:bg-transparent">
                <TableHead className="text-stone-400 text-xs">Estabelecimento</TableHead>
                <TableHead className="text-stone-400 text-xs hidden md:table-cell">
                  Endereço
                </TableHead>
                <TableHead className="text-stone-400 text-xs hidden sm:table-cell">CNPJ</TableHead>
                <TableHead className="text-stone-400 text-xs hidden lg:table-cell">Mesas</TableHead>
                <TableHead className="text-stone-400 text-xs">Status</TableHead>
                <TableHead className="text-stone-400 text-xs text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {estabelecimentos.map((e) => (
                <TableRow key={e.id} className="border-[#44403C] hover:bg-[#1C1917]/60">
                  <TableCell className="py-3">
                    <div className="font-semibold text-stone-100 text-sm">{e.nome}</div>
                    {e.criado_em && (
                      <div className="text-[10px] text-stone-500 mt-0.5">
                        Desde {new Date(e.criado_em).toLocaleDateString('pt-BR')}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex items-start gap-1.5 text-xs text-stone-300 max-w-[240px]">
                      <MapPin className="w-3.5 h-3.5 text-stone-500 flex-shrink-0 mt-0.5" />
                      <span className="truncate">{e.endereco || '—'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <span className="font-mono text-xs text-stone-300">{e.cnpj || '—'}</span>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex items-center gap-1.5 text-xs text-stone-300">
                      <Layers className="w-3.5 h-3.5 text-stone-500" />
                      {e.qtd_mesas ?? '—'}
                      {typeof e.qtd_usuarios === 'number' && (
                        <span className="text-stone-500">• {e.qtd_usuarios} usuários</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        e.ativo
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : 'bg-red-500/15 text-red-400 border-red-500/30'
                      }
                      variant="outline"
                    >
                      {e.ativo ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setGerenciarTarget(e)}
                        title="Gerenciar usuários deste estabelecimento"
                        aria-label={`Gerenciar usuários de ${e.nome}`}
                        className="text-stone-300 hover:text-amber-400 hover:bg-amber-500/10 h-8 px-2 text-xs"
                      >
                        <Users className="w-4 h-4" />
                        <span className="hidden md:inline ml-1.5">Gerenciar usuários</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(e)}
                        title="Editar estabelecimento"
                        aria-label={`Editar ${e.nome}`}
                        className="text-stone-400 hover:text-amber-400 hover:bg-amber-500/10 h-8 w-8 p-0"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmTarget(e)}
                        disabled={toggling === e.id}
                        title={e.ativo ? 'Desativar' : 'Ativar'}
                        aria-label={e.ativo ? `Desativar ${e.nome}` : `Ativar ${e.nome}`}
                        className={
                          e.ativo
                            ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 w-8 p-0'
                            : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 h-8 w-8 p-0'
                        }
                      >
                        {toggling === e.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Power className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Dialog criar/editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-[#292524] border-[#44403C] text-stone-100 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Building2 className="w-5 h-5 text-amber-500" />
              {editingTarget ? 'Editar Estabelecimento' : 'Novo Estabelecimento'}
            </DialogTitle>
            <DialogDescription className="text-stone-400 text-xs">
              {editingTarget
                ? 'Atualize os dados cadastrais do estabelecimento.'
                : 'O novo estabelecimento nasce ativo e já aparece no seletor do login.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="est-nome" className="text-xs text-stone-300 font-semibold">
                Nome do estabelecimento *
              </Label>
              <Input
                id="est-nome"
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="ex: Bar do Zé"
                autoComplete="off"
                className="bg-[#1C1917] border-[#44403C] text-stone-100 text-sm"
              />
              {formErrors.nome && <p className="text-[11px] text-red-400">{formErrors.nome}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="est-cnpj" className="text-xs text-stone-300 font-semibold">
                CNPJ *
              </Label>
              <div className="relative">
                <Hash className="w-4 h-4 absolute left-3 top-2.5 text-stone-500" />
                <Input
                  id="est-cnpj"
                  value={form.cnpj}
                  onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))}
                  placeholder="00.000.000/0000-00"
                  autoComplete="off"
                  inputMode="numeric"
                  className="pl-9 bg-[#1C1917] border-[#44403C] text-stone-100 text-sm font-mono"
                />
              </div>
              {formErrors.cnpj && <p className="text-[11px] text-red-400">{formErrors.cnpj}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="est-endereco" className="text-xs text-stone-300 font-semibold">
                Endereço completo *
              </Label>
              <Textarea
                id="est-endereco"
                value={form.endereco}
                onChange={(e) => setForm((f) => ({ ...f, endereco: e.target.value }))}
                placeholder="Rua, número, bairro, cidade - UF"
                autoComplete="off"
                rows={2}
                className="bg-[#1C1917] border-[#44403C] text-stone-100 text-sm resize-none"
              />
              {formErrors.endereco && (
                <p className="text-[11px] text-red-400">{formErrors.endereco}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="est-mesas" className="text-xs text-stone-300 font-semibold">
                Quantidade de mesas *
              </Label>
              <Input
                id="est-mesas"
                type="number"
                min={1}
                value={form.quantidade_mesas}
                onChange={(e) =>
                  setForm((f) => ({ ...f, quantidade_mesas: Number(e.target.value) }))
                }
                autoComplete="off"
                inputMode="numeric"
                className="bg-[#1C1917] border-[#44403C] text-stone-100 text-sm w-32"
              />
              {formErrors.quantidade_mesas && (
                <p className="text-[11px] text-red-400">{formErrors.quantidade_mesas}</p>
              )}
            </div>

            {!editingTarget && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <Switch checked disabled className="opacity-60" aria-label="Criar ativo" />
                <span className="text-xs text-amber-300">
                  O estabelecimento será criado como <strong>ativo</strong>.
                </span>
              </div>
            )}

            {!editingTarget && (
              <fieldset className="space-y-3 p-3 rounded-lg border border-[#44403C]">
                <legend className="px-1 text-xs font-semibold text-stone-300">
                  Gerente inicial (opcional)
                </legend>
                <p className="text-[11px] text-stone-400">
                  Sem ele, ninguém consegue entrar no estabelecimento novo. Preencha os três campos
                  ou deixe-os vazios.
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="ger-nome" className="text-xs text-stone-300 font-semibold">
                    Nome do Gerente
                  </Label>
                  <Input
                    id="ger-nome"
                    value={gerenteNome}
                    onChange={(e) => setGerenteNome(e.target.value)}
                    autoComplete="off"
                    className="bg-[#1C1917] border-[#44403C] text-stone-100 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ger-email" className="text-xs text-stone-300 font-semibold">
                    E-mail do Gerente
                  </Label>
                  <Input
                    id="ger-email"
                    type="email"
                    value={gerenteEmail}
                    onChange={(e) => setGerenteEmail(e.target.value)}
                    autoComplete="off"
                    className="bg-[#1C1917] border-[#44403C] text-stone-100 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ger-senha" className="text-xs text-stone-300 font-semibold">
                    Senha provisória
                  </Label>
                  <Input
                    id="ger-senha"
                    type="password"
                    value={gerenteSenha}
                    onChange={(e) => setGerenteSenha(e.target.value)}
                    autoComplete="new-password"
                    placeholder="Mínimo 6 caracteres"
                    className="bg-[#1C1917] border-[#44403C] text-stone-100 text-sm"
                  />
                </div>
              </fieldset>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
              className="text-stone-400"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saving}
              className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                  Salvando...
                </>
              ) : editingTarget ? (
                'Salvar alterações'
              ) : (
                'Cadastrar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de ativar/desativar */}
      <AlertDialog open={!!confirmTarget} onOpenChange={(open) => !open && setConfirmTarget(null)}>
        <AlertDialogContent className="bg-[#292524] border-[#44403C] text-stone-100">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmTarget?.ativo ? 'Desativar' : 'Ativar'} {confirmTarget?.nome}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-stone-400">
              {confirmTarget?.ativo
                ? 'Estabelecimentos desativados deixam de aparecer no seletor de login, e seus usuários não conseguem mais entrar. O histórico é preservado.'
                : 'O estabelecimento voltará a aparecer no seletor de login.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-[#1C1917] border-[#44403C] text-stone-300">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleToggleAtivo}
              className={
                confirmTarget?.ativo
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }
            >
              {toggling ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Gerenciar usuários de um estabelecimento */}
      <AdminUsuariosEstabelecimento
        estabelecimento={gerenciarTarget}
        onOpenChange={(open) => !open && setGerenciarTarget(null)}
        onChanged={() => loadEstabelecimentos()}
      />
    </div>
  )
}
