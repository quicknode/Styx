import gsap from 'gsap'
import { at, h, layer, s, txt, prepDraw, G } from '../dom'
import type { BridgeMsg, Withdrawal } from '../api'

/** Bridge panel on the Live tab: two big numbers and particles crossing between the rails. */
export class BridgePanel {
  root: HTMLElement
  inEl: HTMLElement; outEl: HTMLElement
  shown = { in: 0, out: 0 }
  field: HTMLElement
  X = G.x(1); Y = 440; W = G.w(12); H = 96
  constructor(stage: HTMLElement) {
    this.root = at(h('div', { class: 'panel' }, [h('span', { class: 'panel-title' }, 'Bridge · last hour')]), this.X, this.Y, this.W, this.H)
    stage.append(this.root)
    const svg = layer(this.W, this.H); this.root.append(svg)
    const top = s('path', { class: 'ln ely', d: `M 32 30 H 700` }); const bot = s('path', { class: 'ln hl', d: `M 32 ${this.H - 22} H 700` })
    svg.append(top, bot, txt(32, 22, 'Elysium', 'ely'), txt(32, this.H - 28, 'HyperEVM', 'hl'))
    for (const p of [top, bot]) { prepDraw(p); gsap.to(p, { strokeDashoffset: 0, duration: 1, ease: 'power2.out', delay: .6 }) }
    this.field = at(h('div', { style: 'position:absolute;left:0;top:0;width:720px;height:100%;overflow:hidden' }), 0, 0); this.root.append(this.field)
    const mk = (label: string, cls: string, x: number) => {
      const v = h('div', { class: 'num ' + cls }, '0'); at(v, x, 22)
      const l = h('div', { class: 'lbl' }, label); at(l, x, 62)
      this.root.append(v, l); return v
    }
    this.inEl = mk('deposits into Elysium', 'hl', 800)
    this.outEl = mk('withdrawals to HyperEVM', 'ely', 1200)
  }
  setCounts(c: { hype: number; retryable: number; other: number; withdrawals: number }) {
    const inN = c.hype + c.retryable + c.other
    for (const [k, el, to] of [['in', this.inEl, inN], ['out', this.outEl, c.withdrawals]] as const) {
      const from = this.shown[k]; if (from === to) continue
      const o = { v: from }
      gsap.to(o, { v: to, duration: .9, ease: 'power2.out', onUpdate: () => { el.textContent = Math.round(o.v).toLocaleString('en-US') } })
      this.shown[k] = to
    }
  }
  private fly(cls: string, fromY: number, toY: number, target: HTMLElement) {
    const coin = h('div', { class: 'coin ' + cls }); const x = 60 + Math.random() * 620
    at(coin, x, fromY); this.field.append(coin)
    const drift = (Math.random() - .5) * 60
    gsap.timeline({ onComplete: () => coin.remove() })
      .fromTo(coin, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: .25, ease: 'back.out(2)' })
      .to(coin, { y: toY - fromY, x: drift, duration: 1.3, ease: 'power1.inOut' }, 0)
      .to(coin, { scale: 0, opacity: 0, duration: .25 })
    gsap.fromTo(target, { scale: 1.1 }, { scale: 1, duration: .5, ease: 'back.out(2)' })
  }
  deposit(m: BridgeMsg) { this.fly(m.kind === 12 ? '' : 'rt', this.H - 22, 30, this.inEl) }
  withdrawal(_w: Withdrawal) { this.fly('out', 30, this.H - 22, this.outEl) }
}
