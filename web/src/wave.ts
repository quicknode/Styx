import gsap from 'gsap'

/**
 * The Styx river line. Instead of looping keyframes, the curve is regenerated every frame
 * from a sum of slow sines with unrelated frequencies, so it drifts like water and never
 * repeats, and every change of direction is continuous.
 */
export function startWave(path: SVGPathElement, width = 96, mid = 6) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const N = 24
  const xs = Array.from({ length: N + 1 }, (_, i) => (i / N) * width)
  const t0 = performance.now()
  let offset = 0
  const tick = () => {
    const t = (performance.now() - t0) / 1000
    // y(x,t): three travelling waves with incommensurate wavelengths and speeds, plus a slow breathing amplitude
    const amp = 2.2 + 0.8 * Math.sin(t * 0.37)
    const ys = xs.map((x) =>
      mid +
      amp * (0.55 * Math.sin(x * 0.21 - t * 1.13) + 0.30 * Math.sin(x * 0.37 + t * 0.71 + 1.3) + 0.15 * Math.sin(x * 0.09 - t * 0.29 + 2.1)))
    // smooth Catmull-Rom through the samples
    let d = `M ${xs[0].toFixed(2)} ${ys[0].toFixed(2)}`
    for (let i = 0; i < N; i++) {
      const p0 = i ? [xs[i - 1], ys[i - 1]] : [xs[0], ys[0]]
      const p1 = [xs[i], ys[i]], p2 = [xs[i + 1], ys[i + 1]]
      const p3 = i + 2 <= N ? [xs[i + 2], ys[i + 2]] : p2
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
      d += ` C ${c1[0].toFixed(2)} ${c1[1].toFixed(2)} ${c2[0].toFixed(2)} ${c2[1].toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`
    }
    path.setAttribute('d', d)
    // dashes drift along the line; speed itself wanders a little so the flow does not look mechanical
    offset -= (0.22 + 0.08 * Math.sin(t * 0.53)) * (gsap.ticker.deltaRatio() || 1)
    path.style.strokeDashoffset = offset.toFixed(2) + 'px'
  }
  gsap.ticker.add(tick)
  return () => gsap.ticker.remove(tick)
}
