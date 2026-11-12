import gsap from 'gsap'
import { h } from './dom'

let tip: HTMLElement | null = null
/** One shared tooltip, positioned in deck coordinates. */
export function tooltip(target: HTMLElement | SVGElement, html: () => string) {
  const deck = document.getElementById('deck')!
  const show = (e: MouseEvent) => {
    if (!tip) { tip = h('div', { class: 'tip' }); deck.append(tip) }
    tip.innerHTML = html()
    move(e)
    gsap.killTweensOf(tip); gsap.to(tip, { opacity: 1, duration: .15 })
  }
  const move = (e: MouseEvent) => {
    if (!tip) return
    const r = deck.getBoundingClientRect(); const sc = r.width / 1920
    const x = (e.clientX - r.left) / sc; const y = (e.clientY - r.top) / sc
    tip.style.left = Math.min(1920 - 340, x + 16) + 'px'; tip.style.top = Math.max(8, y - 12) + 'px'
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
