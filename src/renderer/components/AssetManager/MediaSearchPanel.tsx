import React, { useState, useCallback, useEffect, useRef } from 'react'
import { getApi } from '../../utils/api'
import './MediaSearchPanel.css'

export interface MediaSearchResult {
  id: string
  url: string
  thumbUrl: string
  previewUrl: string
  alt: string
  photographer?: string
  sourceUrl?: string
}

export type MediaSearchMode = 'image' | 'video'

interface MediaSearchPanelProps {
  mode: MediaSearchMode
  onSelect: (results: MediaSearchResult[]) => void
  onCancel: () => void
  multiSelect?: boolean
}

const PROVIDER_LABELS: Record<string, string> = {
  unsplash: 'Unsplash',
  pexels: 'Pexels',
  pixabay: 'Pixabay'
}

export default function MediaSearchPanel({ mode, onSelect, onCancel, multiSelect = false }: MediaSearchPanelProps): JSX.Element {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MediaSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [config, setConfig] = useState<{ enabled: boolean; provider: string; apiKey: string } | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [showConfig, setShowConfig] = useState(false)
  const [configForm, setConfigForm] = useState({ enabled: false, provider: 'unsplash', apiKey: '' })
  const searchInputRef = useRef<HTMLInputElement>(null)
  const api = getApi()

  // Load config on mount
  useEffect(() => {
    loadConfig()
  }, [])

  // Focus search input when enabled
  useEffect(() => {
    if (config?.enabled && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [config?.enabled])

  const loadConfig = async () => {
    try {
      const result = await api.mediaSearch.getConfig()
      if (result.success && result.config) {
        setConfig(result.config)
        setConfigForm(result.config)
      }
    } catch (err) {
      console.error('Failed to load media search config', err)
    }
  }

  const handleSearch = useCallback(async (searchQuery: string, pageNum: number = 1, append: boolean = false) => {
    if (!searchQuery.trim()) return

    setLoading(true)
    setError(null)

    try {
      const result = await api.mediaSearch.search({
        query: searchQuery,
        perPage: 20,
        page: pageNum,
        type: mode
      })

      if (result.error) {
        setError(result.error)
        setResults([])
      } else {
        const newResults = result.results || []
        if (append) {
          setResults(prev => [...prev, ...newResults])
        } else {
          setResults(newResults)
        }
        setHasMore(newResults.length === 20)
      }
    } catch (err) {
      setError('Search failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [mode, api])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    handleSearch(query, 1, false)
  }

  const loadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    handleSearch(query, nextPage, true)
  }

  const handleResultClick = (result: MediaSearchResult) => {
    if (multiSelect) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        if (next.has(result.id)) {
          next.delete(result.id)
        } else {
          next.add(result.id)
        }
        return next
      })
    } else {
      onSelect([result])
    }
  }

  const handleResultDoubleClick = (result: MediaSearchResult) => {
    onSelect([result])
  }

  const handleConfirmSelection = () => {
    const selected = results.filter(r => selectedIds.has(r.id))
    onSelect(selected)
  }

  const saveConfig = async () => {
    try {
      const result = await api.mediaSearch.setConfig(configForm)
      if (result.success) {
        setConfig(result.config)
        setShowConfig(false)
      }
    } catch (err) {
      console.error('Failed to save config', err)
    }
  }

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent, result: MediaSearchResult) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (multiSelect) {
        handleResultClick(result)
      } else {
        onSelect([result])
      }
    }
  }

  if (showConfig) {
    return (
      <div className="msp-config-panel">
        <h3>Media Search Settings</h3>
        <div className="msp-config-form">
          <label className="msp-config-row">
            <input
              type="checkbox"
              checked={configForm.enabled}
              onChange={(e) => setConfigForm(prev => ({ ...prev, enabled: e.target.checked }))}
            />
            <span>Enable web search for media</span>
          </label>

          <label className="msp-config-label">
            Search Provider
            <select
              className="msp-config-select"
              value={configForm.provider}
              onChange={(e) => setConfigForm(prev => ({ ...prev, provider: e.target.value }))}
              disabled={!configForm.enabled}
            >
              <option value="unsplash">Unsplash (Images only)</option>
              <option value="pexels">Pexels (Images + Videos)</option>
              <option value="pixabay">Pixabay (Images + Videos)</option>
            </select>
          </label>

          <label className="msp-config-label">
            API Key
            <input
              type="password"
              className="msp-config-input"
              value={configForm.apiKey}
              onChange={(e) => setConfigForm(prev => ({ ...prev, apiKey: e.target.value }))}
              placeholder="Enter your API key"
              disabled={!configForm.enabled}
            />
          </label>

          <div className="msp-config-note">
            You need an API key from your chosen provider. Images/videos downloaded from web sources will be imported into your project assets.
          </div>

          <div className="msp-config-actions">
            <button className="msp-btn-secondary" onClick={() => setShowConfig(false)}>
              Cancel
            </button>
            <button className="msp-btn-primary" onClick={saveConfig}>
              Save Settings
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!config?.enabled) {
    return (
      <div className="msp-disabled-state">
        <div className="msp-disabled-icon">🔍</div>
        <p>Web search is not enabled.</p>
        <button className="msp-btn-primary" onClick={() => setShowConfig(true)}>
          Configure Media Search
        </button>
      </div>
    )
  }

  return (
    <div className="media-search-panel">
      <div className="msp-header">
        <form className="msp-search-form" onSubmit={handleSubmit}>
          <input
            ref={searchInputRef}
            type="text"
            className="msp-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${mode === 'video' ? 'videos' : 'images'} on ${PROVIDER_LABELS[config.provider]}...`}
          />
          <button type="submit" className="msp-search-btn" disabled={loading}>
            {loading ? '...' : 'Search'}
          </button>
        </form>
        <button className="msp-settings-btn" onClick={() => setShowConfig(true)} title="Settings">
          ⚙️
        </button>
      </div>

      {error && (
        <div className="msp-error">
          {error}
          {error.includes('API key') && (
            <button className="msp-error-action" onClick={() => setShowConfig(true)}>
              Configure
            </button>
          )}
        </div>
      )}

      {results.length === 0 && !loading && !error && query && (
        <div className="msp-empty">
          <div className="msp-empty-icon">🔍</div>
          <p>No results found for "{query}"</p>
        </div>
      )}

      {results.length === 0 && !loading && !error && !query && (
        <div className="msp-empty">
          <div className="msp-empty-icon">🖼️</div>
          <p>Enter a search term to find {mode === 'video' ? 'videos' : 'images'} from {PROVIDER_LABELS[config.provider]}</p>
        </div>
      )}

      <div className="msp-results-grid">
        {results.map((result) => {
          const isSelected = selectedIds.has(result.id)
          return (
            <div
              key={result.id}
              className={`msp-result-item ${isSelected ? 'selected' : ''}`}
              onClick={() => handleResultClick(result)}
              onDoubleClick={() => handleResultDoubleClick(result)}
              onKeyDown={(e) => handleKeyDown(e, result)}
              tabIndex={0}
              role="button"
              aria-pressed={isSelected}
              aria-label={`${result.alt}${result.photographer ? ` by ${result.photographer}` : ''}`}
            >
              {multiSelect && (
                <input
                  type="checkbox"
                  className="msp-result-checkbox"
                  checked={isSelected}
                  readOnly
                  tabIndex={-1}
                />
              )}
              <div className="msp-result-thumb">
                <img src={result.thumbUrl} alt={result.alt} loading="lazy" />
              </div>
              <div className="msp-result-info">
                <span className="msp-result-alt" title={result.alt}>
                  {result.alt.slice(0, 30)}{result.alt.length > 30 ? '...' : ''}
                </span>
                {result.photographer && (
                  <span className="msp-result-photographer">by {result.photographer}</span>
                )}
              </div>
              {mode === 'video' && <div className="msp-result-video-badge">▶</div>}
            </div>
          )
        })}
      </div>

      {loading && <div className="msp-loading">Searching...</div>}

      {hasMore && results.length > 0 && !loading && (
        <button className="msp-load-more" onClick={loadMore}>
          Load more results
        </button>
      )}

      {multiSelect && selectedIds.size > 0 && (
        <div className="msp-selection-bar">
          <span>{selectedIds.size} selected</span>
          <button className="msp-btn-primary" onClick={handleConfirmSelection}>
            Confirm Selection
          </button>
        </div>
      )}
    </div>
  )
}
