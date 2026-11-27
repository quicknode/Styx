type Attrs = Record<string, string | number | boolean | undefined>
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, children: (Node | string)[] | string = []): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue
    if (k === 'class') el.className = String(v)
    else if (k === 'style') el.setAttribute('style', String(v))
    else if (k === 'html') el.innerHTML = String(v)
    else el.setAttribute(k, String(v))
  }
  if (typeof children === 'string') el.textContent = children
  else for (const c of children) el.append(c)
  return el
}
const NS = 'http://www.w3.org/2000/svg'
export function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs = {}, children: Node[] = []): SVGElementTagNameMap[K] {
  const el = document.createElementNS(NS, tag)
  for (const [k, v] of Object.entries(attrs)) { if (v === undefined || v === false) continue; el.setAttribute(k, String(v)) }
  for (const c of children) el.append(c)
  return el
}
/** Place an element on the 1920-unit grid. The coordinates are kept in data-* so the flow layout can drop and restore them (see view.ts). */
export function at<T extends HTMLElement>(el: T, x: number, y: number, w?: number, hgt?: number): T {
  // a data attribute, not a class: tabs reassign className freely. Prefixed `g` because the lanes use data-x for their own positions.
  el.dataset.at = '1'
  el.dataset.gx = String(x); el.dataset.gy = String(y)
  if (w !== undefined) el.dataset.gw = String(w); else delete el.dataset.gw
  if (hgt !== undefined) el.dataset.gh = String(hgt); else delete el.dataset.gh
  el.style.left = x + 'px'; el.style.top = y + 'px'
  if (w !== undefined) el.style.width = w + 'px'
  if (hgt !== undefined) el.style.height = hgt + 'px'
  return el
}
export function layer(w = 1920, hgt = 640): SVGSVGElement { return s('svg', { class: 'layer', viewBox: `0 0 ${w} ${hgt}`, preserveAspectRatio: 'none' }) }
export function txt(x: number, y: number, text: string, cls = '', anchor: 'start' | 'middle' | 'end' = 'start') { const t = s('text', { x, y, class: cls, 'text-anchor': anchor }); t.textContent = text; return t }
export function prepDraw(el: SVGGeometryElement): number { const len = el.getTotalLength(); el.style.strokeDasharray = String(len); el.style.strokeDashoffset = String(len); return len }
/** 12-column grid: 104px columns, 48px gutters, 72px margins (content 1776). */
export const G = {
  m: 72, col: 104, gut: 48,
  x: (n: number) => 72 + (n - 1) * 152,
  w: (n: number) => n * 104 + (n - 1) * 48,
}
