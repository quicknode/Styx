import gsap from 'gsap'
import { h, at, layer, s as svg, txt, G } from '../dom'
import { state } from '../state'
import { titleRow, Facts } from '../layout'
import { fetchSampleTx, fetchTx, fmtAge, fmtTime, short, type TxLadder } from '../api'

const STAGES = [
  { t: 'Included', side: 'ely', d: 'In an Elysium block. Only Elysium knows about it so far.' },
  { t: 'Batched', side: 'ely', d: 'Posted to HyperEVM inside a batch with its AnyTrust certificate.' },
  { t: 'Confirmed', side: 'hl', d: 'HyperEVM blocks are stacking on top of the batch.' },
  { t: 'Asserted', side: 'hl', d: 'The state claim covering it passed the challenge window.' },
]
const W = 1776, RAIL_Y = 170, HERO_H = 300
const SX = [120, 640, 1136, 1656] // station x positions on the rail

/** Track: a journey from Elysium to HyperEVM. The marker sits at the stage the transaction has reached. */
export function trackTab() {
  const el = h('div')
  const { controls } = titleRow(el, 'Follow one transaction <em>home</em>.')
  const input = h('input', { id: 'trk-big', type: 'search', placeholder: 'Paste an Elysium transaction hash', spellcheck: 'false', autocomplete: 'off', 'aria-label': 'Elysium transaction hash' }) as HTMLInputElement
  at(input, G.x(1), 68, G.w(9) - 16); input.style.height = '52px'; el.append(input)
  const sample = h('button', { class: 'home-go', type: 'button' }, [h('span', {}, 'Newest batched tx'), h('span', { class: 'arrow', 'aria-hidden': 'true' }, '→')]); at(sample, G.x(10), 68, G.w(3)); sample.style.height = '52px'; sample.style.boxShadow = 'none'; el.append(sample)
  void controls

  const headline = at(h('h3', { class: 'trk-head', 'aria-live': 'polite', html: 'Paste a hash to see where it is.' }), G.x(1), 150, G.w(12)); el.append(headline)

  // hero: two tinted regions, a rail, four stations
  const hero = at(h('div', { class: 'trk-hero' }), G.x(1), 220, W, HERO_H); el.append(hero)
  hero.append(at(h('div', { class: 'trk-region ely' }, [h('span', { class: 'panel-title ely' }, 'Elysium')]), 0, 0, W / 2 - 24, HERO_H))
  hero.append(at(h('div', { class: 'trk-region hl' }, [h('span', { class: 'panel-title hl' }, 'HyperEVM')]), W / 2 + 24, 0, W / 2 - 24, HERO_H))
  const sv = layer(W, HERO_H); hero.append(sv)
  sv.append(svg('path', { class: 'hair2', d: `M ${SX[0]} ${RAIL_Y} H ${SX[3]}` }))
  const progress = svg('path', { class: 'trk-progress', d: `M ${SX[0]} ${RAIL_Y} H ${SX[0]}` }); sv.append(progress)
  sv.append(txt(W / 2, RAIL_Y - 100, 'batch crosses here', '', 'middle'))
  sv.append(svg('path', { class: 'hair2 dash', d: `M ${W / 2} ${RAIL_Y - 88} V ${RAIL_Y + 70}` }))
  const stations = STAGES.map((st, i) => {
    const g = at(h('div', { class: 'trk-station ' + st.side }), SX[i], RAIL_Y, 0, 0)
    g.append(h('div', { class: 'node' }, String(i + 1)), h('div', { class: 'name' }, st.t), h('div', { class: 'when' }, ''), h('div', { class: 'desc' }, st.d))
    hero.append(g); return g
  })
  const marker = at(h('div', { class: 'trk-marker' }), SX[0], RAIL_Y); hero.append(marker)
  const ring = at(h('div', { class: 'trk-ring' }), SX[0], RAIL_Y); hero.append(ring)
  marker.style.opacity = '0'; ring.style.opacity = '0'

  const facts = new Facts(el, 560)
  const history: string[] = JSON.parse(localStorage.getItem('esm.hist') ?? '[]')
  let timer = 0; let current = ''; let reachedShown = -1

  async function lookup(hash: string) {
    hash = hash.trim(); if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) { headline.textContent = 'That is not a transaction hash.'; return }
    if (hash !== current) { reachedShown = -1 }
    current = hash; input.value = hash
    if (!history.includes(hash)) { history.unshift(hash); history.splice(12); localStorage.setItem('esm.hist', JSON.stringify(history)) }
    headline.classList.add('pulse')
    const r = await fetchTx(state.net, hash)
    headline.classList.remove('pulse'); render(r)
    clearTimeout(timer)
    if (r.status !== 'assertion_confirmed' && r.status !== 'not_found') timer = window.setTimeout(() => lookup(hash), 10000)
  }
  function render(r: TxLadder) {
    const reached = r.status === 'included' ? 1 : r.status === 'batched' ? 2 : r.status === 'l1_confirmed' ? 3 : r.status === 'assertion_confirmed' ? 4 : 0
    const now = Math.floor(Date.now() / 1000); const s = state.snapshot
    if (r.error) { headline.textContent = r.error; return }
    if (r.status === 'not_found') { headline.innerHTML = `Not found on Elysium <em>${state.net}</em>. Check the hash and the network.`; return }
    if (r.status === 'pending') { headline.innerHTML = 'Seen by the sequencer, <em>not yet</em> in a block.'; return }
    // headline
    const heads = [
      '',
      `Included on Elysium <em>${r.included ? fmtAge(now - r.included.timestamp) : ''} ago</em>, waiting for a batch.`,
      `Batched to HyperEVM <em>${r.batched ? fmtAge(now - r.batched.l1Time) : ''} ago</em>, confirmations stacking.`,
      `Confirmed on HyperEVM with <em>${r.l1 ? r.l1.confirmations.toLocaleString('en-US') : ''} blocks</em> on top, waiting for its claim.`,
      `Fully <em>settled</em>. The claim covering it is confirmed on HyperEVM.`,
    ]
    headline.innerHTML = heads[reached]
    // stations
    const whens = [
      r.included ? `block ${r.included.block.toLocaleString('en-US')} · ${fmtTime(r.included.timestamp)}` : '',
      r.batched ? `batch #${r.batched.seq} · ${fmtTime(r.batched.l1Time)}` : s && s.elysium.unbatchedSeconds > 60 ? `batching ${fmtAge(s.elysium.unbatchedSeconds)} behind` : 'next batch',
      r.l1 ? `${r.l1.confirmations.toLocaleString('en-US')} confirmations` : '',
      r.assertion ? (r.assertion.confirmedTime ? `confirmed ${fmtTime(r.assertion.confirmedTime)}` : `claim created, in window`) : s?.health.assertions.confirmPeriod ? `${Math.round(s.health.assertions.confirmPeriod / 3600)} h window` : '',
    ]
    stations.forEach((g, i) => {
      const done = i < reached; const here = i === reached - 1
      g.classList.toggle('done', done); g.classList.toggle('here', here)
      ;(g.querySelector('.node') as HTMLElement).textContent = done ? '✓' : String(i + 1)
      ;(g.querySelector('.when') as HTMLElement).textContent = whens[i]
    })
    // progress line + marker travel, only animate when the reached stage changes
    const tx = SX[Math.max(0, reached - 1)]
    if (reached !== reachedShown) {
      const from = reachedShown < 0 ? SX[0] : SX[Math.max(0, reachedShown - 1)]
      progress.setAttribute('d', `M ${SX[0]} ${RAIL_Y} H ${from}`)
      gsap.to({ x: from }, { x: tx, duration: .9, ease: 'power2.inOut', onUpdate() { const v = (this as any).targets()[0].x; progress.setAttribute('d', `M ${SX[0]} ${RAIL_Y} H ${v}`) } })
      gsap.to(marker, { left: tx, opacity: 1, duration: .9, ease: 'power2.inOut' })
      gsap.to(ring, { left: tx, opacity: 1, duration: .9, ease: 'power2.inOut' })
      for (let i = Math.max(0, reachedShown); i < reached; i++) gsap.fromTo(stations[i].querySelector('.node'), { scale: .6 }, { scale: 1, duration: .5, delay: .6 + i * .12, ease: 'back.out(2.5)' })
      reachedShown = reached
    }
    facts.set([
      { k: 'elysium block', v: r.included ? r.included.block.toLocaleString('en-US') : '—', s: r.included ? `${r.included.success ? 'success' : 'reverted'} · ${fmtTime(r.included.timestamp)}` : '' },
      { k: 'batch', v: r.batched ? `#${r.batched.seq}` : '<em>pending</em>', s: r.batched ? `${r.batched.postingDelay !== undefined ? fmtAge(r.batched.postingDelay) + ' after the block' : fmtTime(r.batched.l1Time)}` : (r.nextEta ?? ''), cls: 'hl' },
      { k: 'hyperevm confirmations', v: r.l1 ? r.l1.confirmations.toLocaleString('en-US') : '—', s: r.batched ? `since block ${r.batched.l1Block.toLocaleString('en-US')}` : '' },
      { k: 'state claim', v: r.assertion ? (r.assertion.confirmedTime ? 'confirmed' : '<em>in window</em>') : '<em>not yet</em>', s: r.assertion?.confirmedTime ? fmtAge(now - r.assertion.confirmedTime) + ' ago' : r.assertion?.createdTime ? `created ${fmtAge(now - r.assertion.createdTime)} ago` : '' },
    ])
    // links row under facts
    links.innerHTML = ''
    if (r.included) links.append(h('a', { class: 'lnk', target: '_blank', rel: 'noopener', href: r.included.explorer }, 'Elysium explorer'))
    if (r.batched) links.append(h('a', { class: 'lnk', target: '_blank', rel: 'noopener', href: r.batched.explorer }, `batch tx ${short(r.batched.l1Tx)}`))
    if (r.assertion?.explorer) links.append(h('a', { class: 'lnk', target: '_blank', rel: 'noopener', href: r.assertion.explorer }, 'claim tx'))
  }
  const links = at(h('div', { class: 'trk-links' }), G.x(1), 690, G.w(12)); el.append(links)
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') void lookup(input.value) })
  input.addEventListener('paste', () => setTimeout(() => void lookup(input.value), 10))
  sample.addEventListener('click', async () => { headline.textContent = 'Fetching a transaction from the newest batch…'; const r = await fetchSampleTx(state.net); if (r.hash) void lookup(r.hash); else headline.textContent = 'No batched block with transactions yet.' })
  state.onNet.on(() => { current = ''; reachedShown = -1; input.value = ''; headline.textContent = 'Paste a hash to see where it is.'; stations.forEach((g) => g.classList.remove('done', 'here')); progress.setAttribute('d', `M ${SX[0]} ${RAIL_Y} H ${SX[0]}`); marker.style.opacity = '0'; ring.style.opacity = '0' })
  return { el, onShow: () => gsap.fromTo([input, sample, headline, hero, facts.el], { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: .45, stagger: .06, ease: 'power2.out', overwrite: true }), focus: () => input.focus(), lookup }
}
