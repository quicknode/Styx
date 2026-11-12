import gsap from 'gsap'
import { h, at, layer, s as svg, txt } from '../dom'
import { state, selectBatch } from '../state'
import { chip, copyBtn, link, tooltip } from '../ui'
import { titleRow, hero, Facts, Inspector, ikv, ROW } from '../layout'
import { fmtAge, fmtTime, short, type Batch } from '../api'

type Mode = 'blocks' | 'time'

/**
 * Two views of the same batches, one encoding each.
 *  by blocks: a shelf where every batch is a segment as wide as the blocks it carried, laid end to end; the forming batch is the hatched tail.
 *  by time:   a 24 h timeline with one bar per batch at its landing time, height = blocks carried.
 */
export function batchesTab() {
  const el = h('div')
  let mode: Mode = 'blocks'
  const { controls } = titleRow(el, 'Blocks into <em>batches</em>.')
  const legend = at(h('div', { class: 'legend' }), 72, 10, 900); legend.style.justifyContent = 'flex-start'; el.append(legend)
  const chips: Record<Mode, HTMLButtonElement> = { blocks: chip('by blocks', 'on ely'), time: chip('by time', 'ely') }
  ;(Object.keys(chips) as Mode[]).forEach((m) => { chips[m].setAttribute('aria-pressed', String(m === mode)); chips[m].addEventListener('click', () => { mode = m; for (const k of Object.keys(chips) as Mode[]) { chips[k].classList.toggle('on', k === m); chips[k].setAttribute('aria-pressed', String(k === m)) } draw(true) }); controls.append(chips[m]) })
  const CH = ROW.heroH, CW = 1776
  const chart = hero(el, CH); chart.setAttribute('role', 'img')
  const axis = layer(CW, CH); chart.append(axis)
  const items = h('div', { style: 'position:absolute;inset:0', role: 'list' }); chart.append(items)
  const facts = new Facts(el)
  const insp = new Inspector(el, facts)

  const tip = (b: Batch) => `<b>batch #${b.seq}</b> · landed ${fmtTime(b.l1Time)}<br>${b.l2Blocks!.toLocaleString('en-US')} blocks · ${b.l2FirstBlock!.toLocaleString('en-US')} → ${b.l2LastBlock!.toLocaleString('en-US')}<br>${b.postingDelay !== undefined ? `its last block waited ${fmtAge(b.postingDelay)} to land` : 'posting delay resolving'}<br>${b.daMode === 'anytrust' ? 'AnyTrust certificate' : b.daMode} · ${b.dataBytes} bytes<br><span class="dim">click for details</span>`
  const wire = (node: HTMLElement, b: Batch) => {
    node.setAttribute('role', 'listitem'); node.setAttribute('tabindex', '0'); node.setAttribute('aria-label', `Batch ${b.seq}, ${b.l2Blocks} blocks`)
    const open = () => selectBatch(b.seq)
    node.addEventListener('click', open)
    node.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } if (e.key === 'ArrowLeft') (node.previousElementSibling as HTMLElement)?.focus(); if (e.key === 'ArrowRight') (node.nextElementSibling as HTMLElement)?.focus() })
    tooltip(node, () => tip(b))
  }

  let sig = ''; let shownSeq = -1
  function draw(force = false) {
    const s = state.snapshot; if (!s) return
    const list = s.batches.filter((b) => b.l2FirstBlock !== undefined && b.l2LastBlock !== undefined)
    const head = s.elysium.head?.number ?? 0
    const waiting = Math.max(0, head - (list.at(-1)?.l2LastBlock ?? head))
    const nsig = `${mode}:` + list.map((b) => b.seq).join(',') + ':' + Math.floor(waiting / 200) + (mode === 'time' ? ':' + Math.floor(s.now / 120) : '')
    if (!force && nsig === sig) { drawFacts(); if (insp.open) drawInspector(); return }
    const animate = force || !sig || !sig.startsWith(`${mode}:` + list.map((b) => b.seq).join(','))
    sig = nsig
    items.innerHTML = ''; axis.innerHTML = ''
    if (!list.length) return
    if (mode === 'blocks') drawShelf(list.slice(-36), head, waiting, s); else drawTimeline(list, waiting, s)
    if (animate) gsap.fromTo(Array.from(items.children), mode === 'blocks' ? { scaleX: 0, transformOrigin: 'left center' } : { scaleY: 0, transformOrigin: 'bottom' }, mode === 'blocks' ? { scaleX: 1, duration: .35, stagger: .012, ease: 'power3.out' } : { scaleY: 1, duration: .35, stagger: .006, ease: 'power3.out' })
    drawFacts(); if (insp.open) drawInspector()
  }

  function drawShelf(list: Batch[], head: number, waiting: number, s: NonNullable<typeof state.snapshot>) {
    chart.setAttribute('aria-label', 'Elysium blocks laid end to end and divided into batches')
    legend.innerHTML = '<span><i class="lg lg-seg"></i>one batch · width = blocks it carried</span><span><i class="lg lg-wait"></i>forming now</span>'
    const SHELF_Y = 110, SHELF_H = 150, base = SHELF_Y + SHELF_H
    const first = list[0].l2FirstBlock!; const span = Math.max(1, head - first)
    const x = (blk: number) => ((blk - first) / span) * CW
    axis.append(svg('path', { class: 'hair2', d: `M 0 ${base + 1} H ${CW}` }))
    const raw = Math.pow(10, Math.floor(Math.log10(span / 8))); const tick = raw * (span / raw > 40 ? 5 : span / raw > 16 ? 2 : 1)
    for (let n = Math.ceil(first / tick) * tick; n <= head; n += tick) { const xx = x(n); axis.append(svg('path', { class: 'hair2', d: `M ${xx} ${base + 1} V ${base + 9}` })); axis.append(txt(xx, base + 26, n.toLocaleString('en-US'), '', 'middle')) }
    axis.append(txt(0, base + 50, 'elysium block number →', ''))
    axis.append(txt(0, SHELF_Y - 14, `${list.length} most recent batches · ${span.toLocaleString('en-US')} blocks`, ''))
    list.forEach((b, i) => {
      const x0 = x(b.l2FirstBlock!), x1 = x(b.l2LastBlock! + 1); const w = Math.max(2, x1 - x0 - 2)
      const seg = at(h('div', { class: 'seg' + (i % 2 ? ' alt' : '') + (b.daMode === 'fulldata' ? ' full' : '') + (b.seq === state.selectedBatch ? ' sel' : '') }), x0, SHELF_Y, w, SHELF_H)
      if (w > 40) seg.append(h('span', { class: 'segl' }, `#${b.seq}`))
      if (w > 64) seg.append(h('span', { class: 'segn' }, b.l2Blocks!.toLocaleString('en-US')))
      wire(seg, b); items.append(seg)
    })
    if (waiting > 0) {
      const x0 = x(list.at(-1)!.l2LastBlock! + 1)
      const tail = at(h('div', { class: 'seg wait', 'aria-label': `${waiting} blocks waiting for the next batch` }), x0, SHELF_Y, Math.max(2, CW - x0), SHELF_H)
      tooltip(tail, () => `<b>forming now</b><br>${waiting.toLocaleString('en-US')} blocks waiting for batch #${list.at(-1)!.seq + 1}<br>${s.elysium.unbatchedSeconds ? `${fmtAge(s.elysium.unbatchedSeconds)} behind head` : ''}`)
      items.append(tail)
      axis.append(txt(CW, SHELF_Y - 14, `${waiting.toLocaleString('en-US')} blocks waiting →`, 'ink', 'end'))
    }
  }

  function drawTimeline(all: Batch[], waiting: number, s: NonNullable<typeof state.snapshot>) {
    chart.setAttribute('aria-label', 'Batches over the last 24 hours, height is blocks per batch')
    legend.innerHTML = '<span><i class="lg lg-seg"></i>one batch at its landing time · height = blocks it carried</span><span><i class="lg lg-wait"></i>forming now</span>'
    const SPAN = 24 * 3600; const now = s.now
    const list = all.filter((b) => now - b.l1Time <= SPAN)
    const max = Math.max(1, waiting, ...list.map((b) => b.l2Blocks!))
    const x = (t: number) => CW - ((now - t) / SPAN) * CW
    const yOf = (n: number) => (n / max) * (CH - 64)
    // bar width from the tightest gap between neighbours, so bars never overlap
    const gaps = list.slice(1).map((b, i) => x(b.l1Time) - x(list[i].l1Time))
    const BW = Math.max(4, Math.min(22, Math.floor(Math.min(...gaps, 22)) - 2))
    axis.append(svg('path', { class: 'hair2', d: `M 0 ${CH - 28} H ${CW}` }))
    ;[0.5, 1].forEach((f) => { const y = CH - 28 - (CH - 64) * f; axis.append(svg('path', { class: 'hair', d: `M 0 ${y} H ${CW}` })); axis.append(txt(0, y - 6, `${Math.round(max * f).toLocaleString('en-US')} blocks`)) })
    for (let hrs = 0; hrs <= 24; hrs += 4) { const xx = x(now - hrs * 3600); axis.append(svg('path', { class: 'hair2', d: `M ${xx} ${CH - 28} V ${CH - 20}` })); axis.append(txt(xx, CH - 6, hrs ? `−${hrs} h` : 'now', hrs ? '' : 'ink', hrs === 24 ? 'start' : hrs ? 'middle' : 'end')) }
    list.forEach((b) => {
      const bar = at(h('div', { class: 'bar' + (b.daMode === 'fulldata' ? ' hatch' : '') + (b.seq === state.selectedBatch ? ' sel' : '') }), x(b.l1Time) - BW / 2, 0, BW, Math.max(3, yOf(b.l2Blocks!)))
      bar.style.top = ''; bar.style.bottom = '28px'
      wire(bar, b); items.append(bar)
    })
    if (waiting > 0) {
      const tail = at(h('div', { class: 'bar wait', 'aria-label': `${waiting} blocks waiting for the next batch` }), CW - BW, 0, BW, Math.max(3, yOf(waiting)))
      tail.style.top = ''; tail.style.bottom = '28px'
      tooltip(tail, () => `<b>forming now</b><br>${waiting.toLocaleString('en-US')} blocks waiting for batch #${(all.at(-1)?.seq ?? 0) + 1}<br>${s.elysium.unbatchedSeconds ? `${fmtAge(s.elysium.unbatchedSeconds)} behind head` : ''}`)
      items.append(tail)
      axis.append(txt(CW, 16, `${waiting.toLocaleString('en-US')} blocks waiting →`, 'ink', 'end'))
    }
  }

  function drawFacts() {
    const s = state.snapshot; if (!s) return
    const list = s.batches.filter((b) => b.l2Blocks); const last = list.at(-1)
    const delays = list.map((b) => b.postingDelay).filter((x): x is number => x !== undefined)
    const med = delays.length ? [...delays].sort((a, b) => a - b)[Math.floor(delays.length / 2)] : 0
    const blocks = list.map((b) => b.l2Blocks!); const medB = blocks.length ? [...blocks].sort((a, b) => a - b)[Math.floor(blocks.length / 2)] : 0
    facts.set([
      { k: 'newest batch', v: last ? `#${last.seq}` : '—', s: last ? `landed ${fmtAge(s.now - last.l1Time)} ago · ${last.l2Blocks!.toLocaleString('en-US')} blocks` : '' },
      { k: 'how often', v: s.health.batches.medianInterval ? `every ${fmtAge(s.health.batches.medianInterval)}` : 'measuring', s: 'median gap between batches' },
      { k: 'blocks per batch', v: medB ? medB.toLocaleString('en-US') : '—', s: 'median over 24 h', cls: 'hl' },
      { k: 'posting delay', v: med ? fmtAge(med) : '—', s: 'how long a block waits to be in a batch', cls: med > 900 ? 'amber' : '' },
    ])
  }
  function drawInspector() {
    const s = state.snapshot; const b = s?.batches.find((x) => x.seq === state.selectedBatch); if (!s || !b) return
    if (insp.open && shownSeq === b.seq && b.postingDelay !== undefined) return
    shownSeq = b.seq
    insp.show(`batch #${b.seq}`, (body) => {
      body.append(
        ikv('elysium blocks', b.l2Blocks ? `${b.l2Blocks.toLocaleString('en-US')}` : '—', b.l2FirstBlock ? `${b.l2FirstBlock.toLocaleString('en-US')} → ${b.l2LastBlock!.toLocaleString('en-US')}` : ''),
        ikv('posting delay', b.postingDelay !== undefined ? `${fmtAge(b.postingDelay)} <em>after</em>` : 'resolving…', b.l2LastTime ? `last block ${fmtTime(b.l2LastTime)} → landed ${fmtTime(b.l1Time)}` : ''),
        ikv('data', b.daMode === 'anytrust' ? 'AnyTrust <em>cert</em>' : b.daMode, `${b.dataBytes} bytes · header ${b.daHeader}`),
        ikv('on hyperevm', `<span style="font-family:var(--mono);font-size:24px">block ${b.l1Block.toLocaleString('en-US')}</span>`, 'tx '),
      )
      body.lastElementChild!.querySelector('.s')!.append(link(`${s.network.explorer.hyperevm}/tx/${b.txHash}`, short(b.txHash)), copyBtn(b.txHash))
    })
    for (const n of Array.from(items.children)) n.classList.toggle('sel', (n as HTMLElement).getAttribute('aria-label')?.startsWith(`Batch ${b.seq},`) ?? false)
  }
  state.onSnapshot.on(() => { if (el.style.display !== 'none') draw() })
  state.onSelectBatch.on((seq) => { if (el.style.display === 'none') return; if (seq === null) insp.hide(); else drawInspector() })
  state.onNet.on(() => { items.innerHTML = ''; sig = ''; insp.hide() })
  return { el, onShow: () => { draw(true); if (state.selectedBatch) drawInspector() } }
}
