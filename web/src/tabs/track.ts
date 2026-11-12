import gsap from 'gsap'
import { h, at, G } from '../dom'
import { state } from '../state'
import { titleRow, ROW } from '../layout'
import { fetchSampleTx, fetchTx, fmtAge, fmtTime, short, type TxLadder } from '../api'

const STEPS = [
  { t: 'Included', d: 'In an Elysium block. You get a receipt within one block, but only Elysium knows about it so far.' },
  { t: 'Batched', d: 'A batch covering this block was posted to HyperEVM, carrying an AnyTrust certificate.' },
  { t: 'L1 confirmed', d: 'HyperEVM blocks are stacking on top of the batch. Reorganizing it now means reorganizing HyperEVM.' },
  { t: 'Asserted', d: 'The state claim covering this batch was confirmed. Withdrawals that depend on it can execute.' },
]

/** Track: one input, four big rungs. Each rung explains itself once reached. */
export function trackTab() {
  const el = h('div')
  const { controls } = titleRow(el, 'Follow one transaction <em>home</em>.')
  const sample = h('button', { class: 'btn ely', type: 'button' }, 'Try the newest batched tx'); sample.style.position = 'static'; controls.append(sample)
  const input = h('input', { id: 'trk-big', type: 'text', placeholder: 'Paste an Elysium transaction hash', spellcheck: 'false', autocomplete: 'off', 'aria-label': 'Elysium transaction hash' }) as HTMLInputElement
  at(input, G.x(1), ROW.hero + 8, G.w(12)); el.append(input)
  const status = at(h('div', { class: 'status', role: 'status', 'aria-live': 'polite' }, 'Paste a hash, or try the newest batched transaction.'), G.x(1), ROW.hero + 76); el.append(status)
  const ladder = at(h('ol', { class: 'ladder', 'aria-label': 'Settlement progress' }), G.x(1), ROW.hero + 140, G.w(12), 320); el.append(ladder)
  const steps = STEPS.map((st, i) => {
    const li = h('li', { class: 'rung2' }, [
      h('div', { class: 'cb', 'aria-hidden': 'true' }, String(i + 1)),
      h('div', { class: 'rt' }, st.t),
      h('div', { class: 'rs' }, '—'),
      h('div', { class: 'rd' }, st.d),
    ])
    at(li, i * (G.w(12) / 4), 0, G.w(12) / 4 - 32); ladder.append(li); return li
  })
  const histT = at(h('div', { class: 'lbl' }, 'recent'), G.x(1), ROW.hero + 500); el.append(histT)
  const hist = at(h('div', { class: 'controls', style: 'justify-content:flex-start;flex-wrap:wrap;height:auto' }), G.x(1), ROW.hero + 526, G.w(12)); el.append(hist)
  const history: string[] = JSON.parse(localStorage.getItem('esm.hist') ?? '[]')
  let timer = 0; let current = ''

  function drawHistory() {
    hist.innerHTML = ''
    for (const hh of history.slice(0, 8)) { const b = h('button', { class: 'chipbtn' + (hh === current ? ' on' : ''), type: 'button' }, short(hh)); b.addEventListener('click', () => lookup(hh)); hist.append(b) }
  }
  async function lookup(hash: string) {
    hash = hash.trim(); if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) { status.textContent = 'That is not a transaction hash.'; return }
    current = hash; input.value = hash
    if (!history.includes(hash)) { history.unshift(hash); history.splice(12); localStorage.setItem('esm.hist', JSON.stringify(history)) }
    drawHistory()
    status.textContent = 'Looking it up…'; status.classList.add('pulse')
    const r = await fetchTx(state.net, hash)
    status.classList.remove('pulse'); render(r)
    clearTimeout(timer)
    if (r.status !== 'assertion_confirmed' && r.status !== 'not_found') timer = window.setTimeout(() => lookup(hash), 10000)
  }
  function render(r: TxLadder) {
    const reached = r.status === 'included' ? 1 : r.status === 'batched' ? 2 : r.status === 'l1_confirmed' ? 3 : r.status === 'assertion_confirmed' ? 4 : 0
    if (r.error) { status.textContent = r.error; return }
    if (r.status === 'not_found') { status.textContent = `Not found on Elysium ${state.net}. Check the hash and the network.`; return }
    if (r.status === 'pending') { status.textContent = 'Seen by the sequencer, not yet in a block.'; return }
    status.textContent = r.nextEta ?? (r.status === 'assertion_confirmed' ? 'Fully settled.' : '')
    const now = Math.floor(Date.now() / 1000); const s = state.snapshot
    steps.forEach((li, i) => {
      const done = i < reached; const nowS = i === reached; const was = li.classList.contains('done')
      li.classList.toggle('done', done); li.classList.toggle('now', nowS)
      li.setAttribute('aria-current', nowS ? 'step' : 'false')
      ;(li.querySelector('.cb') as HTMLElement).textContent = done ? '✓' : String(i + 1)
      if (done && !was) gsap.fromTo(li, { x: -12, opacity: .4 }, { x: 0, opacity: 1, duration: .5, delay: i * .18, ease: 'power3.out' })
    })
    const sub = (i: number, html: string) => { (steps[i].querySelector('.rs') as HTMLElement).innerHTML = html }
    sub(0, r.included ? `block ${r.included.block.toLocaleString('en-US')} · ${fmtTime(r.included.timestamp)} · <a class="lnk" target="_blank" rel="noopener" href="${r.included.explorer}">explorer</a>` : '')
    sub(1, r.batched ? `batch #${r.batched.seq}${r.batched.postingDelay !== undefined ? ` · ${fmtAge(r.batched.postingDelay)} after the block` : ''} · <a class="lnk" target="_blank" rel="noopener" href="${r.batched.explorer}">${short(r.batched.l1Tx)}</a>` : s ? `batching is ${fmtAge(s.elysium.unbatchedSeconds)} behind head` : '')
    sub(2, r.l1 ? `${r.l1.confirmations.toLocaleString('en-US')} HyperEVM blocks on top` : '')
    sub(3, r.assertion ? (r.assertion.confirmedTime ? `confirmed ${fmtAge(now - r.assertion.confirmedTime)} ago${r.assertion.explorer ? ` · <a class="lnk" target="_blank" rel="noopener" href="${r.assertion.explorer}">tx</a>` : ''}` : `claim created, waiting for confirmation`) : '')
  }
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') void lookup(input.value) })
  input.addEventListener('paste', () => setTimeout(() => void lookup(input.value), 10))
  sample.addEventListener('click', async () => { status.textContent = 'Fetching a transaction from the newest batch…'; const r = await fetchSampleTx(state.net); if (r.hash) void lookup(r.hash); else status.textContent = 'No batched block with transactions yet.' })
  state.onNet.on(() => { current = ''; input.value = ''; steps.forEach((c) => { c.classList.remove('done', 'now'); (c.querySelector('.rs') as HTMLElement).textContent = '—' }) })
  drawHistory()
  return { el, onShow: () => gsap.fromTo(steps, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: .45, stagger: .08, ease: 'power2.out', overwrite: true }), focus: () => input.focus(), lookup }
}
