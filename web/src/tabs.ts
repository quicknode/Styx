import gsap from 'gsap'
import { h } from './dom'

export interface Tab { id: string; label: string; key: string; el: HTMLElement; onShow?: () => void; onHide?: () => void }

export class Tabs {
  tabs: Tab[] = []
  current: Tab | null = null
  bar: HTMLElement
  ink: HTMLElement
  // flow mode shows one dropdown instead of the row of tabs
  drop: HTMLButtonElement; dropLabel: HTMLElement; menu: HTMLUListElement
  constructor(bar: HTMLElement, private host: HTMLElement) {
    this.bar = bar; bar.setAttribute('role', 'tablist')
    this.ink = h('div', { class: 'tab-ink' }); bar.append(this.ink)
    this.dropLabel = h('span', { class: 'tabdrop-l' }, '')
    this.drop = h('button', { class: 'tabdrop', type: 'button', 'aria-haspopup': 'listbox', 'aria-expanded': 'false', 'aria-label': 'Section' }, [this.dropLabel, h('span', { class: 'caret', 'aria-hidden': 'true' })])
    this.menu = h('ul', { class: 'tabmenu', role: 'listbox', hidden: true })
    bar.append(this.drop, this.menu)
    this.drop.addEventListener('click', () => this.toggleMenu())
    this.menu.addEventListener('click', (e) => { const li = (e.target as HTMLElement).closest('li') as HTMLElement | null; if (!li) return; this.toggleMenu(false); this.show(li.dataset.id!) })
    addEventListener('click', (e) => { if (!this.menu.hidden && !(e.target as HTMLElement).closest('#tabs')) this.toggleMenu(false) })
    this.menu.addEventListener('keydown', (e) => { const items = Array.from(this.menu.querySelectorAll('li')) as HTMLElement[]; const i = items.indexOf(document.activeElement as HTMLElement); if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus() } if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus() } if (e.key === 'Escape') { this.toggleMenu(false); this.drop.focus() } if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (document.activeElement as HTMLElement).click() } })
    this.drop.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown') { e.preventDefault(); this.toggleMenu(true); (this.menu.querySelector('li') as HTMLElement)?.focus() } })
    addEventListener('hashchange', () => this.show(this.fromHash(), false))
    addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      const t = this.tabs.find((x) => x.key === e.key); if (t) this.show(t.id)
    })
  }
  add(t: Tab) {
    this.tabs.push(t)
    t.el.classList.add('tabpane'); t.el.id = `pane-${t.id}`; t.el.setAttribute('role', 'tabpanel'); t.el.style.display = 'none'; this.host.append(t.el)
    const b = h('button', { class: 'tab', type: 'button', role: 'tab', 'aria-selected': 'false', 'aria-controls': `pane-${t.id}`, 'data-id': t.id, html: `${t.label}<span class="tk" aria-hidden="true">${t.key}</span>` })
    b.addEventListener('click', () => this.show(t.id))
    this.bar.insertBefore(b, this.ink)
    this.menu.append(h('li', { role: 'option', 'data-id': t.id, 'aria-selected': 'false', tabindex: '-1' }, t.label))
    return t
  }
  toggleMenu(open?: boolean) { const o = open ?? this.menu.hidden; this.menu.hidden = !o; this.drop.setAttribute('aria-expanded', String(o)) }
  fromHash() { const m = location.hash.match(/tab=([a-z]+)/); return m?.[1] ?? this.tabs[0]?.id }
  show(id: string, pushHash = true) {
    const t = this.tabs.find((x) => x.id === id) ?? this.tabs[0]; if (!t || t === this.current) return
    const prev = this.current
    this.current = t
    if (pushHash) { const net = location.hash.match(/net=(mainnet|testnet)/)?.[1]; location.hash = `tab=${t.id}${net ? `&net=${net}` : ''}` }
    for (const b of Array.from(this.bar.querySelectorAll('.tab'))) { const on = (b as HTMLElement).dataset.id === t.id; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)) }
    for (const li of Array.from(this.menu.children) as HTMLElement[]) li.setAttribute('aria-selected', String(li.dataset.id === t.id))
    this.dropLabel.textContent = t.label; this.toggleMenu(false)
    const btn = this.bar.querySelector(`.tab[data-id="${t.id}"]`) as HTMLElement
    gsap.to(this.ink, { left: btn.offsetLeft, width: btn.offsetWidth, duration: .45, ease: 'power3.out' })
    if (prev) { prev.onHide?.(); gsap.to(prev.el, { opacity: 0, y: -8, duration: .2, onComplete: () => { prev.el.style.display = 'none' } }) }
    t.el.style.display = 'block'
    gsap.fromTo(t.el, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .45, delay: prev ? .15 : 0, ease: 'power3.out' })
    t.onShow?.()
  }
}
