import gsap from 'gsap'
import { h, at, layer, s as svg, txt } from '../dom'
import { state, selectAssertion } from '../state'
import { copyBtn, link, tooltip } from '../ui'
import { titleRow, hero, Facts, Inspector, ikv, ROW } from '../layout'
import { fmtAge, fmtClock, fmtTime, short, type Assertion } from '../api'

/**
 * Assertions as a staircase. One row per claim, newest at the bottom, 48 h of time across.
 * A bar runs from the moment a claim was posted to the moment it was confirmed. Open claims are
 * hatched up to now, with a faint line to the end of their window, and turn amber once past it.
 */
export function assertionsTab() {
  const el = h('div')
  titleRow(el, 'State claims, <em>posted then confirmed</em>.')
  const legend = at(h('div', { class: 'legend' }), 72, 60, 1300); legend.style.justifyContent = 'flex-start'; el.append(legend)
  legend.innerHTML = '<span><i class="lg lg-ink"></i>posted → confirmed</span><span><i class="lg lg-wait"></i>open, inside its window</span><span><i class="lg lg-amber"></i>open, past its window</span><span><i class="lg lg-dash"></i>window ends</span>'
  const CH = ROW.heroH, CW = 1776, SPAN = 48 * 3600, BASE = CH - 28
  const chart = hero(el, CH); chart.setAttribute('role', 'img'); chart.setAttribute('aria-label', 'State claims over the last 48 hours, one row each, from posting to confirmation')
  const axis = layer(CW, CH); chart.append(axis)
  const rows = h('div', { style: 'position:absolute;inset:0', role: 'list' }); chart.append(rows)
  const facts = new Facts(el)
  const insp = new Inspector(el, facts)
  const note = at(h('p', { class: 'home-next' }, ''), 72, ROW.facts + 124, CW); el.append(note)

  let sig = ''; let shownHash = ''
  function draw(force = false) {
    const s = state.snapshot; if (!s) return
    const now = s.now; const win = s.health.assertions.confirmPeriod
    const list = s.assertions.filter((a) => (a.createdTime && now - a.createdTime <= SPAN) || (a.confirmedTime && now - a.confirmedTime <= SPAN))
      .sort((a, b) => (a.createdTime ?? a.confirmedTime!) - (b.createdTime ?? b.confirmedTime!))
    const nsig = list.map((a) => `${a.hash.slice(0, 8)}.${a.confirmedTime ?? 0}`).join(',') + ':' + Math.floor(now / 300)
    if (!force && nsig === sig) { drawFacts(); if (insp.open) drawInspector(); return }
    const animate = force || !sig
    sig = nsig
    rows.innerHTML = ''; axis.innerHTML = ''
    const x = (t: number) => Math.max(0, Math.min(CW, CW - ((now - t) / SPAN) * CW))
    axis.append(svg('path', { class: 'hair2', d: `M 0 ${BASE} H ${CW}` }))
    for (let hrs = 0; hrs <= 48; hrs += 8) { const xx = x(now - hrs * 3600); axis.append(svg('path', { class: 'hair2', d: `M ${xx} ${BASE} V ${BASE + 8}` })); axis.append(txt(xx, BASE + 22, hrs ? `−${hrs} h` : 'now', hrs ? '' : 'ink', hrs === 48 ? 'start' : hrs ? 'middle' : 'end')) }
    axis.append(svg('path', { class: 'ln dash', d: `M ${CW} 24 V ${BASE}`, style: 'stroke:var(--ink);opacity:.35' }))
    if (!list.length) { axis.append(txt(0, 16, 'no claims in the last 48 h', '')); return }
    const n = list.length; const rowH = Math.max(6, Math.min(14, (BASE - 40) / n)); const barH = Math.max(4, rowH - 2)
    axis.append(txt(0, 16, `${n} claims in 48 h · newest at the bottom`, ''))
    list.forEach((a, i) => {
      const y = BASE - 8 - (n - 1 - i) * rowH - barH   // newest at the bottom
      const start = a.createdTime ?? (now - SPAN)
      const x0 = x(start)
      const sel = a.hash === state.selectedAssertion
      if (a.confirmedTime) {
        const bar = at(h('div', { class: 'claim done' + (sel ? ' sel' : ''), role: 'listitem', tabindex: '0', 'aria-label': `Claim ${short(a.hash)}, posted ${a.createdTime ? fmtClock(a.createdTime) : 'earlier'}, confirmed ${fmtClock(a.confirmedTime)}` }), x0, y, Math.max(3, x(a.confirmedTime) - x0), barH)
        wire(bar, a); rows.append(bar)
      } else {
        const end = a.createdTime ? a.createdTime + win : now
        const overdue = win > 0 && now > end
        const openW = Math.max(3, x(Math.min(now, end)) - x0)
        const bar = at(h('div', { class: 'claim open' + (sel ? ' sel' : ''), role: 'listitem', tabindex: '0', 'aria-label': `Claim ${short(a.hash)}, posted ${a.createdTime ? fmtClock(a.createdTime) : 'earlier'}, open` }), x0, y, openW, barH)
        wire(bar, a); rows.append(bar)
        if (overdue) { const late = at(h('div', { class: 'claim late' + (sel ? ' sel' : '') }), x(end), y, Math.max(3, x(now) - x(end)), barH); late.style.pointerEvents = 'none'; rows.append(late) }
        else if (win > 0) { axis.append(svg('path', { class: 'hair2 dash', d: `M ${x(now)} ${y + barH / 2} H ${Math.min(CW, x0 + ((win) / SPAN) * CW)}` })) }
      }
    })
    if (animate) gsap.fromTo(Array.from(rows.children), { scaleX: 0, transformOrigin: 'left center' }, { scaleX: 1, duration: .4, stagger: .012, ease: 'power3.out' })
    drawFacts(); if (insp.open) drawInspector()
  }
  function wire(bar: HTMLElement, a: Assertion) {
    const open = () => selectAssertion(a.hash)
    bar.addEventListener('click', open); bar.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } })
    tooltip(bar, () => {
      const s = state.snapshot!; const now = s.now; const win = s.health.assertions.confirmPeriod
      const posted = a.createdTime ? `posted ${fmtTime(a.createdTime)} · ${fmtAge(now - a.createdTime)} ago` : 'posted before the lookback'
      const st = a.confirmedTime ? `<b>confirmed</b> ${fmtTime(a.confirmedTime)}${a.createdTime ? ` · after ${fmtAge(a.confirmedTime - a.createdTime)}` : ''}` : a.createdTime && win ? (now > a.createdTime + win ? `<b>eligible since</b> ${fmtTime(a.createdTime + win)} · waiting for a validator` : `<b>eligible</b> in ${fmtAge(a.createdTime + win - now)}`) : '<b>open</b>'
      return `${short(a.hash)}<br>${posted}<br>${st}<br><span class="dim">click for details</span>`
    })
  }
  function drawFacts() {
    const s = state.snapshot; if (!s) return
    const now = s.now; const win = s.health.assertions.confirmPeriod
    const all = s.assertions
    const open = all.filter((a) => a.createdTime && !a.confirmedTime).sort((a, b) => a.createdTime! - b.createdTime!)
    const conf = all.filter((a) => a.confirmedTime).sort((a, b) => a.confirmedTime! - b.confirmedTime!)
    const gaps = conf.slice(1).map((a, i) => a.confirmedTime! - conf[i].confirmedTime!).filter((g) => g > 600)
    const cad = gaps.length ? [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)] : 0
    const oldest = open[0]?.createdTime ? now - open[0].createdTime : 0
    const overdue = open.filter((a) => win && now - a.createdTime! > win).length
    facts.set([
      { k: 'open claims', v: `${open.length}`, s: overdue ? `${overdue} past the ${win ? fmtAge(win) : ''} window` : `all inside the ${win ? fmtAge(win) : ''} window`, cls: overdue ? 'amber' : '' },
      { k: 'oldest waiting', v: oldest ? fmtAge(oldest) : 'none', s: win ? (oldest > win ? `eligible for ${fmtAge(oldest - win)}, waiting for a validator` : `eligible in ${fmtAge(win - oldest)}`) : '', cls: win && oldest > win ? 'amber' : '' },
      { k: 'confirmations run', v: cad ? `every ${fmtAge(cad)}` : 'measuring', s: 'median gap, in lumps, last 48 h' },
      { k: 'last confirmed', v: conf.length ? `${fmtAge(now - conf.at(-1)!.confirmedTime!)} <em>ago</em>` : '—', s: conf.length ? fmtClock(conf.at(-1)!.confirmedTime!) : '' },
    ])
    note.textContent = 'A claim is the sequencer stating Elysium\'s state after a run of batches. It can be confirmed once its challenge window passes with no dispute, but only when a validator submits the confirmation, which on mainnet happens in lumps. Withdrawals execute only after the claim covering them is confirmed.'
  }
  function drawInspector() {
    const s = state.snapshot; const a = s?.assertions.find((x) => x.hash === state.selectedAssertion); if (!s || !a) return
    const now = s.now; const win = s.health.assertions.confirmPeriod
    if (insp.open && shownHash === a.hash) return
    shownHash = a.hash
    insp.show(`claim ${short(a.hash)}`, (body) => {
      body.append(
        ikv('posted', a.createdTime ? `${fmtAge(now - a.createdTime)} <em>ago</em>` : 'before <em>lookback</em>', a.createdTime ? fmtClock(a.createdTime) : 'older than 48 h'),
        ikv('eligible', a.createdTime && win ? (now > a.createdTime + win ? `since ${fmtAge(now - a.createdTime - win)} <em>ago</em>` : `in ${fmtAge(a.createdTime + win - now)}`) : '—', win ? `${fmtAge(win)} challenge window` : ''),
        ikv('confirmed', a.confirmedTime ? `${fmtAge(now - a.confirmedTime)} <em>ago</em>` : '<em>not yet</em>', a.confirmedTime ? fmtClock(a.confirmedTime) + (a.createdTime ? ` · ${fmtAge(a.confirmedTime - a.createdTime)} after posting` : '') : 'waiting for a validator'),
        ikv('on hyperevm', `<span style="font-family:var(--mono);font-size:24px">${a.confirmedBlock ? 'block ' + a.confirmedBlock.toLocaleString('en-US') : a.createdBlock ? 'block ' + a.createdBlock.toLocaleString('en-US') : '—'}</span>`, ' '),
      )
      const l = body.lastElementChild!.querySelector('.s')!
      if (a.createTx) l.append(link(`${s.network.explorer.hyperevm}/tx/${a.createTx}`, 'post tx'))
      if (a.confirmTx) l.append(link(`${s.network.explorer.hyperevm}/tx/${a.confirmTx}`, 'confirm tx'))
      l.append(copyBtn(a.hash))
    })
    for (const r of Array.from(rows.children)) r.classList.toggle('sel', (r as HTMLElement).getAttribute('aria-label')?.includes(short(a.hash)) ?? false)
  }
  state.onSnapshot.on(() => { if (el.style.display !== 'none') draw() })
  state.onSelectAssertion.on((hsh) => { if (el.style.display === 'none') return; if (hsh === null) insp.hide(); else drawInspector() })
  state.onNet.on(() => { rows.innerHTML = ''; sig = ''; insp.hide() })
  return { el, onShow: () => { draw(true); if (state.selectedAssertion) drawInspector() } }
}
