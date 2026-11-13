import gsap from 'gsap'
import { h, at, layer, s as svg, txt, G } from '../dom'
import { state } from '../state'
import { titleRow, Facts } from '../layout'
import { tooltip } from '../ui'
import { fetchSampleTx, fetchTx, fmtAge, fmtAgeShort, fmtClock, fmtTime, short, type TxLadder } from '../api'

/**
 * Track: a journey from Elysium to HyperEVM in five stations.
 * Reached stations are filled, the current one pulses, stations still ahead are hollow and carry
 * the time the measured cadence expects them at. The challenge window is a fill bar on the rail.
 */
const STAGES = [
  { id: 'included', t: 'Included', side: 'ely', d: 'In an Elysium block. Only Elysium knows about it so far.' },
  { id: 'batched', t: 'Batched', side: 'ely', d: 'Posted to HyperEVM inside a batch with its AnyTrust certificate.' },
  { id: 'confirmed', t: 'Confirmed', side: 'hl', d: 'HyperEVM blocks are stacking on top of the batch.' },
  { id: 'claimed', t: 'Claimed', side: 'hl', d: 'A validator posted a state claim covering it. The challenge window starts.', short: 'A validator posted a state claim covering it.' },
  { id: 'final', t: 'Final', side: 'hl', d: 'The claim passed its window and was confirmed on HyperEVM. Withdrawals covered by it can execute.', short: 'The claim passed its window and was confirmed.' },
] as const
const W = 1776, RAIL_Y = 170, HERO_H = 300, GATE = 724
const SX = [175, 525, 919, 1262, 1605] // station x positions on the rail

const inAbout = (ts: number, now: number) => { const d = ts - now; return d < 90 ? 'in about a minute' : d < 3600 ? `in about ${Math.round(d / 60)} min` : d < 7200 ? 'in about an hour' : fmtClock(ts) }

export function trackTab() {
  const el = h('div')
  const { controls } = titleRow(el, 'Follow one transaction <em>home</em>.'); void controls
  const input = h('input', { id: 'trk-big', type: 'search', placeholder: 'Paste an Elysium transaction hash', spellcheck: 'false', autocomplete: 'off', 'aria-label': 'Elysium transaction hash' }) as HTMLInputElement
  at(input, G.x(1), 68, G.w(9) - 16); input.style.height = '52px'; el.append(input)
  const sample = h('button', { class: 'home-go', type: 'button' }, [h('span', {}, 'Newest batched tx'), h('span', { class: 'arrow', 'aria-hidden': 'true' }, '→')]); at(sample, G.x(10), 68, G.w(3)); sample.style.height = '52px'; sample.style.boxShadow = 'none'; el.append(sample)
  const headline = at(h('h3', { class: 'trk-head', 'aria-live': 'polite', html: 'Paste a hash to see where it is.' }), G.x(1), 150, G.w(11)); el.append(headline)
  const live = at(h('span', { class: 'trk-live', title: 'Watching this transaction' }), G.x(12) + G.w(1) - 10, 168, 10, 10); el.append(live); live.style.opacity = '0'

  // hero: two tinted regions, a rail, five stations
  const hero = at(h('div', { class: 'trk-hero' }), G.x(1), 220, W, HERO_H); el.append(hero)
  hero.append(at(h('div', { class: 'trk-region ely' }, [h('span', { class: 'panel-title ely' }, 'Elysium')]), 0, 0, GATE - 24, HERO_H))
  hero.append(at(h('div', { class: 'trk-region hl' }, [h('span', { class: 'panel-title hl' }, 'HyperEVM')]), GATE + 24, 0, W - GATE - 24, HERO_H))
  const sv = layer(W, HERO_H); hero.append(sv)
  sv.append(svg('path', { class: 'hair2', d: `M ${SX[0]} ${RAIL_Y} H ${SX[4]}` }))
  const progress = svg('path', { class: 'trk-progress', d: `M ${SX[0]} ${RAIL_Y} H ${SX[0]}` }); sv.append(progress)
  const pending = svg('path', { class: 'trk-pending', d: '' }); sv.append(pending)
  sv.append(txt(GATE, RAIL_Y - 100, 'batch crosses here', '', 'middle'))
  const gate = svg('path', { class: 'hair2 dash trk-gate', d: `M ${GATE} ${RAIL_Y - 84} V ${RAIL_Y + 74}` }); sv.append(gate)
  // the challenge window: a fill bar on the rail between Claimed and Final
  const win = at(h('div', { class: 'trk-window' }, [h('i')]), SX[3] + 24, RAIL_Y - 4, SX[4] - SX[3] - 48); hero.append(win)
  const winFill = win.firstElementChild as HTMLElement
  const winLabel = at(h('div', { class: 'trk-wlabel' }), (SX[3] + SX[4]) / 2, RAIL_Y - 28); hero.append(winLabel)
  win.style.opacity = '0'; winLabel.style.opacity = '0'
  const stations = STAGES.map((st, i) => {
    const g = at(h('div', { class: 'trk-station ' + st.side }), SX[i], RAIL_Y, 0, 0)
    const node = h('div', { class: 'node', tabindex: '0', role: 'img', 'aria-label': st.t }, String(i + 1))
    g.append(node, h('div', { class: 'name' }, st.t), h('div', { class: 'when' }, ''), h('div', { class: 'desc' }, ('short' in st ? st.short : st.d) as string))
    tooltip(node, () => `<b>${st.t}</b><br>${st.d}`)
    hero.append(g); return g
  })
  const ring = at(h('div', { class: 'trk-ring' }), SX[0], RAIL_Y); hero.append(ring)
  const packet = at(h('div', { class: 'trk-packet' }), SX[0], RAIL_Y); hero.append(packet)
  ring.style.opacity = '0'; packet.style.opacity = '0'
  const regions = Array.from(hero.querySelectorAll('.trk-region')) as HTMLElement[]

  // below the hero: the transaction card, explorer links, a legend, and how the estimates are made
  const facts = new Facts(el, 560)
  const links = at(h('div', { class: 'trk-links' }), G.x(1), 690, G.w(8)); el.append(links)
  const legend = at(h('div', { class: 'trk-legend' }, [
    h('span', { class: 'tl' }, [h('i', { class: 'tl-done' }), 'reached']), h('span', { class: 'tl' }, [h('i', { class: 'tl-here' }), 'current']),
    h('span', { class: 'tl' }, [h('i', { class: 'tl-next' }), 'expected']), h('span', { class: 'tl' }, [h('i', { class: 'tl-band' }), 'challenge window']),
  ]), G.x(9), 692, G.w(4)); el.append(legend); legend.style.opacity = '0'
  const note = at(h('p', { class: 'home-next' }, ''), G.x(1), 734, G.w(12)); el.append(note)

  const hist: string[] = JSON.parse(localStorage.getItem('esm.hist') ?? '[]')
  // a tx in the URL is looked up once the network has started (start() emits onNet, which resets this tab)
  let bootTx = location.hash.match(/tx=(0x[0-9a-fA-F]{64})/)?.[1] ?? ''
  let timer = 0; let current = ''; let last: TxLadder | null = null; let reachedShown = -1
  const now = () => Math.floor(Date.now() / 1000)

  async function lookup(hash: string) {
    hash = hash.trim(); if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) { headline.textContent = 'That is not a transaction hash.'; return }
    if (hash !== current) { clear(false); current = hash; input.value = hash }
    if (!hist.includes(hash)) { hist.unshift(hash); hist.splice(12); localStorage.setItem('esm.hist', JSON.stringify(hist)) }
    setUrl(hash)
    headline.classList.add('pulse')
    let r: TxLadder
    try { r = await fetchTx(state.net, hash) } catch { headline.classList.remove('pulse'); headline.textContent = 'The monitor did not answer. Trying again shortly.'; timer = window.setTimeout(() => lookup(hash), 5000); return }
    headline.classList.remove('pulse')
    if (hash !== current) return
    render(r)
    clearTimeout(timer)
    const done = (r.status === 'final' && (!r.withdrawal || !!r.withdrawal.executedTime)) || r.status === 'not_found' || r.status === 'hyperevm' || !!r.error
    gsap.to(live, { opacity: done ? 0 : 1, duration: .3 })
    if (!done) timer = window.setTimeout(() => lookup(hash), r.status === 'pending' ? 3000 : 10000)
  }
  function setUrl(hash: string | null) {
    const net = location.hash.match(/net=(mainnet|testnet)/)?.[1] ?? state.net
    history.replaceState(null, '', `#tab=track&net=${net}${hash ? `&tx=${hash}` : ''}`)
  }

  function render(r: TxLadder) {
    last = r
    const n = now()
    if (r.error) { headline.textContent = r.error; return }
    if (r.status === 'not_found') { headline.innerHTML = `Not found on Elysium <em>${state.net}</em>. Check the hash and the network.`; return }
    if (r.status === 'hyperevm') { headline.innerHTML = 'That is a <em>HyperEVM</em> transaction, not an Elysium one.'; links.innerHTML = ''; links.append(h('a', { class: 'lnk', target: '_blank', rel: 'noopener', href: r.hyperevmExplorer! }, 'Open it on the HyperEVM explorer')); return }
    if (r.status === 'pending') { headline.innerHTML = 'Seen by the sequencer, <em>not yet</em> in a block.'; return }
    if (!r.included || !r.tx) return

    const reached = r.status === 'final' ? 5 : r.status === 'claimed' ? 4 : r.status === 'l1_confirmed' ? 3 : r.status === 'batched' ? 2 : 1
    const conf = r.l1?.confirmations ?? 0
    const windowEnd = r.claim?.windowEnd ?? r.expect.windowEndAt
    const finalAt = r.expect.finalAt
    const finalTxt = finalAt ? (finalAt - n < 7200 ? inAbout(finalAt, n) : fmtClock(finalAt)) : ''
    const wd = r.withdrawal

    // headline: where it is, and when the next thing happens
    const heads: Record<string, string> = {
      included: r.tx.success ? `Included on Elysium. Next batch expected <em>${inAbout(r.expect.batchAt ?? n, n)}</em>.` : 'Included on Elysium but <em>reverted</em>. It still settles like any other transaction.',
      batched: 'Posted to HyperEVM, waiting for its first block on top.',
      l1_confirmed: `On HyperEVM, <em>${conf.toLocaleString('en-US')} blocks</em> deep. Claim expected ${inAbout(r.expect.claimAt ?? n, n)}, final ${finalTxt}.`,
      claimed: `Claimed. Challenge window closes <em>${windowEnd ? inAbout(windowEnd, n) : 'soon'}</em>, ${finalAt && windowEnd && finalAt - windowEnd < 600 ? 'then it is final' : `final ${finalTxt}`}.`,
      final: wd ? (wd.executedTime ? 'Final, and the withdrawal was <em>executed</em> on HyperEVM.' : 'Final. The withdrawal can now be <em>executed</em> on HyperEVM.') : `Final. Settled on HyperEVM <em>${fmtAgeShort(n - (r.claim?.confirmedTime ?? n))} ago</em>.`,
    }
    const headHtml = heads[r.status] ?? ''
    if (headline.innerHTML !== headHtml) {
      // animate only when the wording changes, not when a number ticks
      const shape = (x: string) => x.replace(/\d[\d,.]*/g, '#')
      const sameShape = shape(headline.innerHTML) === shape(headHtml)
      headline.innerHTML = headHtml
      if (!sameShape) gsap.fromTo(headline, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: .4, ease: 'power2.out' })
    }

    // station states and their one-line facts
    const whens = [
      `block ${r.included.block.toLocaleString('en-US')} · ${fmtTime(r.included.timestamp)}`,
      r.batched ? `batch #${r.batched.seq} · ${fmtAge(r.batched.postingDelay ?? (r.batched.l1Time - r.included.timestamp))} later` : `expected ${inAbout(r.expect.batchAt ?? n, n)}`,
      r.batched ? `<b>${conf.toLocaleString('en-US')}</b> blocks on top` : 'after the batch lands',
      r.claim ? `claim ${short(r.claim.hash)} · ${fmtAgeShort((r.claim.createdTime ?? n) - r.included.timestamp)} later` : `expected ${inAbout(r.expect.claimAt ?? n, n)}`,
      r.claim?.confirmedTime ? `confirmed ${fmtClock(r.claim.confirmedTime)}` : `expected ${finalAt ? fmtClock(finalAt) : 'after the window'}`,
    ]
    stations.forEach((g, i) => {
      const done = i < reached
      g.classList.toggle('done', done); g.classList.toggle('here', i === reached - 1); g.classList.toggle('next', !done)
      const when = g.querySelector('.when') as HTMLElement
      if (when.innerHTML !== whens[i]) when.innerHTML = whens[i]
    })
    // the challenge window bar fills as the window elapses
    if (r.claim && !r.claim.confirmedTime && r.claim.createdTime) {
      const frac = Math.min(1, (n - r.claim.createdTime) / Math.max(1, r.cadence.period))
      winLabel.textContent = `${Math.round(r.cadence.period / 3600)} h window · ${Math.round(frac * 100)}% elapsed`
      gsap.to(winFill, { width: `${frac * 100}%`, duration: .8, ease: 'power2.out' })
      gsap.to([win, winLabel], { opacity: 1, duration: .3 })
    } else if (r.claim?.confirmedTime) {
      winLabel.textContent = `${Math.round(r.cadence.period / 3600)} h window · passed`
      gsap.set(winFill, { width: '100%' }); gsap.to([win, winLabel], { opacity: 1, duration: .3 })
    } else { gsap.to([win, winLabel], { opacity: 0, duration: .3 }) }

    // the rail: solid to the reached station, marching dashes to the next one (the window bar covers Claimed to Final)
    const tx = SX[reached - 1]
    pending.setAttribute('d', reached < 4 ? `M ${tx} ${RAIL_Y} H ${SX[reached]}` : '')
    regions[0].classList.toggle('focus', reached <= 2); regions[1].classList.toggle('focus', reached >= 3)
    if (reached !== reachedShown) {
      const from = reachedShown < 0 ? SX[0] : SX[Math.max(0, reachedShown - 1)]
      const crossing = from < GATE && tx > GATE
      const dur = reachedShown < 0 ? Math.min(1.4, .4 + reached * .25) : .7
      progress.setAttribute('d', `M ${SX[0]} ${RAIL_Y} H ${from}`)
      const o = { x: from }
      gsap.set(packet, { opacity: 1, scale: 1 })
      gsap.to(o, { x: tx, duration: dur, ease: 'power2.inOut', onUpdate: () => { progress.setAttribute('d', `M ${SX[0]} ${RAIL_Y} H ${o.x}`); packet.style.left = o.x + 'px' } })
      gsap.fromTo(packet, { opacity: 1, scale: 1 }, { opacity: 0, scale: .4, duration: .25, delay: dur, ease: 'power2.in' })
      gsap.to(ring, { left: tx, opacity: 1, duration: dur, ease: 'power2.inOut' })
      if (crossing) gsap.fromTo(gate, { strokeWidth: 1, opacity: 1 }, { strokeWidth: 6, opacity: 0, duration: .6, delay: dur * .5, ease: 'power2.out', onComplete: () => { gate.style.strokeWidth = ''; gate.style.opacity = '' } })
      // stations pop as the packet passes them; the ones ahead fade in hollow
      const first = Math.max(0, reachedShown)
      for (let i = first; i < reached; i++) {
        const t = from >= tx ? 0 : dur * (SX[i] - from) / (tx - from)
        gsap.fromTo(stations[i].querySelector('.node'), { scale: .5 }, { scale: 1, duration: .4, delay: Math.max(0, t), ease: 'back.out(3)' })
        gsap.fromTo(stations[i].querySelector('.when'), { opacity: 0, y: 4 }, { opacity: 1, y: 0, duration: .3, delay: Math.max(0, t) + .1 })
      }
      if (reachedShown < 0) {
        for (let i = reached; i < 5; i++) gsap.fromTo(stations[i].querySelector('.when'), { opacity: 0 }, { opacity: 1, duration: .4, delay: dur + .1 + (i - reached) * .08 })
        gsap.to(legend, { opacity: 1, duration: .4, delay: dur + .3 })
      }
      reachedShown = reached
    }

    // the transaction card
    const t = r.tx
    facts.set([
      { k: 'from', v: short(t.from), s: `nonce ${t.nonce}` },
      { k: 'to', v: t.to ? short(t.to) : '<em>new contract</em>', s: t.to ? (t.method === 'HYPE transfer' ? 'account' : 'contract call') : 'created by this transaction' },
      { k: 'value', v: t.valueHype === '0' ? '0' : `${t.valueHype} <em>HYPE</em>`, s: `${t.gasUsed.toLocaleString('en-US')} gas used` },
      { k: 'call', v: t.success ? t.method : '<em>reverted</em>', s: t.success ? (wd ? 'success · a withdrawal to HyperEVM' : 'success') : `${t.method} · reverted`, cls: t.success ? '' : 'warn' },
    ])
    links.innerHTML = ''
    const lnk = (href: string, text: string) => links.append(h('a', { class: 'lnk', target: '_blank', rel: 'noopener', href }, text))
    lnk(r.included.explorer, 'Elysium explorer')
    if (r.batched) lnk(r.batched.explorer, `batch #${r.batched.seq} tx`)
    if (r.claim?.explorer) lnk(r.claim.explorer, 'claim tx')
    if (r.claim?.confirmExplorer) lnk(r.claim.confirmExplorer, 'confirmation tx')
    if (wd?.explorer) lnk(wd.explorer, 'outbox tx')
    const c = r.cadence; const blocks = state.snapshot?.health.assertions.confirmPeriod || Math.round(c.period / c.l1BlockSec)
    note.textContent = `Expected times come from what the chain did in the last day: a batch every ${fmtAgeShort(c.batchEvery)}, a claim every ${fmtAgeShort(c.claimEvery)}, a challenge window of ${blocks.toLocaleString('en-US')} HyperEVM blocks (about ${Math.round(c.period / 3600)} h at today's block pace), and ${c.confirmEvery ? `a confirmation run every ${fmtAgeShort(c.confirmEvery)} that confirms ${c.perRun === 1 ? 'one claim' : c.perRun + ' claims'} in order, with ${c.queueAhead} claim${c.queueAhead === 1 ? '' : 's'} ahead of this one` : 'confirmations landing as soon as the window closes'}.`
  }

  // confirmations tick with every HyperEVM block, between repolls
  state.onL1Head.on(({ number }) => {
    if (!last?.batched || !current) return
    const conf = Math.max(0, number - last.batched.l1Block + 1); last.l1 = { confirmations: conf, head: number }
    const b = stations[2].querySelector('.when b'); const v = conf.toLocaleString('en-US')
    if (b && b.textContent !== v) { b.textContent = v; gsap.fromTo(b, { opacity: .65 }, { opacity: 1, duration: .4 }) }
  })

  function clear(resetInput: boolean) {
    clearTimeout(timer); current = ''; last = null; reachedShown = -1
    if (resetInput) { input.value = ''; setUrl(null) }
    headline.innerHTML = 'Paste a hash to see where it is.'
    stations.forEach((g) => { g.classList.remove('done', 'here', 'next'); (g.querySelector('.when') as HTMLElement).textContent = '' })
    regions.forEach((rg) => rg.classList.remove('focus'))
    progress.setAttribute('d', `M ${SX[0]} ${RAIL_Y} H ${SX[0]}`); pending.setAttribute('d', '')
    gsap.to([ring, packet, win, winLabel, legend, live], { opacity: 0, duration: .25, overwrite: true })
    gsap.set(winFill, { width: 0 })
    facts.set([]); links.innerHTML = ''; note.textContent = ''
  }
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') void lookup(input.value); if (e.key === 'Escape') clear(true) })
  input.addEventListener('paste', () => setTimeout(() => void lookup(input.value), 10))
  // the field's own × (type=search) and manual deletion both fire these
  input.addEventListener('search', () => { if (!input.value.trim()) clear(true) })
  input.addEventListener('input', () => { if (!input.value.trim() && current) clear(true) })
  sample.addEventListener('click', async () => { headline.textContent = 'Fetching a transaction from the newest batch…'; const r = await fetchSampleTx(state.net); if (r.hash) void lookup(r.hash); else headline.textContent = 'No batched block with transactions yet.' })
  state.onNet.on(() => { clear(true); if (bootTx) { const t = bootTx; bootTx = ''; void lookup(t) } })
  return {
    el,
    onShow: () => {
      gsap.fromTo([input, sample, headline, hero, facts.el], { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: .45, stagger: .06, ease: 'power2.out', overwrite: true })
      if (current) setUrl(current)
    },
    focus: () => input.focus(), lookup,
  }
}
