import gsap from 'gsap'
import { h, at, G } from './dom'

/**
 * One layout template for every tab.
 *   row 1  y=0     title (left) + controls (right), shared baseline
 *   row 2  y=72    hero, 12 columns, fixed height
 *   row 3  y=HERO_BOTTOM+40  facts strip: 4 big facts on columns 1,4,7,10
 *   inspector: replaces the facts strip after a selection; Esc or × returns
 */
export const ROW = { title: 0, hero: 80, heroH: 420, facts: 80 + 420 + 56 }
export const STAGE_W = G.w(12)

export function titleRow(root: HTMLElement, html: string): { title: HTMLElement; controls: HTMLElement } {
  const title = at(h('h2', { class: 'h2', html }), G.x(1), ROW.title)
  const controls = at(h('div', { class: 'controls', role: 'toolbar' }), G.x(7), ROW.title + 4, G.w(6))
  root.append(title, controls)
  return { title, controls }
}

export function hero(root: HTMLElement, height = ROW.heroH, cls = ''): HTMLElement {
  const el = at(h('div', { class: 'hero ' + cls }), G.x(1), ROW.hero, STAGE_W, height)
  root.append(el); return el
}

export interface Fact { k: string; v: string; s?: string; cls?: string }
export class Facts {
  el: HTMLElement
  items: HTMLElement[] = []
  constructor(root: HTMLElement, y = ROW.facts) {
    this.el = at(h('div', { class: 'facts', role: 'list' }), G.x(1), y, STAGE_W, 110)
    root.append(this.el)
    for (let i = 0; i < 4; i++) {
      const f = at(h('div', { class: 'fact', role: 'listitem' }, [h('div', { class: 'k' }), h('div', { class: 'v' }), h('div', { class: 's' })]), (G.x(1 + i * 3) - G.x(1)), 0, G.w(3))
      this.el.append(f); this.items.push(f)
    }
  }
  set(facts: Fact[]) {
    facts.slice(0, 4).forEach((f, i) => {
      const it = this.items[i]
      const v = it.querySelector('.v') as HTMLElement
      ;(it.querySelector('.k') as HTMLElement).textContent = f.k
      ;(it.querySelector('.s') as HTMLElement).textContent = f.s ?? ''
      it.className = 'fact ' + (f.cls ?? '')
      if (v.innerHTML !== f.v) {
        const first = !v.innerHTML
        const stable = f.v.replace(/\d[\d,.]*\s*(s|min|h|ms)?/g, '#') === v.innerHTML.replace(/\d[\d,.]*\s*(s|min|h|ms)?/g, '#')
        v.innerHTML = f.v
        if (!first && !stable) gsap.fromTo(v, { opacity: .3, y: 4 }, { opacity: 1, y: 0, duration: .4, ease: 'power2.out', overwrite: true })
      }
    })
    for (let i = facts.length; i < 4; i++) { this.items[i].className = 'fact empty'; for (const c of ['.k', '.v', '.s']) (this.items[i].querySelector(c) as HTMLElement).textContent = '' }
  }
  show(on: boolean) { gsap.to(this.el, { opacity: on ? 1 : 0, y: on ? 0 : 6, duration: .3, ease: 'power2.out', onStart: () => { if (on) { this.el.style.pointerEvents = ''; this.el.style.visibility = 'visible' } }, onComplete: () => { if (!on) { this.el.style.pointerEvents = 'none'; this.el.style.visibility = 'hidden' } } }) }
}

/** The inspector replaces the facts strip after a click. One per tab. */
export class Inspector {
  el: HTMLElement
  body: HTMLElement
  titleEl: HTMLElement
  open = false
  constructor(private root: HTMLElement, private facts: Facts, y = ROW.facts, height = 170) {
    this.el = at(h('div', { class: 'inspector', role: 'region', 'aria-live': 'polite', tabindex: '-1' }), G.x(1), y, STAGE_W, height + 20)
    this.titleEl = h('div', { class: 'ititle' })
    const close = h('button', { class: 'iclose', type: 'button', 'aria-label': 'Close details' }, '× close  esc')
    close.addEventListener('click', () => this.hide())
    this.body = h('div', { class: 'ibody' })
    this.el.append(this.titleEl, close, this.body)
    this.el.style.opacity = '0'; this.el.style.pointerEvents = 'none'
    root.append(this.el)
    root.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.open) { this.hide(); e.stopPropagation() } })
  }
  show(title: string, build: (body: HTMLElement) => void) {
    this.titleEl.textContent = title
    this.body.innerHTML = ''; build(this.body)
    if (!this.open) { this.open = true; this.facts.show(false); this.el.style.pointerEvents = ''; gsap.fromTo(this.el, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: .35, delay: .15, ease: 'power2.out' }) }
    gsap.fromTo(this.body.children, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: .35, stagger: .05, ease: 'power2.out' })
  }
  onHide?: () => void
  hide() {
    if (!this.open) return
    this.open = false; this.el.style.pointerEvents = 'none'
    gsap.to(this.el, { opacity: 0, y: 8, duration: .25 }); this.facts.show(true)
    // the clicked tile keeps focus, and a key press would switch it to the focus ring; drop it
    const ae = document.activeElement as HTMLElement | null
    if (ae && this.root.contains(ae) && ae.tagName !== 'INPUT') ae.blur()
    this.onHide?.()
  }
}

/** Key / value column inside the inspector. */
export function ikv(k: string, v: string, s = '') {
  const el = h('div', { class: 'ikv' }, [h('div', { class: 'k' }, k), h('div', { class: 'v', html: v || '—' })])
  if (s) el.append(h('div', { class: 's', html: s }))
  return el
}
