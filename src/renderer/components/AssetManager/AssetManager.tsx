import { useState, useEffect, useCallback } from 'react'
import { getApi } from '../../utils/api'
import './AssetManager.css'

interface Asset {
  name: string
  path: string
  relativePath: string
}

interface AssetManagerProps {
  onClose: () => void
  onSelect?: (url: string) => void
}

export default function AssetManager({ onClose, onSelect }: AssetManagerProps): JSX.Element {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null)
  const api = getApi()

  const refreshAssets = useCallback(async () => {
    setLoading(true)
    try {
      const result = await api.assets.list()
      if (result.success && result.assets) {
        setAssets(result.assets)
      }
    } catch (err) {
      console.error('Failed to list assets', err)
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    refreshAssets()
  }, [refreshAssets])

  const handleAddImages = async () => {
    setLoading(true)
    try {
      const result = await api.assets.selectImage()
      if (result.success && result.filePaths) {
        // After selecting, refresh the list to show newly imported assets
        await refreshAssets()
      }
    } catch (err) {
      console.error('Failed to add assets', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteAsset = async (asset: Asset, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`Delete "${asset.name}"? This cannot be undone.`)) return

    try {
      const result = await api.assets.delete(asset.relativePath)
      if (result.success) {
        setAssets(prev => prev.filter(a => a.path !== asset.path))
        if (selectedAsset === asset.path) setSelectedAsset(null)
      } else {
        console.error('Failed to delete asset:', result.error)
      }
    } catch (err) {
      console.error('Failed to delete asset', err)
    }
  }

  const handleInsert = () => {
    if (selectedAsset && onSelect) {
      onSelect(selectedAsset)
      onClose()
    }
  }

  const handleAssetClick = (asset: Asset) => {
    setSelectedAsset(asset.path)
  }

  const handleAssetDoubleClick = (asset: Asset) => {
    if (onSelect) {
      onSelect(asset.path)
      onClose()
    }
  }

  return (
    <div className="asset-manager-overlay" onClick={onClose}>
      <div className="asset-manager-modal" onClick={(e) => e.stopPropagation()}>
        <div className="asset-manager-header">
          <h2>Asset Manager</h2>
          <button className="am-close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="asset-manager-toolbar">
          <button className="am-btn-primary" onClick={handleAddImages} disabled={loading}>
            {loading ? 'Adding...' : '+ Add Images'}
          </button>
          {onSelect && (
            <button
              className="am-btn-primary"
              onClick={handleInsert}
              disabled={!selectedAsset}
            >
              Insert Selected
            </button>
          )}
          <span className="am-asset-count">{assets.length} asset{assets.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="asset-manager-grid">
          {assets.length === 0 && !loading ? (
            <div className="am-empty-state">
              <div className="am-empty-icon">&#128444;</div>
              <p>No assets in this project yet.</p>
              <p className="am-empty-hint">Click "Add Images" to import files, or drag images directly onto the canvas.</p>
            </div>
          ) : (
            assets.map(asset => (
              <div
                key={asset.path}
                className={`am-asset-item ${selectedAsset === asset.path ? 'selected' : ''}`}
                onClick={() => handleAssetClick(asset)}
                onDoubleClick={() => handleAssetDoubleClick(asset)}
              >
                <div className="am-asset-thumbnail">
                  <img src={asset.path} alt={asset.name} loading="lazy" />
                </div>
                <div className="am-asset-info">
                  <span className="am-asset-name" title={asset.name}>{asset.name}</span>
                  <button
                    className="am-asset-delete-btn"
                    onClick={(e) => handleDeleteAsset(asset, e)}
                    title="Delete asset"
                  >
                    &times;
                  </button>
                </div>
              </div>
            ))
          )}
          {loading && assets.length === 0 && (
            <div className="am-empty-state">
              <p>Loading assets...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
