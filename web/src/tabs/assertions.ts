import gsap from 'gsap'
import { h, at } from '../dom'
import { state, selectAssertion } from '../state'
import { copyBtn, link, tooltip } from '../ui'
import { titleRow, Facts, Inspector, ikv, ROW } from '../layout'
import { fmtAge, fmtClock, fmtTime, short, type Assertion } from '../api'

type Zone = 'waiting' | 'ready' | 'confirmed'
const ZONES: { id: Zone; title: string; sub: string }[] = [
  { id: 'waiting', title: 'In the window', sub: 'posted, challenge window running' },
  { id: 'ready', title: 'Ready', sub: 'window passed, waiting for a validator' },
  { id: 'confirmed', title: 'Confirmed', sub: 'final on HyperEVM' },
]

/**
 * Claims as a queue. Each claim is a tile. It enters on the left when posted, fills up as its
 * 24 h window elapses, moves to the middle once it is eligible, and slides to the right when a
 * validator confirms it. Tiles keep their identity, so every state change is an animation.
 */
export function assertionsTab() {
  const el = h('div')
  titleRow(el, 'State claims, <em>posted then confirmed</em>.')
  const CW = 1776, X0 = 72, Y0 = ROW.hero, H = ROW.heroH
  const colW = (CW - 2 * 48) / 3
  const zones = new Map<Zone, { box: HTMLElement; grid: HTMLElement; count: HTMLElement }>()
  ZONES.forEach((z, i) => {
    const box = at(h('div', { class: 'zone zone-' + z.id }), X0 + i * (colW + 48), Y0, colW, H)
    const count = h('span', { class: 'zcount' }, '0')
    box.append(h('div', { class: 'zhead' }, [h('span', { class: 'ztitle' }, z.title), count]), h('div', { class: 'zsub' }, z.sub))
    const grid = h('div', { class: 'zgrid', role: 'list', 'aria-label': z.title }); box.append(grid)
    el.append(box); zones.set(z.id, { box, grid, count })
    if (i < 2) { const arrow = at(h('div', { class: 'zarrow', 'aria-hidden': 'true' }, '→'), X0 + i * (colW + 48) + colW + 10, Y0 + 20, 28, 28); el.append(arrow) }
  })
  const facts = new Facts(el)
  const insp = new Inspector(el, facts)
  const note = at(h('p', { class: 'home-next' }, ''), X0, ROW.facts + 124, CW); el.append(note)

  const tiles = new Map<string, HTMLElement>()
  const zoneOf = (a: Assertion, now: number, win: number): Zone => a.confirmedTime ? 'confirmed' : (a.createdTime && win && now - a.createdTime >= win) ? 'ready' : 'waiting'

  function tile(a: Assertion) {
    const t = h('div', { class: 'tile', role: 'listitem', tabindex: '0' }, [h('div', { class: 'tfill', 'aria-hidden': 'true' }), h('div', { class: 'tid' }, a.hash.slice(2, 6)), h('div', { class: 'tage' }, '')])
    const open = () => selectAssertion(a.hash)
    t.addEventListener('click', open); t.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } })
    tooltip(t, () => {
      const s = state.snapshot!; const now = s.now; const win = s.health.assertions.confirmPeriod
      const cur = s.assertions.find((x) => x.hash === a.hash) ?? a
      const posted = cur.createdTime ? `posted ${fmtTime(cur.createdTime)} · ${fmtAge(now - cur.createdTime)} ago` : 'posted before the lookback'
      const st = cur.confirmedTime ? `<b>confirmed</b> ${fmtTime(cur.confirmedTime)}${cur.createdTime ? ` · ${fmtAge(cur.confirmedTime - cur.createdTime)} after posting` : ''}` : cur.createdTime && win ? (now - cur.createdTime >= win ? `<b>ready</b> for ${fmtAge(now - cur.createdTime - win)} · waiting for a validator` : `<b>ready in</b> ${fmtAge(cur.createdTime + win - now)}`) : '<b>open</b>'
      return `claim ${short(cur.hash)}<br>${posted}<br>${st}<br><span class="dim">click for details</span>`
    })
    return t
  }

  function draw() {
    const s = state.snapshot; if (!s) return
    const now = s.now; const win = s.health.assertions.confirmPeriod
    const list = s.assertions.filter((a) => a.createdTime || a.confirmedTime)
    const confirmed = list.filter((a) => a.confirmedTime).sort((a, b) => b.confirmedTime! - a.confirmedTime!).slice(0, 12)
    const keep = new Set([...list.filter((a) => !a.confirmedTime).map((a) => a.hash), ...confirmed.map((a) => a.hash)])
    // remove tiles that fell out of view
    for (const [hash, t] of tiles) if (!keep.has(hash)) { gsap.to(t, { opacity: 0, scale: .6, duration: .3, onComplete: () => t.remove() }); tiles.delete(hash) }
    const counts: Record<Zone, number> = { waiting: 0, ready: 0, confirmed: 0 }
    const ordered = [...list.filter((a) => !a.confirmedTime).sort((a, b) => (a.createdTime ?? 0) - (b.createdTime ?? 0)), ...confirmed]
    for (const a of ordered) {
      const z = zoneOf(a, now, win); counts[z]++
      const grid = zones.get(z)!.grid
      let t = tiles.get(a.hash)
      if (!t) {
        t = tile(a); tiles.set(a.hash, t); grid.append(t)
        gsap.fromTo(t, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: .45, ease: 'back.out(2)' })
      } else if (t.parentElement !== grid) {
        // FLIP: keep the tile on screen while it slides to its new zone
        const r0 = t.getBoundingClientRect(); grid.append(t); const r1 = t.getBoundingClientRect()
        const deck = document.getElementById('deck')!.getBoundingClientRect(); const sc = deck.width / 1920
        gsap.fromTo(t, { x: (r0.left - r1.left) / sc, y: (r0.top - r1.top) / sc }, { x: 0, y: 0, duration: .7, ease: 'power3.inOut' })
        gsap.fromTo(t, { boxShadow: '0 0 0 6px rgba(52,183,221,.6)' }, { boxShadow: '0 0 0 0 rgba(52,183,221,0)', duration: 1.2, ease: 'power2.out' })
      }
      t.classList.toggle('ready', z === 'ready'); t.classList.toggle('done', z === 'confirmed')
      t.setAttribute('aria-label', `Claim ${short(a.hash)}, ${z === 'confirmed' ? 'confirmed ' + fmtClock(a.confirmedTime!) : z === 'ready' ? 'ready for a validator' : 'in its challenge window'}`)
      t.classList.toggle('sel', a.hash === state.selectedAssertion)
      const fill = t.querySelector('.tfill') as HTMLElement; const age = t.querySelector('.tage') as HTMLElement
      if (z === 'confirmed') { fill.style.height = '100%'; age.textContent = fmtAgeShort(now - a.confirmedTime!) }
      else if (a.createdTime && win) { const f = Math.min(1, (now - a.createdTime) / win); gsap.to(fill, { height: `${Math.round(f * 100)}%`, duration: .6, ease: 'power2.out' }); age.textContent = z === 'ready' ? `+${fmtAgeShort(now - a.createdTime - win)}` : fmtAgeShort(win - (now - a.createdTime)) }
      else { fill.style.height = '0%'; age.textContent = '' }
    }
    for (const z of ZONES) { const c = zones.get(z.id)!.count; const v = String(counts[z.id]); if (c.textContent !== v) { c.textContent = v; gsap.fromTo(c, { scale: 1.3 }, { scale: 1, duration: .4, ease: 'back.out(2)' }) } }
    drawFacts(); if (insp.open) drawInspector()
  }
  const fmtAgeShort = (sec: number) => sec < 3600 ? `${Math.max(0, Math.round(sec / 60))}m` : `${(sec / 3600).toFixed(sec < 36000 ? 1 : 0)}h`

  function drawFacts() {
    const s = state.snapshot; if (!s) return
    const now = s.now; const win = s.health.assertions.confirmPeriod
    const all = s.assertions
    const open = all.filter((a) => a.createdTime && !a.confirmedTime).sort((a, b) => a.createdTime! - b.createdTime!)
    const conf = all.filter((a) => a.confirmedTime).sort((a, b) => a.confirmedTime! - b.confirmedTime!)
    const gaps = conf.slice(1).map((a, i) => a.confirmedTime! - conf[i].confirmedTime!).filter((g) => g > 600)
    const cad = gaps.length ? [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)] : 0
    const ready = open.filter((a) => win && now - a.createdTime! >= win)
    const next = open.find((a) => win && now - a.createdTime! < win)
    facts.set([
      { k: 'in the window', v: `${open.length - ready.length}`, s: next ? `next one ready in ${fmtAge(next.createdTime! + win - now)}` : 'none waiting', cls: '' },
      { k: 'ready for a validator', v: `${ready.length}`, s: ready.length ? `oldest ready for ${fmtAge(now - ready[0].createdTime! - win)}` : 'nothing eligible yet', cls: ready.length ? 'amber' : '' },
      { k: 'confirmations run', v: cad ? `every ${fmtAge(cad)}` : 'measuring', s: conf.length ? `last one ${fmtAge(now - conf.at(-1)!.confirmedTime!)} ago` : 'median gap, in lumps' },
      { k: 'challenge window', v: win ? fmtAge(win) : '—', s: 'read from the rollup contract' },
    ])
    note.textContent = 'A claim is the sequencer stating Elysium\'s state after a run of batches. Each tile fills as its challenge window elapses. Once full it is ready, and a validator confirms ready claims in lumps. Withdrawals execute only after the claim covering them is confirmed.'
  }
  function drawInspector() {
    const s = state.snapshot; const a = s?.assertions.find((x) => x.hash === state.selectedAssertion); if (!s || !a) return
    const now = s.now; const win = s.health.assertions.confirmPeriod
    insp.show(`claim ${short(a.hash)}`, (body) => {
      body.append(
        ikv('posted', a.createdTime ? `${fmtAge(now - a.createdTime)} <em>ago</em>` : 'before <em>lookback</em>', a.createdTime ? fmtClock(a.createdTime) : 'older than 48 h'),
        ikv('ready', a.createdTime && win ? (now > a.createdTime + win ? `since ${fmtAge(now - a.createdTime - win)} <em>ago</em>` : `in ${fmtAge(a.createdTime + win - now)}`) : '—', win ? `${fmtAge(win)} challenge window` : ''),
        ikv('confirmed', a.confirmedTime ? `${fmtAge(now - a.confirmedTime)} <em>ago</em>` : '<em>not yet</em>', a.confirmedTime ? fmtClock(a.confirmedTime) + (a.createdTime ? ` · ${fmtAge(a.confirmedTime - a.createdTime)} after posting` : '') : 'waiting for a validator'),
        ikv('on hyperevm', `<span style="font-family:var(--mono);font-size:24px">${a.confirmedBlock ? 'block ' + a.confirmedBlock.toLocaleString('en-US') : a.createdBlock ? 'block ' + a.createdBlock.toLocaleString('en-US') : '—'}</span>`, ' '),
      )
      const l = body.lastElementChild!.querySelector('.s')!
      if (a.createTx) l.append(link(`${s.network.explorer.hyperevm}/tx/${a.createTx}`, 'post tx'))
      if (a.confirmTx) l.append(link(`${s.network.explorer.hyperevm}/tx/${a.confirmTx}`, 'confirm tx'))
      l.append(copyBtn(a.hash))
    })
    for (const [hash, t] of tiles) t.classList.toggle('sel', hash === a.hash)
  }
  state.onSnapshot.on(() => { if (el.style.display !== 'none') draw() })
  state.onSelectAssertion.on((hsh) => { if (el.style.display === 'none') return; if (hsh === null) insp.hide(); else drawInspector() })
  state.onNet.on(() => { for (const t of tiles.values()) t.remove(); tiles.clear(); insp.hide() })
  // keep the fills and ages live between snapshots
  setInterval(() => { if (el.style.display !== 'none' && state.snapshot) { state.snapshot.now = Math.floor(Date.now() / 1000); draw() } }, 1000)
  return { el, onShow: () => draw() }
}
