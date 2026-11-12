import gsap from 'gsap'
import { h, at, layer, s as svg, txt, G } from '../dom'
import { state } from '../state'
import { chip, link, row, tooltip, enter } from '../ui'
import { fmtTime, short, type BridgeMsg, type Withdrawal } from '../api'

type Kind = 'hype' | 'retryable' | 'other' | 'withdrawals'
const KL: Record<Kind, string> = { hype: 'HYPE deposits', retryable: 'token retryables', other: 'L2 messages', withdrawals: 'withdrawals' }
const KC: Record<Kind, string> = { hype: 'hl', retryable: 'paper', other: 'ely', withdrawals: 'ely-ink' }

/** Bridge: a per-minute histogram you can filter by kind and hover, a live feed of recent crossings, and counts. */
export function bridgeTab() {
  const el = h('div')
  el.append(at(h('div', { class: 'h2', html: 'What crossed the bridge, <em>minute by minute</em>.' }), G.x(1), 16))
  const on: Record<Kind, boolean> = { hype: true, retryable: true, other: true, withdrawals: true }
  let windowMin = 60
  const chips = at(h('div', { style: 'position:absolute;display:flex;gap:8px' }), G.x(6), 20, G.w(7)); el.append(chips)
  const kindChips: Record<Kind, HTMLButtonElement> = { hype: chip(KL.hype, 'on hl'), retryable: chip(KL.retryable, 'on'), other: chip(KL.other, 'on ely'), withdrawals: chip(KL.withdrawals, 'on ely') }
  ;(Object.keys(kindChips) as Kind[]).forEach((k) => { kindChips[k].addEventListener('click', () => { on[k] = !on[k]; kindChips[k].classList.toggle('on', on[k]); draw() }); chips.append(kindChips[k]) })
  const sep = h('span', { style: 'width:1px;background:var(--rule-strong);margin:0 6px' }); chips.append(sep)
  const w60 = chip('60 min', 'on'); const w180 = chip('3 h', '')
  w60.addEventListener('click', () => { windowMin = 60; w60.classList.add('on'); w180.classList.remove('on'); draw() })
  w180.addEventListener('click', () => { windowMin = 180; w180.classList.add('on'); w60.classList.remove('on'); draw() })
  chips.append(w60, w180)

  const CX = G.x(1), CY = 84, CW = G.w(12), CH = 210
  const chart = at(h('div', { style: 'position:absolute' }), CX, CY, CW, CH); el.append(chart)
  const axis = layer(CW, CH); chart.append(axis)
  const bars = h('div', { style: 'position:absolute;inset:0' }); chart.append(bars)
  const totals = at(h('div', { style: 'position:absolute;display:flex;gap:96px' }), G.x(1), CY + CH + 40); el.append(totals)
  const feed = at(h('div', { class: 'table' }), G.x(1), CY + CH + 150, G.w(12)); el.append(feed)
  const widths = [160, 320, 260, 320]
  const head = h('div', { class: 'th' }); ['when', 'kind', 'hyperevm block', 'transaction'].forEach((t, i) => head.append(h('div', { class: 'td', style: `width:${widths[i]}px` }, t))); feed.append(head)
  const body = h('div'); feed.append(body)
  const recent: ({ kind: Kind; t: number; blk: number; tx: string; note: string })[] = []

  function draw() {
    const s = state.snapshot; if (!s) return
    const hist = s.histogram.slice(-windowMin)
    const kinds = (Object.keys(on) as Kind[]).filter((k) => on[k])
    const max = Math.max(1, ...hist.map((m) => kinds.reduce((a, k) => a + m[k], 0)))
    bars.innerHTML = ''; axis.innerHTML = ''
    axis.append(svg('path', { class: 'hair2', d: `M 0 ${CH} H ${CW}` }))
    ;[0.5, 1].forEach((f) => { axis.append(svg('path', { class: 'hair', d: `M 0 ${CH - CH * f} H ${CW}` })); axis.append(txt(0, CH - CH * f - 4, Math.round(max * f).toLocaleString('en-US') + ' / min')) })
    const bw = CW / hist.length
    hist.forEach((m, i) => {
      let y = CH
      for (const k of kinds) {
        const v = m[k]; if (!v) continue
        const hgt = (v / max) * (CH - 24)
        const bar = at(h('div', { class: 'bar ' + KC[k] }), i * bw + 1, 0, Math.max(1, bw - 2), hgt)
        bar.style.top = ''; bar.style.bottom = (CH - y) + 'px'; bar.style.height = hgt + 'px'
        tooltip(bar, () => `<b>${fmtTime(m.minute * 60)}</b><br>${kinds.map((kk) => `${KL[kk]}: ${m[kk]}`).join('<br>')}`)
        bars.append(bar); y -= hgt
      }
    })
    gsap.from(bars.children, { scaleY: 0, duration: .5, stagger: .003, ease: 'power3.out' })
    const sum = (k: Kind) => hist.reduce((a, m) => a + m[k], 0)
    totals.innerHTML = ''
    for (const k of Object.keys(KL) as Kind[]) totals.append(h('div', { class: 'kv', style: 'position:relative' }, [h('div', { class: 'k' }, KL[k] + ` · ${windowMin === 60 ? 'last hour' : 'last 3 h'}`), h('div', { class: 'v' + (on[k] ? '' : ' dim'), style: on[k] ? '' : 'color:var(--ink-30)' }, sum(k).toLocaleString('en-US'))]))
    enter(totals.children, .05)
    drawFeed()
  }
  function drawFeed() {
    body.innerHTML = ''
    const s = state.snapshot; if (!s) return
    for (const r of recent.slice(0, 4)) {
      const rr = row([fmtTime(r.t), `<span class="chipbtn on ${KC[r.kind] === 'paper' ? '' : KC[r.kind] === 'hl' ? 'hl' : 'ely'}" style="height:28px;font-size:12px">${KL[r.kind]}</span>`, r.blk.toLocaleString('en-US'), ''], widths)
      rr.children[3].append(link(`${s.network.explorer.hyperevm}/tx/${r.tx}`, short(r.tx)))
      ;[0, 2].forEach((i) => rr.children[i].classList.add('mono'))
      body.append(rr)
    }
    enter(body.children, .03)
  }
  const seedFromSnapshot = (s: typeof state.snapshot) => {
    if (!s || recent.length) return
    for (const d of s.bridge.deposits.slice(-20)) recent.unshift({ kind: d.kind === 12 ? 'hype' : d.kind === 9 ? 'retryable' : 'other', t: d.l1Time, blk: d.l1Block, tx: d.txHash, note: d.kindLabel })
    for (const w of s.bridge.withdrawals.slice(-5)) recent.unshift({ kind: 'withdrawals', t: w.l1Time, blk: w.l1Block, tx: w.txHash, note: 'executed from the outbox' })
    recent.sort((a, b) => b.t - a.t)
  }
  state.onSnapshot.on((s) => { seedFromSnapshot(s); if (el.style.display !== 'none') draw() })
  state.onDeposit.on((m: BridgeMsg) => { recent.unshift({ kind: m.kind === 12 ? 'hype' : m.kind === 9 ? 'retryable' : 'other', t: m.l1Time, blk: m.l1Block, tx: m.txHash, note: m.kindLabel }); if (recent.length > 60) recent.pop(); if (el.style.display !== 'none') drawFeed() })
  state.onWithdrawal.on((w: Withdrawal) => { recent.unshift({ kind: 'withdrawals', t: w.l1Time, blk: w.l1Block, tx: w.txHash, note: 'executed from the outbox' }); if (el.style.display !== 'none') drawFeed() })
  state.onNet.on(() => { recent.length = 0; bars.innerHTML = ''; body.innerHTML = '' })
  return { el, onShow: draw }
}
