import React, {useCallback, useEffect, useMemo, useState} from 'react'
import {getApi} from '../../utils/api'
import type {Asset} from './AssetManager'
import MediaSearchPanel, {type MediaSearchResult} from './MediaSearchPanel'
import './AssetManager.css'
import './AssetPicker.css'
import {Play} from 'lucide-react'

export type AssetPickerMode = 'single-image' | 'single-video' | 'multi-image'

interface AssetPickerProps {
  mode: AssetPickerMode
  onSelect: (urls: string[]) => void
  onCancel: () => void
  initialSelection?: string[]
}

export default function AssetPicker({ mode, onSelect, onCancel, initialSelection = [] }: AssetPickerProps): JSX.Element {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedUrls, setSelectedUrls] = useState<string[]>(initialSelection)
  const [activeTab, setActiveTab] = useState<'project' | 'web'>('project')
  const [downloading, setDownloading] = useState(false)
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

  const handleWebResultsSelect = async (results: MediaSearchResult[]) => {
    if (!results.length) return

    // Download and import selected web media
    setDownloading(true)
    const importedUrls: string[] = []

    for (const result of results) {
      try {
        const downloadResult = await api.mediaSearch.downloadAndImport(result.url)
        if (downloadResult.success && downloadResult.path) {
          importedUrls.push(downloadResult.path)
        }
      } catch (err) {
        console.error('Failed to download media:', err)
      }
    }

    setDownloading(false)

    if (importedUrls.length > 0) {
      onSelect(importedUrls)
    }
  }

  const [currentPage, setCurrentPage] = useState(1)

  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      if (mode === 'single-image' || mode === 'multi-image') {
        return asset.type === 'image' || !asset.type
      }
      if (mode === 'single-video') {
        return asset.type === 'video'
      }
      return true
    })
  }, [assets, mode])

  const PROJECT_ASSETS_PER_PAGE = 8
  const totalPages = Math.max(1, Math.ceil(filteredAssets.length / PROJECT_ASSETS_PER_PAGE))
  const pageStartIndex = (currentPage - 1) * PROJECT_ASSETS_PER_PAGE
  const paginatedAssets = filteredAssets.slice(pageStartIndex, pageStartIndex + PROJECT_ASSETS_PER_PAGE)
  const visibleStart = filteredAssets.length === 0 ? 0 : pageStartIndex + 1
  const visibleEnd = Math.min(pageStartIndex + PROJECT_ASSETS_PER_PAGE, filteredAssets.length)

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages))
  }, [totalPages])

  const handleAssetClick = (asset: Asset) => {
    if (mode === 'single-image' || mode === 'single-video') {
      setSelectedUrls([asset.path])
    } else {
      setSelectedUrls(prev => {
        if (prev.includes(asset.path)) {
          return prev.filter(url => url !== asset.path)
        }
        return [...prev, asset.path]
      })
    }
  }

  const handleAssetDoubleClick = (asset: Asset) => {
    if (mode === 'single-image' || mode === 'single-video') {
      onSelect([asset.path])
    }
  }

  const handleConfirm = () => {
    onSelect(selectedUrls)
  }

  const isMulti = mode === 'multi-image'
  const searchMode: 'image' | 'video' = mode === 'single-video' ? 'video' : 'image'

  const moveSelectedItem = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= selectedUrls.length) return

    setSelectedUrls(prev => {
      const next = [...prev]
      const [item] = next.splice(index, 1)
      next.splice(newIndex, 0, item)
      return next
    })
  }

  const removeSelectedItem = (url: string) => {
    setSelectedUrls(prev => prev.filter(u => u !== url))
  }

  return (
    <div className="asset-picker-overlay" onClick={onCancel}>
      <div className="asset-picker-modal" onClick={e => e.stopPropagation()}>
        <div className="asset-picker-header">
          <h2>Select {mode === 'single-video' ? 'Video' : mode === 'multi-image' ? 'Images' : 'Image'}</h2>
          <button className="ap-close-btn" onClick={onCancel}>&times;</button>
        </div>

        <div className="ap-tabs">
            <button
              className={`ap-tab ${activeTab === 'project' ? 'active' : ''}`}
              onClick={() => setActiveTab('project')}
            >
              Project Assets
            </button>
            <button
              className={`ap-tab ${activeTab === 'web' ? 'active' : ''}`}
              onClick={() => setActiveTab('web')}
            >
              Web Search
            </button>
        </div>

        <div className="asset-picker-body">
          {activeTab === 'project' ? (
            <>
              <div className="asset-picker-main">
                <div className="ap-grid">
                  {filteredAssets.length === 0 && !loading ? (
                    <div className="ap-empty">
                      <div className="ap-empty-icon">&#128444;</div>
                      <p>No matching assets found.</p>
                    </div>
                  ) : (
                    paginatedAssets.map(asset => {
                      const isSelected = selectedUrls.includes(asset.path)
                      return (
                        <div
                          key={asset.path}
                          className={`ap-item ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleAssetClick(asset)}
                          onDoubleClick={() => handleAssetDoubleClick(asset)}
                        >
                          {isMulti && (
                            <input
                              type="checkbox"
                              className="ap-checkbox"
                              checked={isSelected}
                              readOnly
                            />
                          )}
                          <div className="am-asset-thumbnail">
                            {asset.type === 'video' ? (
                              <div className="am-video-thumbnail">
                                <video src={asset.path} preload="metadata" />
                                <div className="am-play-icon"><Play size={16} fill="currentColor" /></div>
                              </div>
                            ) : (
                              <img src={asset.path} alt={asset.name} loading="lazy" />
                            )}
                          </div>
                          <div className="am-asset-info">
                            <span className="am-asset-name" title={asset.name}>{asset.name}</span>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
                {filteredAssets.length > 0 && (
                  <div className="am-pagination">
                    <span className="am-pagination-summary">
                      Showing {visibleStart}-{visibleEnd} of {filteredAssets.length}
                    </span>
                    <div className="am-pagination-controls">
                      <button
                        className="am-page-btn"
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                      >
                        Previous
                      </button>
                      <span className="am-page-status">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        className="am-page-btn"
                        onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {isMulti && (
                <div className="asset-picker-sidebar">
                  <div className="asset-picker-sidebar-header">
                    Selected ({selectedUrls.length})
                  </div>
                  <div className="asset-picker-sidebar-content">
                    {selectedUrls.map((url, index) => {
                      const asset = assets.find(a => a.path === url)
                      const name = asset ? asset.name : url.split('/').pop() || 'Unknown'
                      return (
                        <div key={url} className="ap-selected-item">
                          <div className="ap-selected-thumb">
                            <img src={url} alt={name} />
                          </div>
                          <div className="ap-selected-name" title={name}>{name}</div>
                          <div className="ap-selected-actions">
                            <button
                              className="ap-action-btn"
                              onClick={() => moveSelectedItem(index, 'up')}
                              disabled={index === 0}
                              title="Move up"
                            >
                              ↑
                            </button>
                            <button
                              className="ap-action-btn"
                              onClick={() => moveSelectedItem(index, 'down')}
                              disabled={index === selectedUrls.length - 1}
                              title="Move down"
                            >
                              ↓
                            </button>
                            <button
                              className="ap-action-btn"
                              onClick={() => removeSelectedItem(url)}
                              title="Remove"
                            >
                              &times;
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <MediaSearchPanel
              mode={searchMode}
              onSelect={handleWebResultsSelect}
              onCancel={() => setActiveTab('project')}
              multiSelect={isMulti}
            />
          )}
        </div>

        {activeTab === 'project' && (
          <div className="asset-picker-footer">
            <button className="ap-btn-secondary" onClick={onCancel}>Cancel</button>
            <button
              className="ap-btn-primary"
              onClick={handleConfirm}
              disabled={selectedUrls.length === 0 || downloading}
            >
              {downloading ? 'Importing...' : isMulti ? `Confirm Selection (${selectedUrls.length})` : 'Select'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
