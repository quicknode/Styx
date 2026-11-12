import gsap from 'gsap'
import { h, at, layer, s as svg, txt } from '../dom'
import { state, selectBatch } from '../state'
import { chip, copyBtn, link, tooltip } from '../ui'
import { titleRow, hero, Facts, Inspector, ikv, ROW } from '../layout'
import { fmtTime, short, type Batch } from '../api'

type Metric = 'fee' | 'gas' | 'price'
const LABEL: Record<Metric, string> = { fee: 'fee per batch', gas: 'gas per batch', price: 'gas price' }
const hype = (x: number) => x >= 1 ? `${x.toFixed(3)} HYPE` : x >= 0.001 ? `${x.toFixed(4)} HYPE` : `${(x * 1e6).toFixed(1)} µHYPE`

/** Bill: what it costs to settle Elysium on HyperEVM, read from each batch transaction's receipt. */
export function billTab() {
  const el = h('div')
  let metric: Metric = 'fee'
  const { controls } = titleRow(el, 'What settling <em>costs</em>, on HyperEVM.')
  const chips: Record<Metric, HTMLButtonElement> = { fee: chip(LABEL.fee, 'on ely'), gas: chip(LABEL.gas, 'ely'), price: chip(LABEL.price, 'ely') }
  ;(Object.keys(chips) as Metric[]).forEach((k) => { chips[k].setAttribute('aria-pressed', String(k === metric)); chips[k].addEventListener('click', () => { metric = k; for (const kk of Object.keys(chips) as Metric[]) { chips[kk].classList.toggle('on', kk === k); chips[kk].setAttribute('aria-pressed', String(kk === k)) } draw(true) }); controls.append(chips[k]) })
  const CH = ROW.heroH, CW = 1776
  const chart = hero(el, CH); chart.setAttribute('role', 'img'); chart.setAttribute('aria-label', 'Settlement cost per batch')
  const axis = layer(CW, CH); chart.append(axis)
  const bars = h('div', { style: 'position:absolute;inset:0', role: 'list' }); chart.append(bars)
  const facts = new Facts(el)
  const insp = new Inspector(el, facts)
  const note = at(h('p', { class: 'home-next' }, 'Every batch is one HyperEVM transaction from the batch poster. Fee = gas used × effective gas price, from the receipt. Assertion and bridge transactions are not included.'), 72, ROW.facts + 124, CW); el.append(note)
  const value = (b: Batch) => metric === 'fee' ? (b.feeHype ?? -1) : metric === 'gas' ? (b.gasUsed ?? -1) : (b.gasPriceGwei ?? -1)
  const fmtV = (v: number) => metric === 'fee' ? hype(v) : metric === 'gas' ? `${Math.round(v).toLocaleString('en-US')} gas` : `${v.toFixed(3)} gwei`
  let list: Batch[] = []; let sig = ''; let shownSeq = -1
  function draw(force = false) {
    const next = (state.snapshot?.batches ?? []).slice(-48)
    const nsig = metric + ':' + next.map((b) => `${b.seq}.${value(b)}`).join(',')
    if (!force && nsig === sig) { drawFacts(); if (insp.open) drawInspector(); return }
    const animate = force || !sig || list.at(-1)?.seq !== next.at(-1)?.seq
    sig = nsig; list = next
    bars.innerHTML = ''; axis.innerHTML = ''
    if (!list.length) return
    const vals = list.map(value).filter((v) => v >= 0); const max = Math.max(1e-12, ...vals)
    const bw = CW / list.length
    axis.append(svg('path', { class: 'hair2', d: `M 0 ${CH - 28} H ${CW}` }))
    ;[0.5, 1].forEach((f) => { const y = CH - 28 - (CH - 60) * f; axis.append(svg('path', { class: 'hair', d: `M 0 ${y} H ${CW}` })); axis.append(txt(0, y - 6, fmtV(max * f))) })
    axis.append(txt(0, CH - 8, `#${list[0].seq}`)); axis.append(txt(CW, CH - 8, `#${list.at(-1)!.seq} · newest`, '', 'end'))
    list.forEach((b, i) => {
      const v = value(b); const un = v < 0; const hgt = un ? 6 : Math.max(3, (v / max) * (CH - 60))
      const bar = h('div', { class: 'bar ' + (un ? 'paper' : b.forced ? 'hatch' : b.seq === state.selectedBatch ? 'ely-ink' : '') + (b.seq === state.selectedBatch ? ' sel' : ''), role: 'listitem', tabindex: '0', 'aria-label': `Batch ${b.seq}, ${LABEL[metric]} ${un ? 'unknown' : fmtV(v)}` })
      at(bar, i * bw + 3, 0, Math.max(3, bw - 6), hgt); bar.style.top = ''; bar.style.bottom = '28px'
      bar.addEventListener('click', () => selectBatch(b.seq))
      bar.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectBatch(b.seq) } })
      tooltip(bar, () => `<b>batch #${b.seq}</b><br>${un ? 'receipt pending' : `${hype(b.feeHype!)} · ${b.gasUsed!.toLocaleString('en-US')} gas · ${b.gasPriceGwei!.toFixed(3)} gwei`}<br>${b.l2Blocks ? b.l2Blocks.toLocaleString('en-US') + ' Elysium blocks · ' : ''}${fmtTime(b.l1Time)}${b.forced ? '<br><b>forced inclusion</b>' : ''}<br><span class="dim">click for details</span>`)
      bars.append(bar)
    })
    if (animate) gsap.from(bars.children, { scaleY: 0, duration: .3, stagger: .004, ease: 'power3.out', overwrite: true })
    drawFacts(); if (insp.open) drawInspector()
  }
  function drawFacts() {
    const c = state.snapshot?.costs; if (!c) return
    facts.set([
      { k: 'last batch', v: c.last ? hype(c.last.feeHype) : '—', s: c.last ? `#${c.last.seq} · ${c.last.gasUsed.toLocaleString('en-US')} gas · ${c.last.gasPriceGwei.toFixed(3)} gwei` : '' },
      { k: 'last 24 h', v: hype(c.day.feeHype), s: `${c.day.batches} batches · ${(c.day.gasUsed / 1e6).toFixed(1)} M gas` },
      { k: 'per elysium block', v: c.perBlockHype ? hype(c.perBlockHype) : '—', s: c.day.elysiumBlocks ? `${c.day.elysiumBlocks.toLocaleString('en-US')} blocks settled in 24 h` : '' },
      { k: 'typical batch', v: c.perBatchMedianHype ? hype(c.perBatchMedianHype) : '—', s: 'median over 24 h' },
    ])
  }
  function drawInspector() {
    const s = state.snapshot; const b = s?.batches.find((x) => x.seq === state.selectedBatch); if (!s || !b) return
    if (insp.open && shownSeq === b.seq && b.feeHype !== undefined) return
    shownSeq = b.seq
    insp.show(`batch #${b.seq}`, (body) => {
      body.append(
        ikv('fee', b.feeHype !== undefined ? hype(b.feeHype) : 'receipt pending', b.gasUsed ? `${b.gasUsed.toLocaleString('en-US')} gas × ${b.gasPriceGwei!.toFixed(3)} gwei` : ''),
        ikv('settled', b.l2Blocks ? `${b.l2Blocks.toLocaleString('en-US')} <em>blocks</em>` : '—', b.l2Blocks && b.feeHype ? `${hype(b.feeHype / b.l2Blocks)} per block` : ''),
        ikv('payload', `${b.dataBytes} <em>bytes</em>`, b.daMode === 'anytrust' ? 'AnyTrust certificate' : b.daMode),
        ikv('poster', b.poster ? `<span style="font-family:var(--mono);font-size:22px">${short(b.poster)}</span>` : '—', b.forced ? 'forced inclusion' : 'tx '),
      )
      body.lastElementChild!.querySelector('.s')!.append(link(`${s.network.explorer.hyperevm}/tx/${b.txHash}`, short(b.txHash)), copyBtn(b.txHash))
    })
    for (const bar of Array.from(bars.children)) bar.classList.toggle('sel', (bar as HTMLElement).getAttribute('aria-label')?.startsWith(`Batch ${b.seq},`) ?? false)
  }
  state.onSnapshot.on(() => { if (el.style.display !== 'none') draw() })
  state.onSelectBatch.on((seq) => { if (el.style.display === 'none') return; if (seq === null) insp.hide(); else drawInspector() })
  state.onNet.on(() => { bars.innerHTML = ''; sig = ''; insp.hide() })
  return { el, onShow: () => draw(true) }
}
