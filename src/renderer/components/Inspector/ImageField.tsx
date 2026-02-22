import { useState, useCallback } from 'react'
import { getApi } from '../../utils/api'
import './ImageField.css'

interface ImageFieldProps {
  value: string
  onChange: (value: string) => void
}

function ImageField({ value, onChange }: ImageFieldProps): JSX.Element {
  const [embedAsBase64, setEmbedAsBase64] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sizeWarning, setSizeWarning] = useState<string | null>(null)

  const isBase64 = value.startsWith('data:')
  const isSvgPlaceholder = value.startsWith('data:image/svg+xml')
  const hasPreviewableImage = value && (value.startsWith('data:') || value.startsWith('http') || value.startsWith('blob:') || value.startsWith('app-media://'))

  const handleBrowse = useCallback(async () => {
    setError(null)
    setSizeWarning(null)
    setLoading(true)

    try {
      const api = getApi()
      const result = await api.assets.selectSingleImage()

      if (!result.success || result.canceled) {
        setLoading(false)
        return
      }

      const filePath = result.filePath as string
      const fileName = result.data as string

      if (embedAsBase64) {
        const base64Result = await api.assets.readFileAsBase64(filePath)
        if (!base64Result.success) {
          setError(base64Result.error || 'Failed to read file')
          setLoading(false)
          return
        }

        const dataUri = base64Result.data as string
        const sizeKB = Math.round((dataUri.length * 3) / 4 / 1024)
        if (sizeKB > 500) {
          setSizeWarning(`Embedded image is ${(sizeKB / 1024).toFixed(1)}MB. Large base64 images may slow down your project.`)
        }

        onChange(dataUri)
      } else {
        onChange(filePath)
      }

      setLoading(false)
    } catch (err) {
      setError(String(err))
      setLoading(false)
    }
  }, [embedAsBase64, onChange])

  const handleToggleBase64 = useCallback(async (checked: boolean) => {
    setEmbedAsBase64(checked)
    setError(null)
    setSizeWarning(null)

    if (checked && value && !isBase64 && (value.startsWith('blob:') || value.startsWith('http'))) {
      setLoading(true)
      try {
        const api = getApi()
        const result = await api.assets.readFileAsBase64(value)
        if (result.success && result.data) {
          const dataUri = result.data as string
          const sizeKB = Math.round((dataUri.length * 3) / 4 / 1024)
          if (sizeKB > 500) {
            setSizeWarning(`Embedded image is ${(sizeKB / 1024).toFixed(1)}MB. Large base64 images may slow down your project.`)
          }
          onChange(dataUri)
        }
      } catch {
        // Silently fail — user can re-browse
      }
      setLoading(false)
    }
  }, [value, isBase64, onChange])

  return (
    <div className="image-field">
      <div className="image-field-input-row">
        <input
          type="text"
          className="inspector-input image-field-url"
          value={isSvgPlaceholder ? '(placeholder)' : isBase64 ? '(base64 embedded)' : value}
          onChange={(e) => {
            setError(null)
            setSizeWarning(null)
            onChange(e.target.value)
          }}
          placeholder="Image URL or path"
          readOnly={isBase64 && !isSvgPlaceholder}
        />
        <button
          className="image-field-browse-btn"
          onClick={handleBrowse}
          disabled={loading}
          title="Browse for image file"
        >
          {loading ? '...' : 'Browse'}
        </button>
      </div>

      <label className="image-field-base64-toggle">
        <input
          type="checkbox"
          checked={embedAsBase64}
          onChange={(e) => handleToggleBase64(e.target.checked)}
        />
        <span>Embed as Base64</span>
      </label>

      {error && <div className="image-field-error">{error}</div>}
      {sizeWarning && <div className="image-field-warning">{sizeWarning}</div>}

      {hasPreviewableImage && (
        <div className="image-field-preview">
          <img
            src={value}
            alt="Preview"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            onLoad={(e) => { (e.target as HTMLImageElement).style.display = 'block' }}
          />
        </div>
      )}
    </div>
  )
}

export default ImageField
