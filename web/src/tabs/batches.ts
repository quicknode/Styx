import gsap from 'gsap'
import { h, at, layer, s as svg, txt } from '../dom'
import { state, selectBatch } from '../state'
import { copyBtn, link, tooltip } from '../ui'
import { titleRow, hero, Facts, Inspector, ikv, ROW } from '../layout'
import { fmtAge, fmtTime, short, type Batch } from '../api'

/** A shelf of blocks: every batch is a segment as wide as the blocks it carried, laid end to end; the forming batch is the hatched tail. */
export function batchesTab() {
  const el = h('div')
  titleRow(el, 'Blocks into <em>batches</em>.')
  const legend = at(h('div', { class: 'legend' }), 72, 60, 1100); legend.style.justifyContent = 'flex-start'; el.append(legend)
  legend.innerHTML = '<span><i class="lg lg-seg"></i>one batch · width = blocks it carried</span><span><i class="lg lg-wait"></i>forming now</span>'
  const CH = ROW.heroH, CW = 1776
  const BASE = CH - 28, SEG_H = 200          // same baseline as the Bridge chart
  const chart = hero(el, CH); chart.setAttribute('role', 'img'); chart.setAttribute('aria-label', 'Elysium blocks laid end to end and divided into batches')
  const axis = layer(CW, CH); chart.append(axis)
  const items = h('div', { style: 'position:absolute;inset:0', role: 'list' }); chart.append(items)
  const facts = new Facts(el)
  const insp = new Inspector(el, facts)

  const tip = (b: Batch) => `<b>batch #${b.seq}</b> · landed ${fmtTime(b.l1Time)}<br>${b.l2Blocks!.toLocaleString('en-US')} blocks · ${b.l2FirstBlock!.toLocaleString('en-US')} → ${b.l2LastBlock!.toLocaleString('en-US')}<br>${b.postingDelay !== undefined ? `its last block waited ${fmtAge(b.postingDelay)} to land` : 'posting delay resolving'}<br>${b.daMode === 'anytrust' ? 'AnyTrust certificate' : b.daMode} · ${b.dataBytes} bytes<br><span class="dim">click for details</span>`

  let sig = ''; let shownSeq = -1
  function draw(force = false) {
    const s = state.snapshot; if (!s) return
    const list = s.batches.filter((b) => b.l2FirstBlock !== undefined && b.l2LastBlock !== undefined).slice(-36)
    const head = s.elysium.head?.number ?? 0
    const waiting = Math.max(0, head - (list.at(-1)?.l2LastBlock ?? head))
    const nsig = list.map((b) => b.seq).join(',') + ':' + Math.floor(waiting / 200)
    if (!force && nsig === sig) { drawFacts(); if (insp.open) drawInspector(); return }
    const animate = force || !sig || !sig.startsWith(list.map((b) => b.seq).join(','))
    sig = nsig
    items.innerHTML = ''; axis.innerHTML = ''
    if (!list.length) return
    const first = list[0].l2FirstBlock!; const span = Math.max(1, head - first)
    const x = (blk: number) => ((blk - first) / span) * CW
    axis.append(svg('path', { class: 'hair2', d: `M 0 ${BASE} H ${CW}` }))
    const raw = Math.pow(10, Math.floor(Math.log10(span / 8))); const tick = raw * (span / raw > 40 ? 5 : span / raw > 16 ? 2 : 1)
    for (let n = Math.ceil(first / tick) * tick; n <= head; n += tick) { const xx = x(n); axis.append(svg('path', { class: 'hair2', d: `M ${xx} ${BASE} V ${BASE + 8}` })); axis.append(txt(xx, BASE + 22, n.toLocaleString('en-US'), '', 'middle')) }
    axis.append(txt(0, 16, `${list.length} most recent batches · ${span.toLocaleString('en-US')} elysium blocks →`, ''))
    list.forEach((b, i) => {
      const x0 = x(b.l2FirstBlock!), x1 = x(b.l2LastBlock! + 1); const w = Math.max(2, x1 - x0 - 2)
      const seg = at(h('div', { class: 'seg' + (i % 2 ? ' alt' : '') + (b.daMode === 'fulldata' ? ' full' : '') + (b.seq === state.selectedBatch ? ' sel' : ''), role: 'listitem', tabindex: '0', 'aria-label': `Batch ${b.seq}, ${b.l2Blocks} blocks` }), x0, BASE - SEG_H, w, SEG_H)
      seg.append(h('span', { class: 'segl vert' }, `#${b.seq}`))
      if (w > 30) seg.append(h('span', { class: 'segn vert' }, b.l2Blocks!.toLocaleString('en-US')))
      const open = () => selectBatch(b.seq)
      seg.addEventListener('click', open)
      seg.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } if (e.key === 'ArrowLeft') (seg.previousElementSibling as HTMLElement)?.focus(); if (e.key === 'ArrowRight') (seg.nextElementSibling as HTMLElement)?.focus() })
      tooltip(seg, () => tip(b)); items.append(seg)
    })
    if (waiting > 0) {
      const x0 = x(list.at(-1)!.l2LastBlock! + 1)
      const tail = at(h('div', { class: 'seg wait', 'aria-label': `${waiting} blocks waiting for the next batch` }), x0, BASE - SEG_H, Math.max(2, CW - x0), SEG_H)
      tooltip(tail, () => `<b>forming now</b><br>${waiting.toLocaleString('en-US')} blocks waiting for batch #${list.at(-1)!.seq + 1}<br>${s.elysium.unbatchedSeconds ? `${fmtAge(s.elysium.unbatchedSeconds)} behind head` : ''}`)
      items.append(tail)
      axis.append(txt(CW, 16, `${waiting.toLocaleString('en-US')} blocks waiting →`, 'ink', 'end'))
    }
    if (animate) gsap.fromTo(Array.from(items.children), { scaleX: 0, transformOrigin: 'left center' }, { scaleX: 1, duration: .35, stagger: .012, ease: 'power3.out' })
    drawFacts(); if (insp.open) drawInspector()
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
