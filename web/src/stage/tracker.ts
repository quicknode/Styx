import gsap from 'gsap'
import { at, h, G } from '../dom'
import { fetchTx, fmtAge, type TxLadder } from '../api'

const RUNGS = [
  { key: 'included', title: 'Included', hint: 'In an Elysium block' },
  { key: 'batched', title: 'Batched', hint: 'Posted to HyperEVM' },
  { key: 'l1', title: 'L1 confirmed', hint: 'HyperEVM confirmations' },
  { key: 'assertion', title: 'Asserted', hint: 'State claim confirmed' },
] as const

/** Paste a hash, watch it climb the settlement ladder. */
export class Tracker {
  root: HTMLElement
  input: HTMLInputElement
  rungs: Record<string, { el: HTMLElement; t: HTMLElement; s: HTMLElement; cb: HTMLElement }> = {}
  status: HTMLElement
  X = G.x(7); Y = 500; W = G.w(6); H = 140
  constructor(stage: HTMLElement) {
    this.root = at(h('div', { class: 'panel' }, [h('span', { class: 'panel-title' }, 'Follow a transaction · paste an Elysium tx hash')]), this.X, this.Y, this.W, this.H)
    stage.append(this.root)
    this.input = h('input', { id: 'trk-input', placeholder: '0x…', spellcheck: 'false', autocomplete: 'off' })
    at(this.input, 24, 20, this.W - 48)
    this.root.append(this.input)
    this.status = at(h('div', { class: 'lbl', style: 'color:var(--ink-50)' }, 'Included → batched → L1 confirmed → asserted'), 24, 72)
    this.root.append(this.status)
    RUNGS.forEach((r, i) => {
      const cb = h('div', { class: 'cb' }, String(i + 1))
      const t = h('div', { class: 't' }, r.title)
      const sub = h('div', { class: 's' }, r.hint)
      const colW = (this.W - 48) / 4
      const el = at(h('div', { class: 'rung' }, [cb, h('div', { class: 'rb' }, [t, sub])]), 24 + i * colW, 92, colW - 12)
      this.root.append(el)
      this.rungs[r.key] = { el, t, s: sub, cb }
    })
    this.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') void this.lookup(this.input.value.trim()) })
    this.input.addEventListener('paste', () => setTimeout(() => void this.lookup(this.input.value.trim()), 10))
  }
  private timer?: number
  async lookup(hash: string) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) { this.status.textContent = 'That is not a transaction hash.'; return }
    this.status.textContent = 'Looking it up…'; this.status.classList.add('pulse')
    const r = await fetchTx(hash)
    this.status.classList.remove('pulse')
    this.render(r)
    clearTimeout(this.timer)
    if (r.status !== 'assertion_confirmed' && r.status !== 'not_found') this.timer = window.setTimeout(() => void this.lookup(hash), 10000)
  }
  render(r: TxLadder) {
    const order = ['included', 'batched', 'l1', 'assertion']
    const reached = r.status === 'included' ? 1 : r.status === 'batched' ? 2 : r.status === 'l1_confirmed' ? 3 : r.status === 'assertion_confirmed' ? 4 : 0
    if (r.error) { this.status.textContent = r.error; return }
    if (r.status === 'not_found') { this.status.textContent = 'Not found on Elysium. Check the hash and the network.'; return }
    if (r.status === 'pending') { this.status.textContent = 'Seen by the sequencer, not yet in a block.'; return }
    this.status.textContent = r.nextEta ?? (r.status === 'assertion_confirmed' ? 'Fully settled: the assertion covering this batch is confirmed on HyperEVM.' : '')
    order.forEach((k, i) => {
      const rg = this.rungs[k]
      const done = i < reached; const now = i === reached
      const was = rg.el.classList.contains('done')
      rg.el.classList.toggle('done', done); rg.el.classList.toggle('now', now)
      if (done && !was) gsap.fromTo(rg.el, { x: -8, opacity: .3 }, { x: 0, opacity: 1, duration: .5, delay: i * .18, ease: 'power3.out' })
      if (done) rg.cb.textContent = '✓'; else rg.cb.textContent = String(i + 1)
    })
    const now = Math.floor(Date.now() / 1000)
    if (r.included) this.rungs.included.s.innerHTML = `blk ${r.included.block.toLocaleString('en-US')} · ${fmtAge(now - r.included.timestamp)} ago <a href="${r.included.explorer}" target="_blank" rel="noopener">↗</a>`
    if (r.batched) this.rungs.batched.s.innerHTML = `#${r.batched.seq} · ${r.batched.postingDelay !== undefined ? `+${fmtAge(r.batched.postingDelay)} after block` : fmtAge(now - r.batched.l1Time) + ' ago'} <a href="${r.batched.explorer}" target="_blank" rel="noopener">↗</a>`
    else this.rungs.batched.s.textContent = 'Posted to HyperEVM'
    if (r.l1) this.rungs.l1.s.textContent = `${r.l1.confirmations.toLocaleString('en-US')} confirmations`
    else this.rungs.l1.s.textContent = 'HyperEVM confirmations'
    if (r.assertion) this.rungs.assertion.s.innerHTML = r.assertion.confirmedTime ? `confirmed ${fmtAge(now - r.assertion.confirmedTime)} ago${r.assertion.explorer ? ` <a href="${r.assertion.explorer}" target="_blank" rel="noopener">↗</a>` : ''}` : `created ${r.assertion.createdTime ? fmtAge(now - r.assertion.createdTime) + ' ago' : ''}, pending`
    else this.rungs.assertion.s.textContent = 'State claim confirmed'
  }
}
