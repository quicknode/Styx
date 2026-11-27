import gsap from 'gsap'
import { h } from './dom'
import { scale } from './view'

let tip: HTMLElement | null = null
/** Where a pointer event lands in the stage's own (design) coordinates. */
export function stagePoint(e: { clientX: number; clientY: number }) {
  const stage = document.getElementById('stage')!
  const r = stage.getBoundingClientRect(); const sc = scale()
  return { stage, x: (e.clientX - r.left) / sc, y: (e.clientY - r.top) / sc, w: r.width / sc }
}
/** One shared tooltip, positioned in stage coordinates. */
export function tooltip(target: HTMLElement | SVGElement, html: () => string) {
  const show = (e: MouseEvent) => {
    const { stage } = stagePoint(e)
    if (!tip) { tip = h('div', { class: 'tip' }); stage.append(tip) }
    tip.innerHTML = html()
    move(e)
    gsap.killTweensOf(tip); gsap.to(tip, { opacity: 1, duration: .15 })
  }
  const move = (e: MouseEvent) => {
    if (!tip) return
    const { x, y, w } = stagePoint(e)
    tip.style.left = Math.max(8, Math.min(w - 340, x + 16)) + 'px'; tip.style.top = Math.max(8, y - 12) + 'px'
  }
  const hide = () => { if (tip) gsap.to(tip, { opacity: 0, duration: .15 }) }
  target.addEventListener('mouseenter', show as any); target.addEventListener('mousemove', move as any); target.addEventListener('mouseleave', hide)
}
export function chip(label: string, cls = '', onClick?: () => void) {
  const c = h('button', { class: 'chipbtn ' + cls, type: 'button' }, label)
  if (onClick) c.addEventListener('click', onClick)
  return c
}
export function copyBtn(text: string) {
  const b = h('button', { class: 'copy', type: 'button', title: 'Copy' }, 'copy')
  b.addEventListener('click', async () => { try { await navigator.clipboard.writeText(text); b.textContent = 'copied'; setTimeout(() => (b.textContent = 'copy'), 1200) } catch { b.textContent = 'select' } })
  return b
}
export function link(href: string, text: string) { return h('a', { href, target: '_blank', rel: 'noopener', class: 'lnk' }, text) }
export function row(cells: (string | Node)[], widths: number[], cls = '') {
  const r = h('div', { class: 'tr ' + cls })
  cells.forEach((c, i) => { const td = h('div', { class: 'td', style: `width:${widths[i]}px` }); if (typeof c === 'string') td.innerHTML = c; else td.append(c); r.append(td) })
  return r
}
export function enter(el: Element | Element[] | NodeListOf<Element> | HTMLCollection, stagger = .04) {
  gsap.fromTo(el as any, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: .45, stagger, ease: 'power2.out', overwrite: true })
}
