import gsap from 'gsap'
import { h, at, layer, s as svg, txt, G } from '../dom'
import { state, selectBatch } from '../state'
import { chip, copyBtn, link, row, tooltip, enter } from '../ui'
import { fmtAge, fmtTime, short, type Batch } from '../api'

type Metric = 'delay' | 'blocks' | 'bytes'
const LABEL: Record<Metric, string> = { delay: 'posting delay', blocks: 'blocks per batch', bytes: 'payload bytes' }

/** Batches: a chart of the last 60 batches you can hover and click, a table, and a detail card for the selected one. */
export function batchesTab() {
  const el = h('div')
  let metric: Metric = 'delay'
  const title = at(h('div', { class: 'h2', html: 'Every batch, <em>as it landed</em>.' }), G.x(1), 16); title.className = 'h2'; el.append(title)
  const chips = at(h('div', { style: 'position:absolute;display:flex;gap:8px' }), G.x(7), 20, G.w(6)); el.append(chips)
  const chipEls: Record<Metric, HTMLButtonElement> = { delay: chip(LABEL.delay, 'on ely'), blocks: chip(LABEL.blocks, 'ely'), bytes: chip(LABEL.bytes, 'ely') }
  ;(Object.keys(chipEls) as Metric[]).forEach((k) => { chipEls[k].addEventListener('click', () => { metric = k; for (const kk of Object.keys(chipEls) as Metric[]) chipEls[kk].classList.toggle('on', kk === k); drawChart() }); chips.append(chipEls[k]) })

  // chart
  const CX = G.x(1), CY = 80, CW = G.w(7), CH = 170
  const chart = at(h('div', { style: 'position:absolute' }), CX, CY, CW, CH); el.append(chart)
  const axis = layer(CW, CH); chart.append(axis)
  const bars = h('div', { style: 'position:absolute;inset:0' }); chart.append(bars)
  const axisLbl = at(h('div', { class: 'lbl' }, ''), CX, CY + CH + 10); el.append(axisLbl)
  const axisR = at(h('div', { class: 'lbl', style: 'text-align:right' }, ''), CX + CW - 300, CY + CH + 10, 300); el.append(axisR)

  // table
  const widths = [90, 150, 230, 130, 150, 160, 120]
  const table = at(h('div', { class: 'table' }), G.x(1), CY + CH + 48, G.w(7)); el.append(table)
  const head = h('div', { class: 'th' }); ['batch', 'landed', 'elysium blocks', 'count', 'posting delay', 'data', 'hyperevm tx'].forEach((t, i) => head.append(h('div', { class: 'td', style: `width:${widths[i]}px` }, t))); table.append(head)
  const body = h('div', { class: 'tbody' }); table.append(body)

  // detail card
  const DX = G.x(9), DY = 80, DW = G.w(4)
  const card = at(h('div', { class: 'panel ely' }, [h('span', { class: 'panel-title ely' }, 'Selected batch')]), DX, DY, DW, 520); el.append(card)
  const cardBody = h('div', { style: 'position:absolute;inset:0' }); card.append(cardBody)

  function value(b: Batch, m: Metric) { return m === 'delay' ? (b.postingDelay ?? -1) : m === 'blocks' ? (b.l2Blocks ?? 0) : b.dataBytes }
  function drawChart() {
    const list = (state.snapshot?.batches ?? []).slice(-60)
    bars.innerHTML = ''; axis.innerHTML = ''
    if (!list.length) return
    const max = Math.max(1, ...list.map((b) => value(b, metric)).filter((v) => v >= 0))
    const bw = CW / list.length
    axis.append(svg('path', { class: 'hair2', d: `M 0 ${CH} H ${CW}` }))
    ;[0.5, 1].forEach((f) => { axis.append(svg('path', { class: 'hair', d: `M 0 ${CH - CH * f} H ${CW}` })); axis.append(txt(0, CH - CH * f - 4, metric === 'delay' ? fmtAge(max * f) : Math.round(max * f).toLocaleString('en-US'))) })
    list.forEach((b, i) => {
      const v = value(b, metric); const unresolved = v < 0; const hgt = unresolved ? 6 : Math.max(2, (v / max) * (CH - 24))
      const bar = at(h('div', { class: 'bar ' + (unresolved ? 'paper' : b.daMode === 'fulldata' ? 'hatch' : b.seq === state.selectedBatch ? 'ely-ink' : '') + (b.seq === state.selectedBatch ? ' sel' : '') }), i * bw + 2, CH - hgt, Math.max(2, bw - 4), hgt)
      bar.style.top = ''; bar.style.height = hgt + 'px'
      bar.addEventListener('click', () => selectBatch(b.seq))
      tooltip(bar, () => `<b>batch #${b.seq}</b><br>${LABEL[metric]}: ${unresolved ? 'resolving…' : metric === 'delay' ? fmtAge(v) : v.toLocaleString('en-US')}<br>landed ${fmtTime(b.l1Time)} · ${b.daMode}<br><span class="dim">click to select</span>`)
      bars.append(bar)
    })
    gsap.from(bars.children, { scaleY: 0, duration: .5, stagger: .008, ease: 'power3.out' })
    axisLbl.textContent = `#${list[0].seq}`; axisR.textContent = `#${list.at(-1)!.seq} · ${LABEL[metric]}`
  }
  function drawTable() {
    const list = (state.snapshot?.batches ?? []).slice(-9).reverse()
    body.innerHTML = ''
    for (const b of list) {
      const r = row([
        `<span class="mono">#${b.seq}</span>`, fmtTime(b.l1Time),
        b.l2FirstBlock ? `${b.l2FirstBlock.toLocaleString('en-US')} → ${b.l2LastBlock!.toLocaleString('en-US')}` : '—',
        b.l2Blocks ? b.l2Blocks.toLocaleString('en-US') : '—', b.postingDelay !== undefined ? fmtAge(b.postingDelay) : '…',
        b.daMode === 'anytrust' ? `cert ${b.daHeader} · ${b.dataBytes} B` : `${b.daMode} · ${b.dataBytes} B`,
        '',
      ], widths, 'click' + (b.seq === state.selectedBatch ? ' sel' : ''))
      r.querySelectorAll('.td').forEach((td, i) => { if ([0, 2, 3, 4, 5].includes(i)) td.classList.add('mono') })
      r.children[6].append(link(`${state.snapshot!.network.explorer.hyperevm}/tx/${b.txHash}`, short(b.txHash)))
      r.addEventListener('click', () => selectBatch(b.seq))
      body.append(r)
    }
    enter(body.children, .03)
  }
  function drawCard() {
    const s = state.snapshot; if (!s) return
    const b = s.batches.find((x) => x.seq === state.selectedBatch) ?? s.batches.at(-1); if (!b) return
    cardBody.innerHTML = ''
    const kv = (x: number, y: number, k: string, v: string, sub = '', mono = false) => cardBody.append(at(h('div', { class: 'kv' }, [h('div', { class: 'k' }, k), h('div', { class: 'v' + (mono ? ' mono' : ''), html: v }), ...(sub ? [h('div', { class: 's', html: sub })] : [])]), x, y))
    kv(28, 36, 'batch', `#${b.seq}`, `landed ${fmtTime(b.l1Time)} · HyperEVM block ${b.l1Block.toLocaleString('en-US')}`)
    kv(28, 130, 'elysium blocks', b.l2Blocks ? `${b.l2Blocks.toLocaleString('en-US')} <em>blocks</em>` : '—', b.l2FirstBlock ? `${b.l2FirstBlock.toLocaleString('en-US')} → ${b.l2LastBlock!.toLocaleString('en-US')}` : '')
    kv(28, 224, 'posting delay', b.postingDelay !== undefined ? `${fmtAge(b.postingDelay)} <em>after</em> its last block` : 'resolving…', b.l2LastTime ? `last block ${fmtTime(b.l2LastTime)} → landed ${fmtTime(b.l1Time)}` : '')
    kv(28, 318, 'data availability', b.daMode === 'anytrust' ? 'AnyTrust <em>certificate</em>' : b.daMode === 'fulldata' ? 'Full data <em>fallback</em>' : b.daMode, `header byte ${b.daHeader} · ${b.dataBytes} bytes of calldata`)
    const links = at(h('div', { style: 'position:absolute;display:flex;flex-direction:column;gap:10px' }), 28, 418)
    links.append(h('div', { class: 's', style: 'font-family:var(--mono);font-size:12px;letter-spacing:.06em;color:var(--ink-50)' }, ['HyperEVM tx ', link(`${s.network.explorer.hyperevm}/tx/${b.txHash}`, short(b.txHash)), copyBtn(b.txHash)]))
    if (b.l2LastBlock) links.append(h('div', { class: 's', style: 'font-family:var(--mono);font-size:12px;letter-spacing:.06em;color:var(--ink-50)' }, ['Last Elysium block ', link(`${s.network.explorer.elysium}/block/${b.l2LastBlock}`, b.l2LastBlock.toLocaleString('en-US'))]))
    cardBody.append(links)
    // a small dimension line: last L2 block time → L1 inclusion
    const sv = layer(DW, 520); cardBody.append(sv)
    if (b.postingDelay !== undefined) {
      const y = 300; const x1 = 28, x2 = DW - 28
      const p = svg('path', { class: 'ln ely', d: `M ${x1} ${y + 6} V ${y} H ${x2} V ${y + 6}` }); sv.append(p)
      const len = p.getTotalLength(); p.style.strokeDasharray = String(len); p.style.strokeDashoffset = String(len)
      gsap.to(p, { strokeDashoffset: 0, duration: .9, ease: 'power2.out' })
    }
    enter(cardBody.querySelectorAll('.kv'), .06)
  }
  const refresh = () => { drawChart(); drawTable(); drawCard() }
  state.onSnapshot.on(() => { if (el.style.display !== 'none') refresh() })
  state.onSelectBatch.on(() => { if (el.style.display !== 'none') refresh() })
  state.onNet.on(() => { bars.innerHTML = ''; body.innerHTML = ''; cardBody.innerHTML = '' })
  return { el, onShow: refresh }
}
