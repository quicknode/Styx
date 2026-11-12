import gsap from 'gsap'
import { h, at, layer, s as svg, txt } from '../dom'
import { state, selectBatch } from '../state'
import { copyBtn, link, tooltip } from '../ui'
import { titleRow, hero, Facts, Inspector, ikv, ROW } from '../layout'
import { fmtAge, fmtTime, short, type Batch } from '../api'

/**
 * Batches as a ruler of Elysium blocks. Each segment is one batch, as wide as the blocks it carries.
 * The stem above a segment is how long its last block waited to land on HyperEVM. The square on it
 * is the data mode. The hatched tail on the right is every block not yet in a batch.
 */
export function batchesTab() {
  const el = h('div')
  titleRow(el, 'Blocks into <em>batches</em>.')
  const legend = at(h('div', { class: 'legend' }), 72 + 1776 - 980, 14, 980); el.append(legend)
  legend.innerHTML = '<span><i class="lg seg"></i>width = blocks in the batch</span><span><i class="lg stem"></i>stem = posting delay</span><span><i class="lg wait"></i>not yet batched</span>'
  const CH = ROW.heroH, CW = 1776
  const RULER_Y = CH - 92, RULER_H = 44, STEM_BASE = RULER_Y - 12, STEM_MAX = 150
  const chart = hero(el, CH); chart.setAttribute('role', 'img'); chart.setAttribute('aria-label', 'Elysium blocks divided into batches')
  const axis = layer(CW, CH); chart.append(axis)
  const segs = h('div', { style: 'position:absolute;inset:0', role: 'list' }); chart.append(segs)
  const facts = new Facts(el)
  const insp = new Inspector(el, facts)

  let sig = ''; let shownSeq = -1
  function draw(force = false) {
    const s = state.snapshot; if (!s) return
    const list = s.batches.filter((b) => b.l2FirstBlock !== undefined && b.l2LastBlock !== undefined).slice(-40)
    const head = s.elysium.head?.number ?? 0
    const nsig = list.map((b) => `${b.seq}.${b.postingDelay ?? -1}`).join(',') + ':' + Math.floor(head / 200)
    if (!force && nsig === sig) { drawFacts(); if (insp.open) drawInspector(); return }
    const animate = force || !sig
    sig = nsig
    segs.innerHTML = ''; axis.innerHTML = ''
    if (!list.length) return
    const first = list[0].l2FirstBlock!
    const waiting = Math.max(0, head - list.at(-1)!.l2LastBlock!)
    const span = head - first || 1
    const x = (blk: number) => ((blk - first) / span) * CW
    const maxDelay = Math.max(1, ...list.map((b) => b.postingDelay ?? 0))
    // ruler baseline and block-number ticks
    axis.append(svg('path', { class: 'hair2', d: `M 0 ${RULER_Y + RULER_H + 1} H ${CW}` }))
    const step = Math.pow(10, Math.floor(Math.log10(span / 6)))
    const tickStep = step * (span / step > 40 ? 5 : span / step > 16 ? 2 : 1)
    for (let n = Math.ceil(first / tickStep) * tickStep; n <= head; n += tickStep) { const xx = x(n); axis.append(svg('path', { class: 'hair2', d: `M ${xx} ${RULER_Y + RULER_H + 1} V ${RULER_Y + RULER_H + 9}` })); axis.append(txt(xx, RULER_Y + RULER_H + 26, n.toLocaleString('en-US'), '', 'middle')) }
    axis.append(txt(0, 16, 'elysium block number →', ''))
    // delay scale
    axis.append(svg('path', { class: 'hair', d: `M 0 ${STEM_BASE - STEM_MAX} H ${CW}` })); axis.append(txt(CW, STEM_BASE - STEM_MAX - 6, `${fmtAge(maxDelay)} posting delay`, '', 'end'))
    list.forEach((b) => {
      const x0 = x(b.l2FirstBlock!), x1 = x(b.l2LastBlock! + 1); const w = Math.max(2, x1 - x0 - 1)
      const seg = at(h('div', { class: 'seg' + (b.daMode === 'fulldata' ? ' full' : '') + (b.seq === state.selectedBatch ? ' sel' : ''), role: 'listitem', tabindex: '0', 'aria-label': `Batch ${b.seq}, ${b.l2Blocks} blocks, posting delay ${b.postingDelay !== undefined ? fmtAge(b.postingDelay) : 'unknown'}` }), x0, RULER_Y, w, RULER_H)
      if (w > 54) seg.append(h('span', { class: 'segl' }, `#${b.seq}`))
      const open = () => selectBatch(b.seq)
      seg.addEventListener('click', open); seg.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } if (e.key === 'ArrowLeft') (seg.previousElementSibling as HTMLElement)?.focus(); if (e.key === 'ArrowRight') (seg.nextElementSibling as HTMLElement)?.focus() })
      tooltip(seg, () => `<b>batch #${b.seq}</b><br>${b.l2Blocks!.toLocaleString('en-US')} blocks · ${b.l2FirstBlock!.toLocaleString('en-US')} → ${b.l2LastBlock!.toLocaleString('en-US')}<br>${b.postingDelay !== undefined ? `last block waited ${fmtAge(b.postingDelay)} to land` : 'posting delay resolving'}<br>${b.daMode === 'anytrust' ? 'AnyTrust certificate' : b.daMode} · ${b.dataBytes} bytes · landed ${fmtTime(b.l1Time)}<br><span class="dim">click for details</span>`)
      segs.append(seg)
      // stem for posting delay, from the segment's right edge (its last block)
      if (b.postingDelay !== undefined) {
        const hgt = Math.max(2, (b.postingDelay / maxDelay) * STEM_MAX)
        const stem = at(h('div', { class: 'stem' + (b.seq === state.selectedBatch ? ' sel' : '') }), x1 - 3, STEM_BASE - hgt, 2, hgt)
        stem.dataset.seq = String(b.seq); segs.append(stem)
        const cap = at(h('div', { class: 'stemcap' + (b.daMode === 'fulldata' ? ' full' : '') }), x1 - 7, STEM_BASE - hgt - 5, 10, 10); segs.append(cap)
      }
    })
    if (waiting > 0) {
      const x0 = x(list.at(-1)!.l2LastBlock! + 1)
      const tail = at(h('div', { class: 'seg wait' }), x0, RULER_Y, Math.max(2, CW - x0), RULER_H)
      tooltip(tail, () => `<b>${waiting.toLocaleString('en-US')} blocks waiting</b><br>not yet in a batch · ${s.elysium.unbatchedSeconds ? fmtAge(s.elysium.unbatchedSeconds) + ' behind head' : ''}`)
      segs.append(tail)
      axis.append(txt(CW, RULER_Y + RULER_H + 46, `${waiting.toLocaleString('en-US')} blocks waiting →`, 'ink', 'end'))
    }
    if (animate) { gsap.from(segs.querySelectorAll('.seg'), { scaleX: 0, transformOrigin: 'left', duration: .4, stagger: .01, ease: 'power3.out', overwrite: true }); gsap.from(segs.querySelectorAll('.stem, .stemcap'), { opacity: 0, y: 6, duration: .3, delay: .35, stagger: .01, ease: 'power2.out', overwrite: true }) }
    drawFacts(); if (insp.open) drawInspector()
  }
  function drawFacts() {
    const s = state.snapshot; if (!s) return
    const list = s.batches.filter((b) => b.l2Blocks); const last = list.at(-1)
    const delays = list.map((b) => b.postingDelay).filter((x): x is number => x !== undefined)
    const med = delays.length ? [...delays].sort((a, b) => a - b)[Math.floor(delays.length / 2)] : 0
    const blocks = list.map((b) => b.l2Blocks!); const medB = blocks.length ? [...blocks].sort((a, b) => a - b)[Math.floor(blocks.length / 2)] : 0
    facts.set([
      { k: 'newest batch', v: last ? `#${last.seq}` : '—', s: last ? `landed ${fmtTime(last.l1Time)} · every ${s.health.batches.medianInterval ? fmtAge(s.health.batches.medianInterval) : '…'}` : '' },
      { k: 'blocks per batch', v: medB ? medB.toLocaleString('en-US') : '—', s: 'median · the segment width', cls: 'hl' },
      { k: 'posting delay', v: med ? fmtAge(med) : '—', s: 'median wait from last block to landing · the stems' },
      { k: 'waiting now', v: s.elysium.unbatchedBlocks ? s.elysium.unbatchedBlocks.toLocaleString('en-US') : '0', s: s.elysium.unbatchedSeconds ? `${fmtAge(s.elysium.unbatchedSeconds)} behind head · the hatched tail` : 'caught up', cls: s.elysium.unbatchedSeconds > 900 ? 'amber' : '' },
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
    for (const n of Array.from(segs.children) as HTMLElement[]) { if (n.classList.contains('seg')) n.classList.toggle('sel', n.getAttribute('aria-label')?.startsWith(`Batch ${b.seq},`) ?? false); if (n.classList.contains('stem')) n.classList.toggle('sel', n.dataset.seq === String(b.seq)) }
  }
  state.onSnapshot.on(() => { if (el.style.display !== 'none') draw() })
  state.onSelectBatch.on((seq) => { if (el.style.display === 'none') return; if (seq === null) insp.hide(); else drawInspector() })
  state.onNet.on(() => { segs.innerHTML = ''; sig = ''; insp.hide() })
  return { el, onShow: () => { draw(true); if (state.selectedBatch) drawInspector() } }
}
