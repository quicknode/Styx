import gsap from 'gsap'
import { h, at, G } from '../dom'
import { state } from '../state'
import { enter, link } from '../ui'
import { fetchSampleTx, fetchTx, fmtAge, fmtTime, short, type TxLadder } from '../api'

const STEPS = [
  { k: 'included', t: 'Included', d: 'The sequencer put the transaction in an Elysium block. You see a receipt in about 100 ms. The block is real and canonical, but it lives only on Elysium so far.' },
  { k: 'batched', t: 'Batched', d: 'The sequencer posted a batch to the SequencerInbox on HyperEVM that covers this block. With AnyTrust, the batch carries a committee certificate, not the data itself.' },
  { k: 'l1', t: 'Confirmed on HyperEVM', d: 'HyperEVM blocks are stacking on top of the batch. Reorganizing it away would now require reorganizing HyperEVM.' },
  { k: 'assertion', t: 'Asserted', d: 'An assertion covering this batch was created and then confirmed after the challenge window. Withdrawals that depend on this state can now execute.' },
]

/** Track: a large ladder with per-step explanations, a history of hashes, and a one-click sample. */
export function trackTab() {
  const el = h('div')
  el.append(at(h('div', { class: 'h2', html: 'Follow one transaction <em>home</em>.' }), G.x(1), 16))
  const input = h('input', { id: 'trk-big', placeholder: 'Paste an Elysium transaction hash (0x…)', spellcheck: 'false', autocomplete: 'off' }) as HTMLInputElement
  input.className = ''; input.id = 'trk-big'
  at(input, G.x(1), 80, G.w(8)); el.append(input)
  const sample = h('button', { class: 'btn ely' }, 'Try the newest batched tx'); at(sample, G.x(10), 80); el.append(sample)
  const status = at(h('div', { class: 'lbl', style: 'color:var(--ink-50)' }, 'The ladder below fills in as the transaction moves from Elysium to HyperEVM.'), G.x(1), 140); el.append(status)
  const ladder = at(h('div', { style: 'position:absolute' }), G.x(1), 180, G.w(12), 360); el.append(ladder)
  const steps = STEPS.map((s, i) => {
    const col = at(h('div', { class: 'rung', style: 'align-items:flex-start' }, [
      h('div', { class: 'cb', style: 'width:30px;height:30px;font-size:13px' }, String(i + 1)),
      h('div', { class: 'rb' }, [h('div', { class: 't', style: 'font-size:30px' }, s.t), h('div', { class: 's', style: 'font-size:12px;margin-top:8px;white-space:normal;line-height:1.5;color:var(--ink)' }, ''), h('div', { class: 'prose', style: 'position:relative;font-size:15px;margin-top:14px;color:var(--ink-50)' }, s.d)]),
    ]), i * (G.w(12) / 4), 0, G.w(12) / 4 - 24)
    ladder.append(col); return col
  })
  const histT = at(h('div', { class: 'lbl' }, 'Recent lookups'), G.x(1), 560); el.append(histT)
  const hist = at(h('div', { style: 'position:absolute;display:flex;flex-wrap:wrap;gap:8px' }), G.x(1), 586, G.w(12)); el.append(hist)
  const history: string[] = JSON.parse(localStorage.getItem('esm.hist') ?? '[]')
  let timer = 0; let current = ''

  function drawHistory() {
    hist.innerHTML = ''
    for (const hh of history.slice(0, 8)) { const b = h('button', { class: 'chipbtn' + (hh === current ? ' on' : '') }, short(hh)); b.addEventListener('click', () => lookup(hh)); hist.append(b) }
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
    if (r.status === 'not_found') { status.textContent = `Not found on Elysium ${state.net}. Check the hash and the network switch.`; return }
    if (r.status === 'pending') { status.textContent = 'Seen by the sequencer, not yet in a block.'; return }
    status.textContent = r.nextEta ?? (r.status === 'assertion_confirmed' ? 'Fully settled: the assertion covering this batch is confirmed on HyperEVM.' : '')
    const now = Math.floor(Date.now() / 1000); const s = state.snapshot
    steps.forEach((col, i) => {
      const done = i < reached; const nowS = i === reached; const was = col.classList.contains('done')
      col.classList.toggle('done', done); col.classList.toggle('now', nowS)
      col.querySelector('.cb')!.textContent = done ? '✓' : String(i + 1)
      if (done && !was) gsap.fromTo(col, { x: -10, opacity: .3 }, { x: 0, opacity: 1, duration: .5, delay: i * .2, ease: 'power3.out' })
    })
    const sub = (i: number, html: string) => { (steps[i].querySelector('.s') as HTMLElement).innerHTML = html }
    sub(0, r.included ? `Block ${r.included.block.toLocaleString('en-US')} · ${fmtTime(r.included.timestamp)} · ${r.included.success ? 'success' : 'reverted'} · <a class="lnk" target="_blank" rel="noopener" href="${r.included.explorer}">explorer</a>` : '')
    sub(1, r.batched ? `Batch #${r.batched.seq} · landed ${fmtTime(r.batched.l1Time)}${r.batched.postingDelay !== undefined ? ` · ${fmtAge(r.batched.postingDelay)} after the block` : ''} · ${r.batched.daMode} · <a class="lnk" target="_blank" rel="noopener" href="${r.batched.explorer}">${short(r.batched.l1Tx)}</a>` : s ? `Waiting. Batching is ${fmtAge(s.elysium.unbatchedSeconds)} behind head.` : '')
    sub(2, r.l1 ? `${r.l1.confirmations.toLocaleString('en-US')} HyperEVM blocks on top of the batch` : '')
    sub(3, r.assertion ? (r.assertion.confirmedTime ? `Confirmed ${fmtAge(now - r.assertion.confirmedTime)} ago${r.assertion.explorer ? ` · <a class="lnk" target="_blank" rel="noopener" href="${r.assertion.explorer}">tx</a>` : ''}` : `Created ${r.assertion.createdTime ? fmtAge(now - r.assertion.createdTime) + ' ago' : ''}, waiting for confirmation`) : '')
  }
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') void lookup(input.value) })
  input.addEventListener('paste', () => setTimeout(() => void lookup(input.value), 10))
  sample.addEventListener('click', async () => { status.textContent = 'Fetching a transaction from the newest batch…'; const r = await fetchSampleTx(state.net); if (r.hash) void lookup(r.hash); else status.textContent = 'No batched block with transactions found yet.' })
  state.onNet.on(() => { current = ''; input.value = ''; steps.forEach((c) => { c.classList.remove('done', 'now') }) })
  drawHistory()
  enter(steps, .08)
  return { el, onShow: () => enter(steps, .06), focus: () => input.focus(), lookup }
}
