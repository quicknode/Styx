import gsap from 'gsap'
import { h } from './dom'

export interface Tab { id: string; label: string; key: string; el: HTMLElement; onShow?: () => void; onHide?: () => void }

export class Tabs {
  tabs: Tab[] = []
  current: Tab | null = null
  bar: HTMLElement
  ink: HTMLElement
  constructor(bar: HTMLElement, private host: HTMLElement) {
    this.bar = bar
    this.ink = h('div', { class: 'tab-ink' }); bar.append(this.ink)
    addEventListener('hashchange', () => this.show(this.fromHash(), false))
    addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      const t = this.tabs.find((x) => x.key === e.key); if (t) this.show(t.id)
    })
  }
  add(t: Tab) {
    this.tabs.push(t)
    t.el.classList.add('tabpane'); t.el.style.display = 'none'; this.host.append(t.el)
    const b = h('button', { class: 'tab', type: 'button', 'data-id': t.id, html: `${t.label}<span class="tk">${t.key}</span>` })
    b.addEventListener('click', () => this.show(t.id))
    this.bar.insertBefore(b, this.ink)
    return t
  }
  fromHash() { const m = location.hash.match(/tab=([a-z]+)/); return m?.[1] ?? this.tabs[0]?.id }
  show(id: string, pushHash = true) {
    const t = this.tabs.find((x) => x.id === id) ?? this.tabs[0]; if (!t || t === this.current) return
    const prev = this.current
    this.current = t
    if (pushHash) { const net = location.hash.match(/net=(mainnet|testnet)/)?.[1]; location.hash = `tab=${t.id}${net ? `&net=${net}` : ''}` }
    for (const b of Array.from(this.bar.querySelectorAll('.tab'))) b.classList.toggle('on', (b as HTMLElement).dataset.id === t.id)
    const btn = this.bar.querySelector(`.tab[data-id="${t.id}"]`) as HTMLElement
    gsap.to(this.ink, { left: btn.offsetLeft, width: btn.offsetWidth, duration: .45, ease: 'power3.out' })
    if (prev) { prev.onHide?.(); gsap.to(prev.el, { opacity: 0, y: -8, duration: .2, onComplete: () => { prev.el.style.display = 'none' } }) }
    t.el.style.display = 'block'
    gsap.fromTo(t.el, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .45, delay: prev ? .15 : 0, ease: 'power3.out' })
    t.onShow?.()
  }
}
