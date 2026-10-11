/**
 * Utilitário de Sons via Web Audio API do navegador.
 * Gera alertas sintéticos (sem necessidade de arquivos de áudio .mp3 externos)
 * com osciladores puros e envelope de ganho suave.
 */

class SoundEffectsService {
  private audioCtx: AudioContext | null = null

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass()
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {})
    }
    return this.audioCtx
  }

  /**
   * Bip duplo agradável e claro quando entra um novo pedido (especialmente on-line)
   */
  playOrderAlert() {
    try {
      const ctx = this.getAudioContext()
      if (!ctx) return

      const now = ctx.currentTime

      // Tom 1 (587.33 Hz - D5)
      const osc1 = ctx.createOscillator()
      const gain1 = ctx.createGain()
      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(587.33, now)

      gain1.gain.setValueAtTime(0, now)
      gain1.gain.linearRampToValueAtTime(0.25, now + 0.03)
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18)

      osc1.connect(gain1)
      gain1.connect(ctx.destination)

      osc1.start(now)
      osc1.stop(now + 0.2)

      // Tom 2 (880.00 Hz - A5 - mais agudo confirmando)
      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.type = 'sine'
      osc2.frequency.setValueAtTime(880.0, now + 0.18)

      gain2.gain.setValueAtTime(0, now + 0.18)
      gain2.gain.linearRampToValueAtTime(0.3, now + 0.21)
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45)

      osc2.connect(gain2)
      gain2.connect(ctx.destination)

      osc2.start(now + 0.18)
      osc2.stop(now + 0.48)
    } catch (e) {
      console.warn('Erro ao reproduzir alerta sonoro Web Audio:', e)
    }
  }

  /**
   * Bip de sucesso (conclusão de status ou pagamento)
   */
  playSuccessAlert() {
    try {
      const ctx = this.getAudioContext()
      if (!ctx) return
      const now = ctx.currentTime

      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(523.25, now) // C5
      osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.25) // C6

      gain.gain.setValueAtTime(0.2, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now)
      osc.stop(now + 0.3)
    } catch (e) {
      console.warn('Erro ao reproduzir áudio de sucesso:', e)
    }
  }
}

export const SoundEffects = new SoundEffectsService()
