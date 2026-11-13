import gsap from 'gsap'
import { h, at, G } from '../dom'
import { state } from '../state'
import { copyBtn, link, tooltip } from '../ui'
import { titleRow, Facts, ROW } from '../layout'
import { fmtAge, fmtAgeShort, short } from '../api'

const NAME: Record<string, string> = { rollup: 'Rollup', sequencerInbox: 'Sequencer inbox', bridge: 'Bridge', inbox: 'Inbox', outbox: 'Outbox' }
const WHAT: Record<string, string> = { rollup: 'claims', sequencerInbox: 'batches', bridge: 'deposits', inbox: 'messages in', outbox: 'withdrawals' }
const QN_URL = 'https://www.quicknode.com/chains/elysium'

/**
 * Network: who runs the rollup, the rules it runs under, and the contracts it lives in.
 * Hero: three operator cards (sequencer, validator, committee). Then four facts. Then five contract chips.
 */
export function networkTab() {
  const el = h('div')
  const { controls } = titleRow(el, 'Who runs it, and <em>under what rules</em>.')
  controls.append(h('a', { class: 'home-go cta', href: QN_URL, target: '_blank', rel: 'noopener' }, [h('span', {}, 'Elysium on Quicknode'), h('span', { class: 'arrow', 'aria-hidden': 'true' }, '→')]))
  const chainLine = at(h('div', { class: 'chainline' }), G.x(1), 56, G.w(8)); el.append(chainLine)

  // hero: three cards on columns 1-4, 5-8, 9-12
  const CARD_Y = ROW.hero + 24, CARD_H = 236
  const mk = (cls: string, col: number) => { const c = at(h('div', { class: 'opcard ' + cls }), G.x(col), CARD_Y, G.w(4), CARD_H); el.append(c); return c }
  const cards = [mk('ely', 1), mk('hl', 5), mk('ink', 9)]
  const facts = new Facts(el, CARD_Y + CARD_H + 48)
  const conTitle = at(h('div', { class: 'eyebrow' }, 'Contracts on HyperEVM'), G.x(1), CARD_Y + CARD_H + 48 + 150, G.w(12)); el.append(conTitle)
  const chips = at(h('div', { class: 'cchips' }), G.x(1), CARD_Y + CARD_H + 48 + 186, G.w(12)); el.append(chips)
  const foot = at(h('p', { class: 'foot' }), G.x(1), CARD_Y + CARD_H + 48 + 186 + 124, G.w(12)); el.append(foot)

  const hype = (x: number) => x >= 1000 ? Math.round(x).toLocaleString('en-US') : (x >= 1 ? x.toFixed(2) : x.toFixed(4)).replace(/\.?0+$/, '')
  let sig = ''
  let built = false
  function card(c: HTMLElement, role: string, does: string, addr: string | null, big: string, small: string, live: boolean, tip: string, explorer: string) {
    const key = `${role}|${addr}|${big}|${small}|${live}`
    if (c.dataset.key === key) return
    const rebuild = c.dataset.role !== role || c.dataset.addr !== (addr ?? '')
    c.dataset.key = key; c.dataset.role = role; c.dataset.addr = addr ?? ''
    if (rebuild) {
      c.innerHTML = ''
      const head = h('div', { class: 'op-head' }, [h('span', { class: 'op-role' }, role), h('span', { class: 'op-does' }, does), h('i', { class: 'op-dot' })])
      const who = h('div', { class: 'op-who' }, addr ? [link(`${explorer}/address/${addr}`, short(addr)), copyBtn(addr)] : [h('span', { class: 'op-none' }, 'a keyset, not one address')])
      if (addr) tooltip(who, () => addr)
      c.append(head, who, h('div', { class: 'op-big' }), h('div', { class: 'op-small' }))
      tooltip(head, () => tip)
    }
    const bigEl = c.querySelector('.op-big') as HTMLElement; const smallEl = c.querySelector('.op-small') as HTMLElement
    if (bigEl.innerHTML !== big) { const shape = (x: string) => x.replace(/\d[\d,.]*/g, '#'); const same = shape(bigEl.innerHTML) === shape(big); bigEl.innerHTML = big; if (!same && built) gsap.fromTo(bigEl, { opacity: .3, y: 4 }, { opacity: 1, y: 0, duration: .4 }) }
    if (smallEl.textContent !== small) smallEl.textContent = small
    c.classList.toggle('live', live)
  }

  function draw() {
    const s = state.snapshot; if (!s) return
    const now = s.now; const p = s.params; const o = s.operators; const ex = s.network.explorer.hyperevm
    chainLine.textContent = `chain ${s.network.elysiumChainId} · settles to HyperEVM ${s.network.hyperevmChainId}${p.arbosVersion ? ` · ArbOS ${p.arbosVersion}` : ''}${s.inclusion.forceWindowSec ? ` · force inclusion after ${Math.round(s.inclusion.forceWindowSec / 3600)} h` : ''}${p.validatorsPermissioned === null ? '' : p.validatorsPermissioned ? ' · permissioned validators' : ' · open validator set'}`
    const bc = s.health.batches.medianInterval
    card(cards[0], 'Sequencer', 'posts batches', o.sequencer?.address ?? null,
      o.sequencer ? `last batch <em>${fmtAgeShort(now - o.sequencer.lastAt)}</em> ago` : 'no batch seen yet',
      `${bc ? `one every ${fmtAgeShort(bc)}` : 'measuring cadence'} · ${s.costs.day.batches} in 24 h · ${s.costs.day.feeHype ? hype(s.costs.day.feeHype) : '0'} HYPE spent`,
      !!o.sequencer && now - o.sequencer.lastAt < Math.max(3600, bc * 2),
      'The address that sent the newest batch to the Sequencer inbox. Elysium runs a single sequencer.', ex)
    const sameConf = o.confirmer && o.validator && o.confirmer.address.toLowerCase() === o.validator.address.toLowerCase()
    const ce = s.health.assertions.confirmEvery
    card(cards[1], 'Validator', sameConf || !o.confirmer ? 'posts and confirms claims' : 'posts claims', o.validator?.address ?? null,
      o.validator ? `last claim <em>${fmtAgeShort(now - o.validator.lastAt)}</em> ago` : 'no claim seen yet',
      `${o.confirmer ? `confirms ${ce ? `one every ${fmtAgeShort(ce)}` : 'in runs'}, last ${fmtAgeShort(now - o.confirmer.lastAt)} ago${sameConf ? '' : ` from ${short(o.confirmer.address)}`}` : 'no confirmation seen yet'}${p.baseStakeHype ? ` · stake ${hype(p.baseStakeHype)} HYPE` : ''}`,
      !!o.validator && now - o.validator.lastAt < 2 * 3600,
      'The address that created the newest state claim on the Rollup, and the one that confirms claims after their challenge window. Withdrawals wait on confirmations.', ex)
    const lastB = s.batches.at(-1)
    card(cards[2], 'AnyTrust committee', 'signs the data', null,
      o.anytrustSigners !== null ? `<em>${o.anytrustSigners}</em> signer${o.anytrustSigners === 1 ? '' : 's'} on the newest certificate` : 'no certificate seen yet',
      lastB ? `${lastB.dataBytes} byte certificate posted as calldata · full data only if the committee fails` : '',
      o.anytrustSigners !== null && lastB?.daMode === 'anytrust',
      'Batches carry a certificate signed by the data availability committee instead of the full data. The count is the signers mask inside the newest certificate.', ex)

    const win = s.health.assertions.confirmPeriod
    facts.set([
      { k: 'locked in the bridge', v: p.bridgeBalanceHype ? `${hype(p.bridgeBalanceHype)} <em>HYPE</em>` : 'reading', s: 'balance of the Bridge contract, live', cls: 'hl' },
      { k: 'challenge window', v: win ? `${Math.round(win / 3600)} <em>h</em>` : 'reading', s: win ? `${win.toLocaleString('en-US')} HyperEVM blocks, read from the Rollup` : 'confirmPeriodBlocks on the Rollup' },
      { k: 'block interval', v: `${Math.round(s.elysium.blockInterval)} <em>ms</em>`, s: 'measured over the last 120 heads' },
      { k: 'batch cadence', v: bc ? `every ${fmtAge(bc)}` : 'measuring', s: 'median of the last 12' },
    ])
    const k = Object.entries(s.network.contracts).map(([a, b]) => a + b).join('|')
    if (k !== sig) {
      sig = k; chips.innerHTML = ''
      for (const [key, addr] of Object.entries(s.network.contracts)) {
        const chip = h('div', { class: 'cchip' }, [
          h('div', { class: 'cc-name' }, NAME[key] ?? key), h('div', { class: 'cc-role' }, WHAT[key] ?? ''),
          h('div', { class: 'cc-addr' }, [link(`${ex}/address/${addr}`, short(addr)), copyBtn(addr)]),
        ])
        tooltip(chip.querySelector('.cc-addr') as HTMLElement, () => addr)
        chips.append(chip)
      }
    }
    foot.innerHTML = `Built on Elysium. Not affiliated with or endorsed by Kinetiq or Hyperliquid. Addresses from <a class="lnk" target="_blank" rel="noopener" href="https://elysium.kinetiq.xyz/docs/contract-addresses">Kinetiq's contract list</a>, everything else read from the contracts.`
    if (!built) { built = true; gsap.fromTo([...cards, facts.el, conTitle, chips, foot], { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: .45, stagger: .06, ease: 'power2.out' }) }
  }
  state.onSnapshot.on(() => { if (el.style.display !== 'none') draw() })
  return { el, onShow: draw }
}
