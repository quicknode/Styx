import gsap from 'gsap'
import { at, h, layer, s, txt, prepDraw, G } from '../dom'
import type { BridgeMsg, Withdrawal } from '../api'

/** Bridge flow panel: deposits climb from HyperEVM to Elysium, withdrawals drop back. */
export class BridgePanel {
  root: HTMLElement
  counts: Record<'hype' | 'retryable' | 'other' | 'withdrawals', HTMLElement>
  shown: Record<string, number> = { hype: 0, retryable: 0, other: 0, withdrawals: 0 }
  field: HTMLElement
  X = G.x(1); Y = 500; W = G.w(6); H = 140
  constructor(stage: HTMLElement) {
    this.root = at(h('div', { class: 'panel' }, [h('span', { class: 'panel-title' }, 'Bridge · HyperEVM ↔ Elysium · last hour')]), this.X, this.Y, this.W, this.H)
    stage.append(this.root)
    const svg = layer(this.W, this.H); this.root.append(svg)
    // two rails: HyperEVM at bottom, Elysium at top; particles travel between them
    const top = s('path', { class: 'ln ely', d: `M 24 30 H 300` }); const bot = s('path', { class: 'ln hl', d: `M 24 ${this.H - 30} H 300` })
    svg.append(top, bot, txt(24, 22, 'Elysium', 'ely'), txt(24, this.H - 36, 'HyperEVM', 'hl'))
    for (const p of [top, bot]) { prepDraw(p); gsap.to(p, { strokeDashoffset: 0, duration: 1, ease: 'power2.out', delay: .6 }) }
    this.field = at(h('div', { style: 'position:absolute;left:0;top:0;width:320px;height:100%;overflow:hidden' }), 0, 0)
    this.root.append(this.field)
    const mk = (label: string, cls: string, x: number, y: number) => {
      const v = h('div', { class: 'num ' + cls, html: '0' }); at(v, x, y)
      const l = h('div', { class: 'lbl' }, label); at(l, x, y + 38)
      this.root.append(v, l); return v
    }
    this.counts = {
      hype: mk('HYPE in', 'hl', 340, 26),
      retryable: mk('tokens in', '', 500, 26),
      other: mk('messages in', '', 660, 26),
      withdrawals: mk('withdrawals out', 'ely', 340, 86),
    }
    this.root.append(at(h('div', { class: 'lbl', style: 'color:var(--ink-50);white-space:normal;line-height:1.5;width:360px' }, 'Deposits arrive as retryable tickets. Withdrawals execute after the challenge window.'), 500, 90))
  }
  setCounts(c: { hype: number; retryable: number; other: number; withdrawals: number }) {
    for (const k of Object.keys(c) as (keyof typeof c)[]) {
      const el = this.counts[k]; const from = this.shown[k]; const to = c[k]
      if (from === to) continue
      const o = { v: from }
      gsap.to(o, { v: to, duration: .8, ease: 'power2.out', onUpdate: () => { el.textContent = Math.round(o.v).toLocaleString() } })
      this.shown[k] = to
    }
  }
  deposit(m: BridgeMsg) {
    const coin = h('div', { class: 'coin' + (m.kind === 12 ? '' : ' rt') })
    const x = 40 + Math.random() * 240
    at(coin, x, this.H - 30)
    this.field.append(coin)
    gsap.timeline({ onComplete: () => coin.remove() })
      .fromTo(coin, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: .25, ease: 'back.out(2)' })
      .to(coin, { top: 30, duration: 1.4, ease: 'power1.inOut' })
      .to(coin, { scale: 0, opacity: 0, duration: .3 })
    gsap.fromTo(this.counts[m.kind === 12 ? 'hype' : m.kind === 9 ? 'retryable' : 'other'], { scale: 1.12 }, { scale: 1, duration: .5, ease: 'back.out(2)' })
  }
  withdrawal(_w: Withdrawal) {
    const coin = h('div', { class: 'coin out' })
    const x = 40 + Math.random() * 240
    at(coin, x, 30)
    this.field.append(coin)
    gsap.timeline({ onComplete: () => coin.remove() })
      .fromTo(coin, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: .25, ease: 'back.out(2)' })
      .to(coin, { top: this.H - 30, duration: 1.4, ease: 'power1.inOut' })
      .to(coin, { scale: 0, opacity: 0, duration: .3 })
    gsap.fromTo(this.counts.withdrawals, { scale: 1.12 }, { scale: 1, duration: .5, ease: 'back.out(2)' })
  }
}
