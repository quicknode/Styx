import gsap from 'gsap'
import { h, at, layer, s as svg, txt } from '../dom'
import { state, selectBatch } from '../state'
import { copyBtn, link, tooltip } from '../ui'
import { titleRow, hero, Facts, Inspector, ikv, ROW } from '../layout'
import { fmtAge, fmtTime, short, type Batch } from '../api'

/** Batches on a 24 h timeline: one bar per batch at its landing time, height = blocks carried; the forming batch grows at the right edge. */
export function batchesTab() {
  const el = h('div')
  titleRow(el, 'Blocks into <em>batches</em>.')
  const legend = at(h('div', { class: 'legend' }), 72 + 1776 - 760, 14, 760); el.append(legend)
  legend.innerHTML = '<span><i class="lg lg-seg"></i>one batch · height = blocks it carried</span><span><i class="lg lg-wait"></i>forming now</span>'
  const CH = ROW.heroH, CW = 1776, SPAN = 24 * 3600
  const chart = hero(el, CH); chart.setAttribute('role', 'img'); chart.setAttribute('aria-label', 'Batches over the last 24 hours, height is blocks per batch')
  const axis = layer(CW, CH); chart.append(axis)
  const bars = h('div', { style: 'position:absolute;inset:0', role: 'list' }); chart.append(bars)
  const facts = new Facts(el)
  const insp = new Inspector(el, facts)

  let sig = ''; let shownSeq = -1
  function draw(force = false) {
    const s = state.snapshot; if (!s) return
    const now = s.now
    const list = s.batches.filter((b) => b.l2Blocks && now - b.l1Time <= SPAN)
    const waiting = s.elysium.unbatchedBlocks
    const nsig = list.map((b) => b.seq).join(',') + ':' + Math.floor(waiting / 100) + ':' + Math.floor(now / 120)
    if (!force && nsig === sig) { drawFacts(); if (insp.open) drawInspector(); return }
    const animate = force || !sig || !sig.startsWith(list.map((b) => b.seq).join(','))
    sig = nsig
    bars.innerHTML = ''; axis.innerHTML = ''
    const max = Math.max(1, waiting, ...list.map((b) => b.l2Blocks!))
    const x = (t: number) => CW - ((now - t) / SPAN) * CW
    const BW = 22
    const yOf = (n: number) => (n / max) * (CH - 64)
    axis.append(svg('path', { class: 'hair2', d: `M 0 ${CH - 28} H ${CW}` }))
    ;[0.5, 1].forEach((f) => { const y = CH - 28 - (CH - 64) * f; axis.append(svg('path', { class: 'hair', d: `M 0 ${y} H ${CW}` })); axis.append(txt(0, y - 6, `${Math.round(max * f).toLocaleString('en-US')} blocks`)) })
    for (let hrs = 0; hrs <= 24; hrs += 4) { const xx = x(now - hrs * 3600); axis.append(svg('path', { class: 'hair2', d: `M ${xx} ${CH - 28} V ${CH - 20}` })); axis.append(txt(xx, CH - 6, hrs ? `−${hrs} h` : 'now', hrs ? '' : 'ink', hrs === 24 ? 'start' : hrs ? 'middle' : 'end')) }
    list.forEach((b) => {
      const hgt = Math.max(3, yOf(b.l2Blocks!))
      const bar = at(h('div', { class: 'bar ' + (b.daMode === 'fulldata' ? 'hatch' : '') + (b.seq === state.selectedBatch ? ' sel' : ''), role: 'listitem', tabindex: '0', 'aria-label': `Batch ${b.seq}, ${b.l2Blocks} blocks, landed ${fmtTime(b.l1Time)}` }), x(b.l1Time) - BW / 2, 0, BW, hgt)
      bar.style.top = ''; bar.style.bottom = '28px'
      const open = () => selectBatch(b.seq)
      bar.addEventListener('click', open); bar.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } if (e.key === 'ArrowLeft') (bar.previousElementSibling as HTMLElement)?.focus(); if (e.key === 'ArrowRight') (bar.nextElementSibling as HTMLElement)?.focus() })
      tooltip(bar, () => `<b>batch #${b.seq}</b> · landed ${fmtTime(b.l1Time)}<br>${b.l2Blocks!.toLocaleString('en-US')} blocks (${b.l2FirstBlock!.toLocaleString('en-US')} → ${b.l2LastBlock!.toLocaleString('en-US')})<br>${b.postingDelay !== undefined ? `its last block waited ${fmtAge(b.postingDelay)} to land` : 'posting delay resolving'}<br>${b.daMode === 'anytrust' ? 'AnyTrust certificate' : b.daMode} · ${b.dataBytes} bytes<br><span class="dim">click for details</span>`)
      bars.append(bar)
    })
    if (waiting > 0) {
      const hgt = Math.max(3, yOf(waiting))
      const tail = at(h('div', { class: 'bar wait', 'aria-label': `${waiting} blocks waiting for the next batch` }), CW - BW, 0, BW, hgt)
      tail.style.top = ''; tail.style.bottom = '28px'
      tooltip(tail, () => `<b>forming now</b><br>${waiting.toLocaleString('en-US')} blocks waiting for batch #${(s.batches.at(-1)?.seq ?? 0) + 1}<br>${s.elysium.unbatchedSeconds ? `${fmtAge(s.elysium.unbatchedSeconds)} behind head` : ''}`)
      bars.append(tail)
      axis.append(txt(CW - BW - 8, CH - 28 - hgt - 8, `${waiting.toLocaleString('en-US')} waiting`, 'ink', 'end'))
    }
    if (animate) gsap.from(bars.children, { scaleY: 0, transformOrigin: 'bottom', duration: .35, stagger: .006, ease: 'power3.out', overwrite: true })
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
    for (const n of Array.from(bars.children)) n.classList.toggle('sel', (n as HTMLElement).getAttribute('aria-label')?.startsWith(`Batch ${b.seq},`) ?? false)
  }
  state.onSnapshot.on(() => { if (el.style.display !== 'none') draw() })
  state.onSelectBatch.on((seq) => { if (el.style.display === 'none') return; if (seq === null) insp.hide(); else drawInspector() })
  state.onNet.on(() => { bars.innerHTML = ''; sig = ''; insp.hide() })
  return { el, onShow: () => { draw(true); if (state.selectedBatch) drawInspector() } }
}
