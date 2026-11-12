import gsap from 'gsap'
import { h } from '../dom'
import type { Health, HealthState } from '../api'

const ITEMS: { key: keyof Omit<Health, 'sentence'>; label: string; value: (hh: Health) => string }[] = [
  { key: 'sequencer', label: 'Sequencer', value: (x) => x.sequencer.state === 'live' ? 'Producing <em>blocks</em>' : x.sequencer.state === 'pending' ? 'Blocks <em>slowing</em>' : x.sequencer.state === 'failure' ? 'No blocks <em>seen</em>' : 'Waiting' },
  { key: 'batches', label: 'Batches', value: (x) => x.batches.state === 'live' ? 'Posting <em>on time</em>' : x.batches.state === 'pending' ? 'Batch <em>overdue</em>' : x.batches.state === 'failure' ? 'Batches <em>stalled</em>' : 'Waiting' },
  { key: 'data', label: 'Data availability', value: (x) => x.data.mode === 'anytrust' ? 'AnyTrust <em>certificate</em>' : x.data.mode === 'fulldata' ? 'Full data <em>fallback</em>' : x.data.mode === 'blob' ? 'Blob <em>data</em>' : 'Waiting' },
  { key: 'assertions', label: 'Assertions', value: (x) => x.assertions.state === 'live' ? 'Confirming <em>on time</em>' : x.assertions.state === 'pending' ? 'Confirmation <em>overdue</em>' : x.assertions.state === 'failure' ? 'Confirmations <em>stalled</em>' : 'Waiting' },
]

export class HealthStrip {
  els = new Map<string, { root: HTMLElement; v: HTMLElement; d: HTMLElement; state: HealthState | 'unknown' }>()
  constructor(root: HTMLElement, onClick?: (key: string) => void) {
    for (const it of ITEMS) {
      const v = h('div', { class: 'v', html: 'Waiting' })
      const d = h('div', { class: 'd' }, '—')
      const el = h('div', { class: 'hp' }, [h('div', { class: 'k' }, [h('span', { class: 'dot' }), it.label]), v, d])
      el.addEventListener('click', () => onClick?.(it.key))
      root.append(el)
      this.els.set(it.key, { root: el, v, d, state: 'unknown' })
    }
    gsap.to('.hp', { opacity: 1, y: 0, duration: .8, stagger: .12, ease: 'power3.out', delay: .3, startAt: { y: 10 } })
  }
  update(hh: Health) {
    for (const it of ITEMS) {
      const e = this.els.get(it.key)!
      const next = hh[it.key].state
      const html = it.value(hh)
      if (e.v.innerHTML !== html) { gsap.fromTo(e.v, { opacity: .2, y: 4 }, { opacity: 1, y: 0, duration: .5, ease: 'power2.out' }); e.v.innerHTML = html }
      e.d.textContent = hh[it.key].detail
      if (next !== e.state) {
        e.root.classList.remove('live', 'pending', 'failure'); if (next !== 'unknown') e.root.classList.add(next)
        const dot = e.root.querySelector('.dot')!
        gsap.fromTo(dot, { scale: 1.8 }, { scale: 1, duration: .6, ease: 'back.out(2)' })
        e.state = next
      }
    }
  }
}
