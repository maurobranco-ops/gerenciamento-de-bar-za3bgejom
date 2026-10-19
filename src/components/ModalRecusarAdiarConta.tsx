import React, { useState } from 'react'
import { AlertTriangle, XCircle, Loader2, Undo2, Clock, Coffee, Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Comanda } from '@/types/bar'

interface ModalRecusarAdiarContaProps {
  comanda: Comanda | null
  open: boolean
  onClose: () => void
  onConfirm: (mesaNumero: number, motivo: string) => Promise<boolean>
}

const MOTIVOS_RAPIDOS = [
  'Ainda vão pedir sobremesa / café',
  'Mesa com novos pedidos sendo preparados na cozinha',
  'Cliente solicitou mais uma rodada de bebidas',
  'Conferência de itens solicitada pelo cliente',
  'Pedido de conta realizado por engano',
]

export const ModalRecusarAdiarConta: React.FC<ModalRecusarAdiarContaProps> = ({
  comanda,
  open,
  onClose,
  onConfirm,
}) => {
  const [motivo, setMotivo] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!comanda) return null

  const handleConfirm = async () => {
    const motivoFinal = motivo.trim() || 'Mesa em atendimento / novos pedidos em andamento'
    setSubmitting(true)
    try {
      const ok = await onConfirm(comanda.tableNumber, motivoFinal)
      if (ok) {
        setMotivo('')
        onClose()
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md bg-[#292524] border-[#44403C] text-stone-100 p-5 sm:p-6">
        <DialogHeader>
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-2 border border-amber-500/40">
            <Undo2 className="w-6 h-6" />
          </div>
          <DialogTitle className="text-center text-lg font-black text-stone-100">
            Adiar / Recusar Fechamento
          </DialogTitle>
          <DialogDescription className="text-center text-xs text-stone-300">
            A Mesa {comanda.tableNumber} voltará ao status <strong>Ocupada</strong> e o cliente verá
            a mensagem no celular dele.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Motivos Rápidos */}
          <div>
            <Label className="text-xs text-stone-400 mb-1.5 block">
              Sugestões rápidas de motivo:
            </Label>
            <div className="flex flex-col gap-1.5">
              {MOTIVOS_RAPIDOS.map((sugestao) => (
                <button
                  key={sugestao}
                  type="button"
                  onClick={() => setMotivo(sugestao)}
                  className={`text-left text-xs p-2 rounded-lg border transition-all ${
                    motivo === sugestao
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-semibold'
                      : 'bg-[#1C1917] border-[#44403C] text-stone-300 hover:border-stone-500'
                  }`}
                >
                  {sugestao}
                </button>
              ))}
            </div>
          </div>

          {/* Campo de texto livre */}
          <div>
            <Label className="text-xs text-stone-300 font-semibold">
              Ou digite o motivo específico:
            </Label>
            <Input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: Ainda vão pedir sobremesa..."
              className="mt-1 bg-[#1C1917] border-[#44403C] text-stone-100 text-xs"
            />
          </div>

          {/* Botões de Ação */}
          <div className="flex gap-2 pt-2 border-t border-[#44403C]">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 text-stone-400 text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={submitting}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-xs h-9 flex items-center justify-center gap-1.5 shadow-md shadow-amber-950/40"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>Confirmar e Devolver Mesa</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
