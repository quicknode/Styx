import gsap from 'gsap'
import { h, at, layer, s as svg, txt } from '../dom'
import { state, selectBatch } from '../state'
import { chip, copyBtn, link, tooltip } from '../ui'
import { titleRow, hero, Facts, Inspector, ikv, ROW } from '../layout'
import { fmtAge, fmtTime, short, type Batch } from '../api'

type Metric = 'delay' | 'blocks' | 'bytes'
const LABEL: Record<Metric, string> = { delay: 'posting delay', blocks: 'blocks per batch', bytes: 'payload bytes' }

/** Batches: one chart. Hover for the tooltip, click (or arrow keys + Enter) for the inspector. */
export function batchesTab() {
  const el = h('div')
  let metric: Metric = 'delay'
  const { controls } = titleRow(el, 'Every batch, <em>as it landed</em>.')
  const chips: Record<Metric, HTMLButtonElement> = { delay: chip(LABEL.delay, 'on ely'), blocks: chip(LABEL.blocks, 'ely'), bytes: chip(LABEL.bytes, 'ely') }
  ;(Object.keys(chips) as Metric[]).forEach((k) => { chips[k].setAttribute('aria-pressed', String(k === metric)); chips[k].addEventListener('click', () => { metric = k; for (const kk of Object.keys(chips) as Metric[]) { chips[kk].classList.toggle('on', kk === k); chips[kk].setAttribute('aria-pressed', String(kk === k)) } draw(true) }); controls.append(chips[k]) })

  const CH = ROW.heroH
  const chart = hero(el, CH); chart.setAttribute('role', 'img'); chart.setAttribute('aria-label', 'Bar chart of recent batches')
  const axis = layer(chart.offsetWidth || 1776, CH); chart.append(axis)
  const bars = h('div', { style: 'position:absolute;inset:0', role: 'list' }); chart.append(bars)
  const facts = new Facts(el)
  const insp = new Inspector(el, facts)
  const CW = 1776

  const value = (b: Batch, m: Metric) => m === 'delay' ? (b.postingDelay ?? -1) : m === 'blocks' ? (b.l2Blocks ?? 0) : b.dataBytes
  let list: Batch[] = []
  let sig = ''
  function draw(force = false) {
    const next = (state.snapshot?.batches ?? []).slice(-48)
    const nsig = metric + ':' + next.map((b) => `${b.seq}.${value(b, metric)}`).join(',')
    if (!force && nsig === sig) { drawFacts(); if (insp.open) drawInspector(); return }
    const animate = force || !sig || list.at(-1)?.seq !== next.at(-1)?.seq
    sig = nsig; list = next
    bars.innerHTML = ''; axis.innerHTML = ''
    if (!list.length) return
    const vals = list.map((b) => value(b, metric)).filter((v) => v >= 0)
    const max = Math.max(1, ...vals)
    const bw = CW / list.length
    axis.append(svg('path', { class: 'hair2', d: `M 0 ${CH - 28} H ${CW}` }))
    ;[0.5, 1].forEach((f) => { const y = CH - 28 - (CH - 60) * f; axis.append(svg('path', { class: 'hair', d: `M 0 ${y} H ${CW}` })); axis.append(txt(0, y - 6, metric === 'delay' ? fmtAge(max * f) : Math.round(max * f).toLocaleString('en-US'))) })
    axis.append(txt(0, CH - 8, `#${list[0].seq}`)); axis.append(txt(CW, CH - 8, `#${list.at(-1)!.seq} · newest`, '', 'end'))
    list.forEach((b, i) => {
      const v = value(b, metric); const un = v < 0; const hgt = un ? 6 : Math.max(3, (v / max) * (CH - 60))
      const bar = h('div', { class: 'bar ' + (un ? 'paper' : b.daMode === 'fulldata' ? 'hatch' : '') + (b.seq === state.selectedBatch ? ' sel' : ''), role: 'listitem', tabindex: '0', 'aria-label': `Batch ${b.seq}, ${LABEL[metric]} ${un ? 'unknown' : metric === 'delay' ? fmtAge(v) : v}` })
      at(bar, i * bw + 3, 0, Math.max(3, bw - 6), hgt); bar.style.top = ''; bar.style.bottom = '28px'
      const open = () => selectBatch(b.seq)
      bar.addEventListener('click', open)
      bar.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } if (e.key === 'ArrowLeft') (bar.previousElementSibling as HTMLElement)?.focus(); if (e.key === 'ArrowRight') (bar.nextElementSibling as HTMLElement)?.focus() })
      tooltip(bar, () => `<b>batch #${b.seq}</b><br>${LABEL[metric]}: ${un ? 'resolving…' : metric === 'delay' ? fmtAge(v) : v.toLocaleString('en-US')}<br>landed ${fmtTime(b.l1Time)}<br><span class="dim">click for details</span>`)
      bars.append(bar)
    })
    if (animate) gsap.from(bars.children, { scaleY: 0, duration: .3, stagger: .004, ease: 'power3.out', overwrite: true })
    drawFacts(); if (insp.open) drawInspector()
  }
  function drawFacts() {
    const s = state.snapshot; if (!s) return
    const last = list.at(-1); const delays = list.map((b) => b.postingDelay).filter((x): x is number => x !== undefined)
    const med = delays.length ? [...delays].sort((a, b) => a - b)[Math.floor(delays.length / 2)] : 0
    facts.set([
      { k: 'newest batch', v: last ? `#${last.seq}` : '—', s: last ? `landed ${fmtTime(last.l1Time)}` : '' },
      { k: 'cadence', v: s.health.batches.medianInterval ? `every ${fmtAge(s.health.batches.medianInterval)}` : 'measuring', s: s.health.batches.medianInterval ? 'median of the last 12' : 'needs two batches' },
      { k: 'typical posting delay', v: med ? fmtAge(med) : '—', s: 'last block to HyperEVM inclusion' },
      { k: 'data availability', v: last?.daMode === 'anytrust' ? 'AnyTrust <em>cert</em>' : last?.daMode ?? '—', s: last ? `header ${last.daHeader} · ${last.dataBytes} bytes` : '' },
    ])
  }
  let shownSeq = -1
  function drawInspector() {
    const s = state.snapshot; const b = s?.batches.find((x) => x.seq === state.selectedBatch); if (!s || !b) return
    if (insp.open && shownSeq === b.seq && b.postingDelay !== undefined) return
    shownSeq = b.seq
    insp.show(`batch #${b.seq}`, (body) => {
      body.append(
        ikv('elysium blocks', b.l2Blocks ? `${b.l2Blocks.toLocaleString('en-US')}` : '—', b.l2FirstBlock ? `${b.l2FirstBlock.toLocaleString('en-US')} → ${b.l2LastBlock!.toLocaleString('en-US')}` : ''),
        ikv('posting delay', b.postingDelay !== undefined ? `${fmtAge(b.postingDelay)} <em>after</em>` : 'resolving…', b.l2LastTime ? `block ${fmtTime(b.l2LastTime)} → landed ${fmtTime(b.l1Time)}` : ''),
        ikv('data', b.daMode === 'anytrust' ? 'AnyTrust <em>cert</em>' : b.daMode, `header ${b.daHeader} · ${b.dataBytes} bytes`),
        ikv('on hyperevm', `<span style="font-family:var(--mono);font-size:24px">block ${b.l1Block.toLocaleString('en-US')}</span>`, 'tx '),
      )
      const links = body.lastElementChild!.querySelector('.s')!
      links.append(link(`${s.network.explorer.hyperevm}/tx/${b.txHash}`, short(b.txHash)), copyBtn(b.txHash))
    })
    for (const bar of Array.from(bars.children)) bar.classList.toggle('sel', (bar as HTMLElement).getAttribute('aria-label')?.startsWith(`Batch ${b.seq},`) ?? false)
  }
  state.onSnapshot.on(() => { if (el.style.display !== 'none') draw() })
  state.onSelectBatch.on((seq) => { if (seq === null) insp.hide(); else drawInspector() })
  state.onNet.on(() => { bars.innerHTML = ''; sig = ''; insp.hide() })
  return { el, onShow: () => { draw(true); if (state.selectedBatch) drawInspector() } }
}
