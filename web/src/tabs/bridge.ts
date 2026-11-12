import gsap from 'gsap'
import { h, at, layer, s as svg, txt } from '../dom'
import { state } from '../state'
import { chip, link, tooltip } from '../ui'
import { titleRow, hero, Facts, ROW } from '../layout'
import { fmtTime, short, type BridgeMsg, type Withdrawal } from '../api'

type Kind = 'hype' | 'retryable' | 'other' | 'withdrawals'
const KL: Record<Kind, string> = { hype: 'HYPE deposits', retryable: 'token deposits', other: 'messages', withdrawals: 'withdrawals' }
const KS: Record<Kind, string> = { hype: 'HYPE', retryable: 'tokens', other: 'messages', withdrawals: 'withdrawals' }
const KC: Record<Kind, string> = { hype: 'hl', retryable: 'paper', other: 'ely', withdrawals: 'ely-ink' }

/** Bridge: one stacked histogram, filters in the title row, four totals, and one line of the latest crossings. */
export function bridgeTab() {
  const el = h('div')
  const { controls } = titleRow(el, 'Crossings, <em>per minute</em>.')
  const on: Record<Kind, boolean> = { hype: true, retryable: true, other: true, withdrawals: true }
  let windowMin = 60
  const kindChips: Record<Kind, HTMLButtonElement> = { hype: chip(KS.hype, 'on hl'), retryable: chip(KS.retryable, 'on'), other: chip(KS.other, 'on ely'), withdrawals: chip(KS.withdrawals, 'on ely') }
  ;(Object.keys(kindChips) as Kind[]).forEach((k) => { const c = kindChips[k]; c.setAttribute('aria-pressed', 'true'); c.addEventListener('click', () => { on[k] = !on[k]; c.classList.toggle('on', on[k]); c.setAttribute('aria-pressed', String(on[k])); draw(true) }); controls.append(c) })
  controls.append(h('span', { class: 'vsep', 'aria-hidden': 'true' }))
  const w60 = chip('60 min', 'on'); const w180 = chip('3 h', ''); w60.setAttribute('aria-pressed', 'true'); w180.setAttribute('aria-pressed', 'false')
  w60.addEventListener('click', () => { windowMin = 60; w60.classList.add('on'); w180.classList.remove('on'); w60.setAttribute('aria-pressed', 'true'); w180.setAttribute('aria-pressed', 'false'); draw(true) })
  w180.addEventListener('click', () => { windowMin = 180; w180.classList.add('on'); w60.classList.remove('on'); w180.setAttribute('aria-pressed', 'true'); w60.setAttribute('aria-pressed', 'false'); draw(true) })
  controls.append(w60, w180)

  const CH = ROW.heroH; const CW = 1776
  const chart = hero(el, CH); chart.setAttribute('role', 'img'); chart.setAttribute('aria-label', 'Bridge crossings per minute')
  const axis = layer(CW, CH); chart.append(axis)
  const bars = h('div', { style: 'position:absolute;inset:0' }); chart.append(bars)
  const facts = new Facts(el)
  const feed = at(h('div', { class: 'feedline', 'aria-live': 'polite' }), 72, ROW.facts + 124, CW); el.append(feed)
  const recent: { kind: Kind; t: number; tx: string }[] = []

  let sig = ''
  function draw(force = false) {
    const s = state.snapshot; if (!s) return
    const hist = s.histogram.slice(-windowMin)
    const kinds = (Object.keys(on) as Kind[]).filter((k) => on[k])
    const nsig = `${windowMin}:${kinds.join('')}:${hist.map((m) => m.hype + m.retryable + m.other + m.withdrawals).join(',')}`
    if (!force && nsig === sig) { drawFeed(); return }
    const animate = force || !sig || sig.split(':')[0] !== String(windowMin) || sig.split(':')[1] !== kinds.join('')
    sig = nsig
    const max = Math.max(1, ...hist.map((m) => kinds.reduce((a, k) => a + m[k], 0)))
    bars.innerHTML = ''; axis.innerHTML = ''
    axis.append(svg('path', { class: 'hair2', d: `M 0 ${CH - 28} H ${CW}` }))
    ;[0.5, 1].forEach((f) => { const y = CH - 28 - (CH - 60) * f; axis.append(svg('path', { class: 'hair', d: `M 0 ${y} H ${CW}` })); axis.append(txt(0, y - 6, Math.round(max * f).toLocaleString('en-US') + ' / min')) })
    axis.append(txt(0, CH - 8, windowMin === 60 ? '−60 min' : '−3 h')); axis.append(txt(CW, CH - 8, 'now', '', 'end'))
    const bw = CW / hist.length
    hist.forEach((m, i) => {
      let y = 0
      for (const k of kinds) {
        const v = m[k]; if (!v) continue
        const hgt = (v / max) * (CH - 60)
        const bar = at(h('div', { class: 'bar ' + KC[k] }), i * bw + 1, 0, Math.max(1, bw - 2), hgt)
        bar.style.top = ''; bar.style.bottom = (28 + y) + 'px'
        tooltip(bar, () => `<b>${fmtTime(m.minute * 60)}</b><br>${kinds.map((kk) => `${KL[kk]}: ${m[kk]}`).join('<br>')}`)
        bars.append(bar); y += hgt
      }
    })
    if (animate) gsap.from(bars.children, { scaleY: 0, duration: .5, stagger: .002, ease: 'power3.out', overwrite: true })
    const sum = (k: Kind) => hist.reduce((a, m) => a + m[k], 0)
    const win = windowMin === 60 ? 'last hour' : 'last 3 h'
    facts.set([
      { k: KL.hype, v: sum('hype').toLocaleString('en-US'), s: win, cls: 'hl' },
      { k: KL.retryable, v: sum('retryable').toLocaleString('en-US'), s: win },
      { k: KL.other, v: sum('other').toLocaleString('en-US'), s: win },
      { k: KL.withdrawals, v: sum('withdrawals').toLocaleString('en-US'), s: 'execute after the challenge window' },
    ])
    drawFeed()
  }
  let feedSig = ''
  function drawFeed() {
    const s = state.snapshot; if (!s) return
    const fs = recent.slice(0, 5).map((r) => r.tx).join(','); if (fs === feedSig) return; feedSig = fs
    feed.innerHTML = ''
    feed.append(h('span', { class: 'feedk' }, 'latest'))
    for (const r of recent.slice(0, 5)) {
      const item = h('span', { class: 'feeditem' }, [h('i', { class: 'sw ' + KC[r.kind], 'aria-hidden': 'true' }), `${fmtTime(r.t)} ${KL[r.kind]} `, link(`${s.network.explorer.hyperevm}/tx/${r.tx}`, short(r.tx))])
      feed.append(item)
    }
    gsap.fromTo(feed.children, { opacity: 0, x: -6 }, { opacity: 1, x: 0, duration: .35, stagger: .04, ease: 'power2.out', overwrite: true })
  }
  const seed = (s: typeof state.snapshot) => {
    if (!s || recent.length) return
    for (const d of s.bridge.deposits.slice(-20)) recent.unshift({ kind: d.kind === 12 ? 'hype' : d.kind === 9 ? 'retryable' : 'other', t: d.l1Time, tx: d.txHash })
    for (const w of s.bridge.withdrawals.slice(-5)) recent.unshift({ kind: 'withdrawals', t: w.l1Time, tx: w.txHash })
    recent.sort((a, b) => b.t - a.t)
  }
  state.onSnapshot.on((s) => { seed(s); if (el.style.display !== 'none') draw() })
  state.onDeposit.on((m: BridgeMsg) => { recent.unshift({ kind: m.kind === 12 ? 'hype' : m.kind === 9 ? 'retryable' : 'other', t: m.l1Time, tx: m.txHash }); if (recent.length > 60) recent.pop(); if (el.style.display !== 'none') drawFeed() })
  state.onWithdrawal.on((w: Withdrawal) => { recent.unshift({ kind: 'withdrawals', t: w.l1Time, tx: w.txHash }); if (el.style.display !== 'none') drawFeed() })
  state.onNet.on(() => { recent.length = 0; sig = ''; feedSig = ''; bars.innerHTML = ''; feed.innerHTML = '' })
  return { el, onShow: () => draw(true) }
}
