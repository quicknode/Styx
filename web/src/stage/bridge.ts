import gsap from 'gsap'
import { at, h, layer, s, txt, prepDraw, G } from '../dom'
import type { BridgeMsg, Withdrawal } from '../api'
import { view, flowWidth } from '../view'

/** Bridge panel on the Live tab: two big numbers and particles crossing between the rails. */
export class BridgePanel {
  root: HTMLElement
  inEl: HTMLElement; outEl: HTMLElement; outSub: HTMLElement; inLbl: HTMLElement; outLbl: HTMLElement
  shown = { in: 0, out: 0 }
  field: HTMLElement
  svg: SVGSVGElement; top: SVGPathElement; bot: SVGPathElement; tTop: SVGTextElement; tBot: SVGTextElement
  // geometry, set by layout(): the grid on wide screens, the column width in flow
  W = G.w(12); H = 120; railTop = 34; railBot = 90; fieldW = 720
  constructor(stage: HTMLElement) {
    this.root = at(h('div', { class: 'panel' }, [h('span', { class: 'panel-title' }, 'Bridge · last hour')]), G.x(1), 516, G.w(12), 120)
    stage.append(this.root)
    this.svg = layer(this.W, this.H); this.root.append(this.svg)
    this.top = s('path', { class: 'ln ely' }); this.bot = s('path', { class: 'ln hl' })
    this.tTop = txt(32, 26, 'Elysium', 'ely'); this.tBot = txt(32, 84, 'HyperEVM', 'hl')
    this.svg.append(this.top, this.bot, this.tTop, this.tBot)
    this.field = h('div', { style: 'position:absolute;left:0;top:0;overflow:hidden' }); this.root.append(this.field)
    const mk = (label: string, cls: string) => { const v = h('div', { class: 'num ' + cls }, '0'); const l = h('div', { class: 'lbl' }, label); this.root.append(v, l); return { v, l } }
    const a = mk('deposits into Elysium', 'hl'); this.inEl = a.v; this.inLbl = a.l
    const b = mk('withdrawals to HyperEVM', 'ely'); this.outEl = b.v; this.outLbl = b.l
    this.outSub = h('div', { class: 'lbl', style: 'color:var(--ink-30)' }, ''); this.root.append(this.outSub)
    this.layout()
    for (const p of [this.top, this.bot]) { prepDraw(p); gsap.to(p, { strokeDashoffset: 0, duration: 1, ease: 'power2.out', delay: .6 }) }
  }
  /** Wide: rails on the left 720 px, numbers to their right. Flow: rails across the top, numbers below them. */
  layout() {
    let railR: number; let fieldH: number
    let inP: [number, number, number]; let outP: [number, number, number, number]   // x, num y, label y (, sub y)
    if (view.flow) {
      this.W = flowWidth(); this.H = 290; this.railTop = 34; this.railBot = 96; this.fieldW = this.W; fieldH = 120; railR = this.W - 32
      inP = [24, 134, 176]; outP = [24, 206, 248, 268]
      this.root.style.setProperty('--fh', this.H + 'px')
    } else {
      this.W = G.w(12); this.H = 120; this.railTop = 34; this.railBot = 90; this.fieldW = 720; fieldH = this.H; railR = 700
      inP = [800, 24, 66]; outP = [1200, 24, 66, 88]
    }
    this.svg.setAttribute('viewBox', `0 0 ${this.W} ${this.H}`)
    this.top.setAttribute('d', `M 32 ${this.railTop} H ${railR}`); this.bot.setAttribute('d', `M 32 ${this.railBot} H ${railR}`)
    this.tTop.setAttribute('y', String(this.railTop - 8)); this.tBot.setAttribute('y', String(this.railBot - 6))
    this.field.style.width = this.fieldW + 'px'; this.field.style.height = fieldH + 'px'
    at(this.inEl, inP[0], inP[1]); at(this.inLbl, inP[0], inP[2])
    at(this.outEl, outP[0], outP[1]); at(this.outLbl, outP[0], outP[2]); at(this.outSub, outP[0], outP[3])
  }
  setLastWithdrawal(ago: number | null, day = 0) { this.outSub.textContent = ago === null ? 'none seen yet' : `${day.toLocaleString('en-US')} in 24 h · last ${ago > 3600 ? (ago / 3600).toFixed(1) + ' h' : Math.round(ago / 60) + ' min'} ago` }
  setCounts(c: { hype: number; retryable: number; other: number; withdrawals: number }) {
    const inN = c.hype + c.retryable + c.other
    for (const [k, el, to] of [['in', this.inEl, inN], ['out', this.outEl, c.withdrawals]] as const) {
      const from = this.shown[k]; if (from === to) continue
      const o = { v: from }
      gsap.to(o, { v: to, duration: .9, ease: 'power2.out', onUpdate: () => { el.textContent = Math.round(o.v).toLocaleString('en-US') } })
      this.shown[k] = to
    }
  }
  private slot = 0
  /** Each crossing gets the next of a row of fixed slots across the rails (12 on the grid), so the field reads as a steady stream, not confetti. */
  private fly(cls: string, fromY: number, toY: number, target: HTMLElement) {
    const n = Math.max(1, Math.floor((this.fieldW - 110) / 52) + 1)
    const coin = h('div', { class: 'coin ' + cls }); const x = 70 + (this.slot++ % n) * 52
    at(coin, x, fromY); this.field.append(coin)
    gsap.timeline({ onComplete: () => coin.remove() })
      .fromTo(coin, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: .25, ease: 'back.out(2)' })
      .to(coin, { y: toY - fromY, x: 0, duration: 1.3, ease: 'power1.inOut' }, 0)
      .to(coin, { scale: 0, opacity: 0, duration: .25 })
    gsap.fromTo(target, { scale: 1.1 }, { scale: 1, duration: .5, ease: 'back.out(2)' })
  }
  deposit(m: BridgeMsg) { this.fly(m.kind === 12 ? 'hype' : m.kind === 9 ? 'tok' : 'msg', this.railBot, this.railTop, this.inEl) }
  withdrawal(_w: Withdrawal) { this.fly('out', this.railTop, this.railBot, this.outEl) }
}
