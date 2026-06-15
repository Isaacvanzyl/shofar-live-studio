import { useState } from 'react'
import { useAssignedPacks, type Pack, type PackItem } from '../hooks/useAssignedPacks'

interface Props {
  type: PackItem['type']
  onAddToMyPresets: (item: PackItem, packName: string) => void
}

export default function PackBrowser({ type, onAddToMyPresets }: Props) {
  const { packs, loading } = useAssignedPacks(type)
  const [expandedPack, setExpandedPack] = useState<string | null>(null)
  const [added, setAdded] = useState<Record<string, boolean>>({})

  if (loading) return (
    <div className="pack-browser-empty">
      <span className="msym spin" style={{ fontSize: 20, opacity: .3 }}>refresh</span>
    </div>
  )

  if (packs.length === 0) return (
    <div className="pack-browser-empty">
      <span className="msym" style={{ fontSize: 28, opacity: .2 }}>inventory_2</span>
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', marginTop: 4 }}>No packs assigned</span>
    </div>
  )

  const handleAdd = (item: PackItem, pack: Pack) => {
    onAddToMyPresets(item, pack.name)
    setAdded(prev => ({ ...prev, [item.id]: true }))
    setTimeout(() => setAdded(prev => ({ ...prev, [item.id]: false })), 2000)
  }

  return (
    <div className="pack-browser">
      <div className="pack-browser-header">
        <span className="msym" style={{ fontSize: 14 }}>inventory_2</span>
        Preset Packs
        <span className="pack-browser-badge">{packs.length}</span>
      </div>

      {packs.map(pack => (
        <div key={pack.id} className="pack-group">
          <button
            className="pack-group-header"
            onClick={() => setExpandedPack(prev => prev === pack.id ? null : pack.id)}
          >
            <span className="msym" style={{ fontSize: 13 }}>
              {expandedPack === pack.id ? 'expand_less' : 'expand_more'}
            </span>
            <span style={{ flex: 1, textAlign: 'left' }}>{pack.name}</span>
            <span className="pack-item-count">{pack.items.length}</span>
          </button>

          {expandedPack === pack.id && (
            <div className="pack-group-items">
              {pack.items.map(item => (
                <div key={item.id} className="pack-item-row">
                  <div className="pack-item-name">{item.name}</div>
                  <button
                    className={`pack-item-add${added[item.id] ? ' added' : ''}`}
                    onClick={() => handleAdd(item, pack)}
                    title="Add a copy to my presets"
                  >
                    {added[item.id] ? (
                      <span className="msym" style={{ fontSize: 13 }}>check</span>
                    ) : (
                      <span className="msym" style={{ fontSize: 13 }}>add</span>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
