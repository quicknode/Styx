import gsap from 'gsap'
import { h, at, layer, s as svg, txt, G } from '../dom'
import { state, selectAssertion } from '../state'
import { copyBtn, link, row, tooltip, enter } from '../ui'
import { fmtAge, fmtClock, fmtTime, short } from '../api'

/** Assertions: a 24 h timeline of state claims, hollow when created, filled when confirmed, plus a table and a detail card. */
export function assertionsTab() {
  const el = h('div')
  el.append(at(h('div', { class: 'h2', html: 'State claims on HyperEVM, <em>created and confirmed</em>.' }), G.x(1), 16))
  const TX = G.x(1), TY = 96, TW = G.w(12), TH = 120
  const tl = at(h('div', { style: 'position:absolute' }), TX, TY, TW, TH); el.append(tl)
  const sv = layer(TW, TH); tl.append(sv)
  const dots = h('div', { style: 'position:absolute;inset:0' }); tl.append(dots)
  const widths = [200, 300, 300, 240]
  const table = at(h('div', { class: 'table' }), G.x(1), 250, G.w(8)); el.append(table)
  const head = h('div', { class: 'th' }); ['assertion', 'created', 'confirmed', 'lag'].forEach((t, i) => head.append(h('div', { class: 'td', style: `width:${widths[i]}px` }, t))); table.append(head)
  const body = h('div'); table.append(body)
  const card = at(h('div', { class: 'panel' }, [h('span', { class: 'panel-title' }, 'Selected assertion')]), G.x(10), 250, G.w(3), 360); el.append(card)
  const cardBody = h('div', { style: 'position:absolute;inset:0' }); card.append(cardBody)
  const note = at(h('div', { class: 'prose', style: 'width:' + G.w(8) + 'px' }, ''), G.x(1), 560); el.append(note)

  function draw() {
    const s = state.snapshot; if (!s) return
    const now = s.now; const span = 24 * 3600; const x = (t: number) => TW - ((now - t) / span) * TW
    sv.innerHTML = ''; dots.innerHTML = ''
    sv.append(svg('path', { class: 'hair2', d: `M 0 ${TH / 2} H ${TW}` }))
    for (let hrs = 0; hrs <= 24; hrs += 6) { const xx = x(now - hrs * 3600); sv.append(svg('path', { class: 'hair', d: `M ${xx} ${TH / 2 - 10} V ${TH / 2 + 10}` })); sv.append(txt(xx, TH / 2 + 30, hrs ? `−${hrs} h` : 'now', '', hrs === 24 ? 'start' : hrs ? 'middle' : 'end')) }
    const list = s.assertions.filter((a) => a.createdTime || a.confirmedTime)
    list.forEach((a) => {
      if (a.createdTime && now - a.createdTime <= span) {
        const d = at(h('div', { class: 'dot-asrt' + (a.hash === state.selectedAssertion ? ' sel' : '') }), x(a.createdTime), TH / 2 - 22); dots.append(d)
        d.addEventListener('click', () => selectAssertion(a.hash)); tooltip(d, () => `<b>created</b> ${fmtTime(a.createdTime!)}<br>${short(a.hash)}`)
      }
      if (a.confirmedTime && now - a.confirmedTime <= span) {
        const d = at(h('div', { class: 'dot-asrt ok' + (a.hash === state.selectedAssertion ? ' sel' : '') }), x(a.confirmedTime), TH / 2 + 22); dots.append(d)
        d.addEventListener('click', () => selectAssertion(a.hash)); tooltip(d, () => `<b>confirmed</b> ${fmtTime(a.confirmedTime!)}<br>${short(a.hash)}${a.createdTime ? `<br>${fmtAge(a.confirmedTime! - a.createdTime)} after creation` : ''}`)
        if (a.createdTime && now - a.createdTime <= span) { const p = svg('path', { class: 'ln dash', d: `M ${x(a.createdTime)} ${TH / 2 - 14} L ${x(a.confirmedTime)} ${TH / 2 + 14}` }); sv.append(p) }
      }
    })
    sv.append(txt(0, 14, '○ created', '')); sv.append(txt(0, TH - 4, '● confirmed', ''))
    gsap.from(dots.children, { scale: 0, duration: .5, stagger: .04, ease: 'back.out(2)', transformOrigin: 'center' })
    body.innerHTML = ''
    for (const a of [...list].reverse().slice(0, 5)) {
      const r = row([short(a.hash), a.createdTime ? fmtClock(a.createdTime) : '—', a.confirmedTime ? fmtClock(a.confirmedTime) : '<span class="dim">pending</span>', a.createdTime && a.confirmedTime ? fmtAge(a.confirmedTime - a.createdTime) : '—'], widths, 'click' + (a.hash === state.selectedAssertion ? ' sel' : ''))
      r.querySelectorAll('.td').forEach((td) => td.classList.add('mono'))
      r.addEventListener('click', () => selectAssertion(a.hash))
      body.append(r)
    }
    enter(body.children, .03)
    const sel = list.find((a) => a.hash === state.selectedAssertion) ?? [...list].reverse()[0]
    cardBody.innerHTML = ''
    if (sel) {
      const kv = (y: number, k: string, v: string, sub = '') => cardBody.append(at(h('div', { class: 'kv' }, [h('div', { class: 'k' }, k), h('div', { class: 'v', html: v }), ...(sub ? [h('div', { class: 's', html: sub })] : [])]), 24, y))
      kv(40, 'assertion', `<span style="font-family:var(--mono);font-size:26px">${short(sel.hash)}</span>`)
      kv(130, 'created', sel.createdTime ? `${fmtAge(now - sel.createdTime)} <em>ago</em>` : 'before the lookback', sel.createdTime ? fmtClock(sel.createdTime) : '')
      kv(226, 'confirmed', sel.confirmedTime ? `${fmtAge(now - sel.confirmedTime)} <em>ago</em>` : '<em>pending</em>', sel.createdTime && sel.confirmedTime ? `${fmtAge(sel.confirmedTime - sel.createdTime)} after creation` : sel.createdTime ? 'waiting for the confirmation window' : '')
      const l = at(h('div', { style: 'position:absolute;font-family:var(--mono);font-size:14px;letter-spacing:.06em;color:var(--ink-50)' }), 24, 316)
      l.append('hash ', copyBtn(sel.hash)); if (sel.confirmTx) l.append(' · ', link(`${s.network.explorer.hyperevm}/tx/${sel.confirmTx}`, 'confirm tx')); cardBody.append(l)
      enter(cardBody.querySelectorAll('.kv'), .06)
    }
    const open = list.filter((a) => a.createdTime && !a.confirmedTime).length
    note.innerHTML = `An <em>assertion</em> is the sequencer's claim about Elysium's state after a range of batches. It is <b>created</b> on HyperEVM, then <b>confirmed</b> once the challenge window passes without dispute. Withdrawals execute only after the assertion covering them is confirmed. ${open ? `<b>${open}</b> ${open === 1 ? 'is' : 'are'} open right now.` : 'None are open right now.'} Permissioned validators at launch, BoLD contracts in place.`
  }
  state.onSnapshot.on(() => { if (el.style.display !== 'none') draw() })
  state.onSelectAssertion.on(() => { if (el.style.display !== 'none') draw() })
  state.onNet.on(() => { dots.innerHTML = ''; body.innerHTML = ''; cardBody.innerHTML = '' })
  return { el, onShow: draw }
}
