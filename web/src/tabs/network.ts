import { h, at, G } from '../dom'
import { state } from '../state'
import { copyBtn, link, tooltip } from '../ui'
import { titleRow, Facts, ROW } from '../layout'
import { fmtAge, fmtAgeShort } from '../api'

const NAME: Record<string, string> = { rollup: 'Rollup', sequencerInbox: 'Sequencer inbox', bridge: 'Bridge', inbox: 'Inbox', outbox: 'Outbox' }
const WHAT: Record<string, string> = { rollup: 'claims', sequencerInbox: 'batches', bridge: 'deposits', inbox: 'messages in', outbox: 'withdrawals' }
const QN_URL = 'https://www.quicknode.com/chains/elysium'
const ROWH = 44

/**
 * Network: the rules and the parties, all read from the contracts.
 * Facts (network, block interval, batch cadence, parent lag), then the rollup's parameters,
 * then who operates it (sequencer, validator, confirmer, committee), then the five contracts.
 */
export function networkTab() {
  const el = h('div')
  const { controls } = titleRow(el, 'Read from the <em>contracts</em>, nothing self-reported.')
  const cta = h('a', { class: 'home-go cta', href: QN_URL, target: '_blank', rel: 'noopener' }, [h('span', {}, 'Elysium on Quicknode'), h('span', { class: 'arrow', 'aria-hidden': 'true' }, '→')])
  controls.append(cta)

  // vertical plan: facts 80, rules 216, operators 352, contracts after, one-line foot at the bottom of the stage
  const Y_OPS = ROW.hero + 272, Y_CON = Y_OPS + 22 + 4 * ROWH + 26
  const facts = new Facts(el, ROW.hero)
  const rules = new Facts(el, ROW.hero + 136)
  const opsTitle = at(h('div', { class: 'eyebrow' }, 'Operators'), G.x(1), Y_OPS, G.w(12)); el.append(opsTitle)
  const ops = at(h('ul', { class: 'contracts', 'aria-label': 'Who runs the rollup' }), G.x(1), Y_OPS + 22, G.w(12)); el.append(ops)
  const conTitle = at(h('div', { class: 'eyebrow' }, 'Contracts on HyperEVM'), G.x(1), Y_CON, G.w(12)); el.append(conTitle)
  const list = at(h('ul', { class: 'contracts', 'aria-label': 'Rollup contracts on HyperEVM' }), G.x(1), Y_CON + 22, G.w(12)); el.append(list)
  const foot = at(h('p', { class: 'foot' }), G.x(1), Y_CON + 22 + 5 * ROWH + 18, G.w(12)); el.append(foot)

  const hype = (x: number) => x >= 1000 ? Math.round(x).toLocaleString('en-US') : x >= 1 ? x.toFixed(2) : x.toFixed(4)
  let sig = ''
  function draw() {
    const s = state.snapshot; if (!s) return
    const now = s.now; const p = s.params; const o = s.operators
    facts.set([
      { k: 'network', v: `Elysium <em>${s.network.name}</em>`, s: `chain ${s.network.elysiumChainId} · HyperEVM ${s.network.hyperevmChainId}${p.arbosVersion ? ` · ArbOS ${p.arbosVersion}` : ''}` },
      { k: 'block interval', v: `${Math.round(s.elysium.blockInterval)} <em>ms</em>`, s: 'measured over the last 120 heads' },
      { k: 'batch cadence', v: s.health.batches.medianInterval ? `every ${fmtAge(s.health.batches.medianInterval)}` : 'measuring', s: 'median of the last 12' },
      { k: 'parent lag', v: `${s.elysium.l1Lag} <em>blocks</em>`, s: 'HyperEVM blocks Elysium has not seen yet' },
    ])
    const win = s.health.assertions.confirmPeriod
    rules.set([
      { k: 'locked in the bridge', v: p.bridgeBalanceHype ? `${hype(p.bridgeBalanceHype)} <em>HYPE</em>` : 'reading', s: 'balance of the Bridge contract, live', cls: 'hl' },
      { k: 'challenge window', v: win ? `${win.toLocaleString('en-US')} <em>blocks</em>` : 'reading', s: win ? `about ${Math.round(win / 3600)} h before a claim can confirm` : 'confirmPeriodBlocks on the Rollup' },
      { k: 'force inclusion after', v: s.inclusion.forceWindowSec ? `${Math.round(s.inclusion.forceWindowSec / 3600)} <em>h</em>` : 'reading', s: 'for delayed messages the sequencer ignores' },
      { k: 'settlement cost today', v: s.costs.day.feeHype ? `${hype(s.costs.day.feeHype)} <em>HYPE</em>` : '0', s: `${s.costs.day.batches} batches posted in 24 h`, cls: 'amber' },
    ])
    // operators: identity-preserving rows, rebuilt only when the addresses change
    const stakeNote = `${p.minAssertionPeriodBlocks ? `a claim at most every ${p.minAssertionPeriodBlocks.toLocaleString('en-US')} blocks` : ''}${p.baseStakeHype ? ` · stake ${hype(p.baseStakeHype)} HYPE` : ''}${p.validatorsPermissioned === null ? '' : p.validatorsPermissioned ? ' · permissioned set' : ' · open set'}`.replace(/^ · /, '')
    const rows: { name: string; role: string; addr: string | null; note: string; tip: string }[] = [
      { name: 'Sequencer', role: 'posts batches', addr: o.sequencer?.address ?? null, note: o.sequencer ? `last batch ${fmtAgeShort(now - o.sequencer.lastAt)} ago` : 'no batch seen yet', tip: 'The address that sent the newest batch to the Sequencer inbox. Elysium runs a single sequencer.' },
      { name: 'Validator', role: 'posts claims', addr: o.validator?.address ?? null, note: o.validator ? `last claim ${fmtAgeShort(now - o.validator.lastAt)} ago · ${stakeNote}` : 'no claim seen yet', tip: 'The address that created the newest state claim on the Rollup, with the Rollup\'s own rules for claims.' },
      { name: 'Confirmer', role: 'confirms claims', addr: o.confirmer?.address ?? null, note: o.confirmer ? `last confirmation ${fmtAgeShort(now - o.confirmer.lastAt)} ago${s.health.assertions.confirmEvery ? ` · one every ${fmtAgeShort(s.health.assertions.confirmEvery)}` : ''}` : 'no confirmation seen yet', tip: 'The address that confirmed the newest claim after its challenge window. Withdrawals wait on this.' },
      { name: 'AnyTrust committee', role: 'signs data', addr: null, note: o.anytrustSigners !== null ? `${o.anytrustSigners} member${o.anytrustSigners === 1 ? '' : 's'} signed the newest certificate` : 'no certificate seen yet', tip: 'Batches carry a certificate signed by the data availability committee instead of the full data. The count is the signers mask in the newest certificate.' },
    ]
    const k = rows.map((r) => r.addr ?? '').join('|') + Object.keys(s.network.contracts).join(',')
    if (k !== sig) {
      sig = k
      ops.innerHTML = ''
      for (const r of rows) {
        const li = h('li', { class: 'contract' }, [
          h('span', { class: 'cn' }, r.name), h('span', { class: 'cw' }, r.role),
          h('span', { class: 'ca' }, r.addr ? [link(`${s.network.explorer.hyperevm}/address/${r.addr}`, r.addr), copyBtn(r.addr)] : [h('span', { class: 'ca-none' }, 'committee keys, not an address')]),
          h('span', { class: 'cl' }, r.note),
        ])
        tooltip(li.querySelector('.cn') as HTMLElement, () => r.tip)
        ops.append(li)
      }
      list.innerHTML = ''
      for (const [key, addr] of Object.entries(s.network.contracts)) {
        list.append(h('li', { class: 'contract' }, [
          h('span', { class: 'cn' }, NAME[key] ?? key), h('span', { class: 'cw' }, WHAT[key] ?? ''),
          h('span', { class: 'ca' }, [link(`${s.network.explorer.hyperevm}/address/${addr}`, addr), copyBtn(addr)]), h('span', { class: 'cl' }, ''),
        ]))
      }
    } else {
      // only the ages move between snapshots
      Array.from(ops.querySelectorAll('.cl')).forEach((n, i) => { if (n.textContent !== rows[i].note) n.textContent = rows[i].note })
    }
    foot.innerHTML = `Built on Elysium. Not affiliated with or endorsed by Kinetiq or Hyperliquid. Addresses from <a class="lnk" target="_blank" rel="noopener" href="https://elysium.kinetiq.xyz/docs/contract-addresses">Kinetiq's contract list</a>, everything else read from the contracts.`
  }
  state.onSnapshot.on(() => { if (el.style.display !== 'none') draw() })
  return { el, onShow: draw }
}
