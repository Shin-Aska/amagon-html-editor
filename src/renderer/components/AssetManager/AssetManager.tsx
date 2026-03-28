import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { getApi } from '../../utils/api'
import MediaSearchPanel, { type MediaSearchResult } from './MediaSearchPanel'
import './AssetManager.css'
import { Play } from 'lucide-react'

export interface Asset {
  name: string
  path: string
  relativePath: string
  type?: 'image' | 'video'
}

interface AssetManagerProps {
  onClose: () => void
  onSelect?: (url: string) => void
}

const PROJECT_ASSETS_PER_PAGE = 8

export default function AssetManager({ onClose, onSelect }: AssetManagerProps): JSX.Element {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'project' | 'web'>('project')
  const [filterType, setFilterType] = useState<'all' | 'images' | 'videos'>('all')
  const [downloading, setDownloading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
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

  const handleAddMedia = async (type: 'image' | 'video') => {
    setLoading(true)
    try {
      const result = type === 'image' ? await api.assets.selectImage() : await api.assets.selectVideo()
      if (result.success && (result.filePaths || result.filePath)) {
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

  const handleWebResultsSelect = async (results: MediaSearchResult[]) => {
    if (!results.length) return

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

    await refreshAssets()
    setDownloading(false)

    if (importedUrls.length > 0) {
      setSelectedAsset(importedUrls[0])
      setActiveTab('project')
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

  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      if (filterType === 'all') return true
      if (filterType === 'images') return asset.type === 'image' || !asset.type
      if (filterType === 'videos') return asset.type === 'video'
      return true
    })
  }, [assets, filterType])

  const totalPages = Math.max(1, Math.ceil(filteredAssets.length / PROJECT_ASSETS_PER_PAGE))
  const pageStartIndex = (currentPage - 1) * PROJECT_ASSETS_PER_PAGE
  const paginatedAssets = filteredAssets.slice(pageStartIndex, pageStartIndex + PROJECT_ASSETS_PER_PAGE)
  const visibleStart = filteredAssets.length === 0 ? 0 : pageStartIndex + 1
  const visibleEnd = Math.min(pageStartIndex + PROJECT_ASSETS_PER_PAGE, filteredAssets.length)

  const webSearchMode: 'image' | 'video' = filterType === 'videos' ? 'video' : 'image'

  useEffect(() => {
    setCurrentPage(1)
  }, [filterType])

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages))
  }, [totalPages])

  useEffect(() => {
    if (!selectedAsset) return
    const selectedIndex = filteredAssets.findIndex((asset) => asset.path === selectedAsset)
    if (selectedIndex < 0) return
    const nextPage = Math.floor(selectedIndex / PROJECT_ASSETS_PER_PAGE) + 1
    if (nextPage !== currentPage) {
      setCurrentPage(nextPage)
    }
  }, [selectedAsset, filteredAssets, currentPage])

  const openWebTab = () => {
    if (filterType === 'all') {
      setFilterType('images')
    }
    setActiveTab('web')
  }

  const overlay = (
    <div className="asset-manager-overlay" onClick={onClose}>
      <div className="asset-manager-modal" data-tutorial="asset-manager-modal" onClick={(e) => e.stopPropagation()}>
        <div className="asset-manager-header">
          <h2>Asset Manager</h2>
          <button className="am-close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="am-tabs">
          <button
            className={`am-tab ${activeTab === 'project' ? 'active' : ''}`}
            onClick={() => setActiveTab('project')}
          >
            Project Assets
          </button>
          <button
            className={`am-tab ${activeTab === 'web' ? 'active' : ''}`}
            onClick={openWebTab}
            data-tutorial="am-web-search-tab"
          >
            Web Search
          </button>
        </div>

        <div className="asset-manager-toolbar">
          {activeTab === 'project' && (
            <div className="am-dropdown">
              <button className="am-btn-primary" disabled={loading || downloading}>
                {loading ? 'Adding...' : '+ Add Media'}
              </button>
              <div className="am-dropdown-content">
                <button onClick={() => handleAddMedia('image')}>Add Images</button>
                <button onClick={() => handleAddMedia('video')}>Add Video</button>
              </div>
            </div>
          )}

          <div className="am-filters">
            {activeTab === 'project' && (
              <button
                className={`am-filter-btn ${filterType === 'all' ? 'active' : ''}`}
                onClick={() => setFilterType('all')}
              >
                All
              </button>
            )}
            <button 
              className={`am-filter-btn ${filterType === 'images' ? 'active' : ''}`}
              onClick={() => setFilterType('images')}
            >
              Images
            </button>
            <button 
              className={`am-filter-btn ${filterType === 'videos' ? 'active' : ''}`}
              onClick={() => setFilterType('videos')}
            >
              Videos
            </button>
          </div>
          {activeTab === 'project' && onSelect && (
            <button
              className="am-btn-primary"
              onClick={handleInsert}
              disabled={!selectedAsset || downloading}
            >
              {downloading ? 'Importing...' : 'Insert Selected'}
            </button>
          )}
          <span className="am-asset-count">
            {activeTab === 'project'
              ? `${filteredAssets.length} asset${filteredAssets.length !== 1 ? 's' : ''}`
              : `Searching ${webSearchMode === 'video' ? 'videos' : 'images'}`}
          </span>
        </div>

        <div className="asset-manager-content">
          {activeTab === 'project' ? (
            <div className="asset-manager-project-panel">
              <div className="asset-manager-grid">
                {filteredAssets.length === 0 && !loading ? (
                  <div className="am-empty-state">
                    <div className="am-empty-icon">&#128444;</div>
                    <p>No assets in this project yet.</p>
                    <p className="am-empty-hint">Click "Add Media" to import files, or drag images directly onto the canvas.</p>
                  </div>
                ) : (
                  paginatedAssets.map(asset => (
                    <div
                      key={asset.path}
                      className={`am-asset-item ${selectedAsset === asset.path ? 'selected' : ''}`}
                      onClick={() => handleAssetClick(asset)}
                      onDoubleClick={() => handleAssetDoubleClick(asset)}
                    >
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
          ) : (
            <MediaSearchPanel
              mode={webSearchMode}
              onSelect={handleWebResultsSelect}
              onCancel={() => setActiveTab('project')}
              multiSelect
              confirmLabel="Insert Selected"
            />
          )}
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') {
    return overlay
  }

  return createPortal(overlay, document.body)
}
