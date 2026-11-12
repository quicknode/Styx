import gsap from 'gsap'
import { h, at, layer, s as svg, txt } from '../dom'
import { state, selectAssertion } from '../state'
import { copyBtn, link, tooltip } from '../ui'
import { titleRow, hero, Facts, Inspector, ikv, ROW } from '../layout'
import { fmtAge, fmtClock, fmtTime, short } from '../api'

/** Assertions: a 24 h timeline. ○ created above the line, ● confirmed below, joined when both are in view. */
export function assertionsTab() {
  const el = h('div')
  titleRow(el, 'State claims, <em>created then confirmed</em>.')
  const TH = ROW.heroH; const TW = 1776
  const tl = hero(el, TH); tl.setAttribute('role', 'img'); tl.setAttribute('aria-label', '24 hour timeline of assertions')
  const sv = layer(TW, TH); tl.append(sv)
  const dots = h('div', { style: 'position:absolute;inset:0', role: 'list' }); tl.append(dots)
  const facts = new Facts(el)
  const insp = new Inspector(el, facts)

  let sig = ''; let shownHash = ''
  function draw(force = false) {
    const s = state.snapshot; if (!s) return
    const nsig = s.assertions.map((a) => `${a.hash.slice(0, 10)}.${a.createdTime ?? 0}.${a.confirmedTime ?? 0}`).join(',') + ':' + Math.floor(s.now / 300)
    if (!force && nsig === sig) { drawFacts(); if (insp.open) drawInspector(); return }
    const animate = force || !sig
    sig = nsig
    const now = s.now; const span = 24 * 3600; const x = (t: number) => TW - ((now - t) / span) * TW
    const MID = TH / 2
    sv.innerHTML = ''; dots.innerHTML = ''
    sv.append(svg('path', { class: 'hair2', d: `M 0 ${MID} H ${TW}` }))
    for (let hrs = 0; hrs <= 24; hrs += 4) { const xx = x(now - hrs * 3600); sv.append(svg('path', { class: 'hair', d: `M ${xx} ${MID - 8} V ${MID + 8}` })); sv.append(txt(xx, TH - 10, hrs ? `−${hrs} h` : 'now', '', hrs === 24 ? 'start' : hrs ? 'middle' : 'end')) }
    sv.append(txt(0, 20, '○ created', '')); sv.append(txt(0, MID + 70, '● confirmed', ''))
    const list = s.assertions.filter((a) => a.createdTime || a.confirmedTime)
    const mk = (a: typeof list[number], t: number, confirmed: boolean) => {
      const d = h('div', { class: 'dot-asrt' + (confirmed ? ' ok' : '') + (a.hash === state.selectedAssertion ? ' sel' : ''), role: 'listitem', tabindex: '0', 'aria-label': `${confirmed ? 'Confirmed' : 'Created'} ${fmtClock(t)}, ${short(a.hash)}` })
      at(d, x(t), confirmed ? MID + 36 : MID - 36)
      const open = () => selectAssertion(a.hash)
      d.addEventListener('click', open); d.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } })
      tooltip(d, () => `<b>${confirmed ? 'confirmed' : 'created'}</b> ${fmtTime(t)}<br>${short(a.hash)}${confirmed && a.createdTime ? `<br>${fmtAge(t - a.createdTime)} after creation` : ''}<br><span class="dim">click for details</span>`)
      dots.append(d)
    }
    for (const a of list) {
      if (a.createdTime && now - a.createdTime <= span) mk(a, a.createdTime, false)
      if (a.confirmedTime && now - a.confirmedTime <= span) {
        mk(a, a.confirmedTime, true)
        if (a.createdTime && now - a.createdTime <= span) sv.append(svg('path', { class: 'ln dash', d: `M ${x(a.createdTime)} ${MID - 24} L ${x(a.confirmedTime)} ${MID + 24}` }))
      }
    }
    if (animate) gsap.from(dots.children, { scale: 0, duration: .5, stagger: .04, ease: 'back.out(2)', transformOrigin: 'center', overwrite: true })
    drawFacts(); if (insp.open) drawInspector()
  }
  function drawFacts() {
    const s = state.snapshot; if (!s) return
    const now = s.now
    const list = s.assertions.filter((a) => a.createdTime || a.confirmedTime)
    const conf = list.filter((a) => a.confirmedTime).at(-1); const open = list.filter((a) => a.createdTime && !a.confirmedTime)
    const lags = list.filter((a) => a.createdTime && a.confirmedTime).map((a) => a.confirmedTime! - a.createdTime!)
    const med = lags.length ? [...lags].sort((p, q) => p - q)[Math.floor(lags.length / 2)] : 0
    facts.set([
      { k: 'last confirmed', v: conf ? `${fmtAge(now - conf.confirmedTime!)} <em>ago</em>` : '—', s: conf ? fmtClock(conf.confirmedTime!) : '' },
      { k: 'open claims', v: `${open.length}`, s: open[0]?.createdTime ? `oldest ${fmtAge(now - open[0].createdTime)} into a ${s.health.assertions.confirmPeriod >= 3600 ? Math.round(s.health.assertions.confirmPeriod / 3600) + ' h' : s.health.assertions.confirmPeriod + ' s'} window` : 'none waiting', cls: s.health.assertions.state === 'live' ? '' : 'amber' },
      { k: 'typical confirmation lag', v: med ? fmtAge(med) : '—', s: 'created to confirmed, last 24 h' },
      { k: 'what this means', v: 'Withdrawals <em>wait</em>', s: 'for the claim covering them to confirm' },
    ])
  }
  function drawInspector() {
    const s = state.snapshot; const a = s?.assertions.find((x) => x.hash === state.selectedAssertion); if (!s || !a) return
    const now = s.now
    if (insp.open && shownHash === a.hash) return
    shownHash = a.hash
    insp.show(`assertion ${short(a.hash)}`, (body) => {
      body.append(
        ikv('created', a.createdTime ? `${fmtAge(now - a.createdTime)} <em>ago</em>` : 'before <em>lookback</em>', a.createdTime ? fmtClock(a.createdTime) : 'older than 24 h'),
        ikv('confirmed', a.confirmedTime ? `${fmtAge(now - a.confirmedTime)} <em>ago</em>` : '<em>pending</em>', a.confirmedTime ? fmtClock(a.confirmedTime) : 'waiting for the challenge window'),
        ikv('created to confirmed', a.createdTime && a.confirmedTime ? fmtAge(a.confirmedTime - a.createdTime) : a.confirmedTime ? 'creation not in view' : 'not yet', ''),
        ikv('on hyperevm', `<span style="font-family:var(--mono);font-size:24px">${a.confirmedBlock ? 'block ' + a.confirmedBlock.toLocaleString('en-US') : a.createdBlock ? 'block ' + a.createdBlock.toLocaleString('en-US') : '—'}</span>`, ' '),
      )
      const l = body.lastElementChild!.querySelector('.s')!
      if (a.createTx) l.append(link(`${s.network.explorer.hyperevm}/tx/${a.createTx}`, 'create tx'))
      if (a.confirmTx) l.append(link(`${s.network.explorer.hyperevm}/tx/${a.confirmTx}`, 'confirm tx'))
      l.append(copyBtn(a.hash))
    })
    for (const d of Array.from(dots.children)) d.classList.toggle('sel', (d as HTMLElement).getAttribute('aria-label')?.endsWith(short(a.hash)) ?? false)
  }
  state.onSnapshot.on(() => { if (el.style.display !== 'none') draw() })
  state.onSelectAssertion.on((hsh) => { if (hsh === null) insp.hide(); else drawInspector() })
  state.onNet.on(() => { dots.innerHTML = ''; sig = ''; insp.hide() })
  return { el, onShow: () => { draw(true); if (state.selectedAssertion) drawInspector() } }
}
