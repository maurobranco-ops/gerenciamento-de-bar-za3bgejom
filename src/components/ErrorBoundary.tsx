import { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
  errorInfo: ErrorInfo | null
}

/**
 * Error Boundary GLOBAL da aplicação.
 *
 * Envolto em torno de toda a árvore de rotas (inclusive Layout e páginas
 * protegidas), captura qualquer erro de renderização de um componente e
 * exibe uma tela legível — em português — com a mensagem real do erro e o
 * stack, em vez da tela escura/vazia sem diagnóstico.
 *
 * Observação: Error Boundaries NÃO capturam erros em handlers de eventos,
 * callbacks assíncronos (setTimeout/promessas) nem no próprio render do
 * boundary — apenas erros lançados durante a renderização da subárvore.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log completo no console — é o ponto onde a árvore morreu.
    console.error('[ErrorBoundary] Erro de renderização capturado:', error)
    console.error('[ErrorBoundary] Stack do componente:', errorInfo.componentStack)
    this.setState({ errorInfo })
  }

  handleReload = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    this.setState({ error: null, errorInfo: null })
    window.location.assign('/')
  }

  render() {
    const { error, errorInfo } = this.state
    if (!error) return this.props.children

    return (
      <div
        role="alert"
        className="min-h-dvh bg-[#1C1917] text-stone-100 flex items-center justify-center p-4"
      >
        <div className="w-full max-w-2xl space-y-6">
          <div className="flex items-start gap-4">
            <div className="mt-1 w-12 h-12 shrink-0 rounded-xl bg-red-950/60 border border-red-900/60 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-400" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-black tracking-tight text-stone-50">
                Ocorreu um erro ao carregar esta tela
              </h1>
              <p className="text-sm text-stone-400">
                A tela não pôde ser renderizada. Os detalhes técnicos abaixo (mensagem e stack)
                ajudam a identificar a causa. Você pode tentar recarregar a página.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-4 space-y-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-red-400 mb-1">
                Mensagem do erro
              </p>
              <pre className="text-sm text-red-200 whitespace-pre-wrap break-words font-mono">
                {error.message || String(error)}
              </pre>
            </div>

            {error.stack && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-red-400 mb-1">
                  Stack do erro
                </p>
                <pre className="text-xs text-stone-300 whitespace-pre-wrap break-words font-mono max-h-64 overflow-y-auto">
                  {error.stack}
                </pre>
              </div>
            )}

            {errorInfo?.componentStack && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-red-400 mb-1">
                  Árvore de componentes
                </p>
                <pre className="text-xs text-stone-400 whitespace-pre-wrap break-words font-mono max-h-64 overflow-y-auto">
                  {errorInfo.componentStack}
                </pre>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={this.handleReload}
              className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold"
            >
              <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
              Recarregar
            </Button>
            <Button
              variant="outline"
              onClick={this.handleGoHome}
              className="border-[#44403C] text-stone-200 hover:bg-[#292524]"
            >
              <Home className="w-4 h-4 mr-2" aria-hidden="true" />
              Voltar ao início
            </Button>
          </div>
        </div>
      </div>
    )
  }
}

export default ErrorBoundary
