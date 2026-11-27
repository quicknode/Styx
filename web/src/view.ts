/**
 * Two ways to show the same design.
 *   wide  (≥ 1200 px): three bands (header, stage, footer) on a 1920-unit grid, each scaled by `sc`
 *                      to the viewport and centred, paper filling whatever is left over.
 *   flow  (< 1200 px): every tab reflows into one scrolling column at scale 1. Elements placed with
 *                      at() drop their coordinates and stack in reading order; heroes redraw into
 *                      the width they are given.
 */
type Listener = () => void
class Signal { private ls = new Set<Listener>(); on(l: Listener) { this.ls.add(l); return () => this.ls.delete(l) } emit() { for (const l of this.ls) l() } }

export const FLOW_BELOW = 1200
export const view = {
  flow: false,
  sc: 1,
  /** fires after the mode flips or, in flow mode, after the width changes (debounced) */
  onChange: new Signal(),
}
/** Width a hero gets in flow mode: the stage column minus the pane padding. Works while the tab is hidden. */
export function flowWidth() { return Math.max(300, (document.getElementById('stage')?.clientWidth || innerWidth) - 32) }
/** Visual pixels per design unit: 1 in flow mode, `sc` in wide mode. */
export function scale() { return view.sc }

/** Elements placed with at() keep their design coordinates in data-*; this applies or clears them. */
export function applyMode() {
  const els = document.querySelectorAll<HTMLElement>('.tabpane > [data-at], .facts > [data-at]')
  for (const el of els) {
    if (view.flow) { el.style.left = ''; el.style.top = ''; el.style.width = ''; el.style.height = '' }
    else {
      el.style.left = el.dataset.x + 'px'; el.style.top = el.dataset.y + 'px'
      el.style.width = el.dataset.w !== undefined ? el.dataset.w + 'px' : ''
      el.style.height = el.dataset.h !== undefined ? el.dataset.h + 'px' : ''
    }
  }
}
