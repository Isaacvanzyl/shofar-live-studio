import { useEffect, useRef } from 'react'
import type { LowerThirdState } from '../../types'
import { hexToRgb } from '../../lib/theme'

interface Props {
  state: LowerThirdState
  show: boolean
}

export default function LowerThirdPreview({ state, show }: Props) {
  const unitRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const unit = unitRef.current
    if (!unit) return
    if (state.visible && show) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          unit.classList.add('lt-in')
        })
      })
    } else {
      unit.classList.remove('lt-in')
    }
  }, [state.visible, show])

  const nameLen = state.name.length
  const titleLen = state.title.length
  const nf = Math.min(1, 18 / Math.max(nameLen, 1))
  const tf = Math.min(1, 32 / Math.max(titleLen, 1))
  const scaledNsz = Math.max(28, Math.round(state.nameSz * Math.sqrt(nf)))
  const scaledTsz = Math.max(15, Math.round(state.titleSz * Math.sqrt(tf)))

  const panelBg = `rgba(${hexToRgb(state.panelBg)},${state.bgOp / 100})`
  const accentRgb = hexToRgb(state.accentCol)
  const borderCol = `rgba(${accentRgb},.35)`
  const padding = `${state.pad}px ${Math.round(state.pad * 2.4)}px ${state.pad}px ${Math.round(state.pad * 1.3)}px`

  return (
    <div
      className="lt-wrap"
      style={{
        bottom: `${state.yOff}px`,
        left: `${state.xOff}px`,
        display: show ? 'block' : 'none',
      }}
    >
      <div className="lt-unit" ref={unitRef}>
        <div
          className="lt-accent-bar"
          style={{ width: `${state.barWidth}px`, background: state.accentCol }}
        />
        <div
          className="lt-panel"
          style={{
            background: panelBg,
            padding,
            borderTopColor: borderCol,
            borderRightColor: borderCol,
            borderBottomColor: borderCol,
          }}
        >
          <span
            className="lt-name"
            style={{
              fontSize: `${scaledNsz}px`,
              color: state.nameCol,
              textTransform: state.uppercase,
              fontFamily: state.nameFont ?? "'Barlow Condensed', sans-serif",
            }}
          >
            {state.name}
          </span>
          <span
            className="lt-title"
            style={{ fontSize: `${scaledTsz}px`, color: state.titleCol, fontFamily: state.titleFont ?? "'Barlow', sans-serif" }}
          >
            {state.title}
          </span>
          {state.logo && (
            <div className="lt-logo-area">
              <img src={state.logo} alt="" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
