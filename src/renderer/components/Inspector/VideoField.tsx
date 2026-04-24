import React, {useCallback, useState} from 'react'
import AssetPicker from '../AssetManager/AssetPicker'
import './VideoField.css'

interface VideoFieldProps {
  value: string
  onChange: (value: string) => void
}

function VideoField({ value, onChange }: VideoFieldProps): JSX.Element {
  const [showPicker, setShowPicker] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasPreviewableVideo = value && (value.startsWith('http') || value.startsWith('blob:') || value.startsWith('app-media://'))

  const handleBrowse = useCallback(() => {
    setShowPicker(true)
  }, [])

  const handleSelectAsset = (urls: string[]) => {
    setShowPicker(false)
    if (!urls.length) return
    const filePath = urls[0]
    onChange(filePath)
  }

  return (
    <div className="video-field">
      <div className="video-field-input-row">
        <input
          type="text"
          className="inspector-input video-field-url"
          value={value}
          onChange={(e) => {
            setError(null)
            onChange(e.target.value)
          }}
          placeholder="Video URL or path"
        />
        <button
          className="video-field-browse-btn"
          onClick={handleBrowse}
          title="Browse for video file"
        >
          Browse
        </button>
      </div>

      {error && <div className="video-field-error">{error}</div>}

      {hasPreviewableVideo && (
        <div className="video-field-preview">
          <video
            src={value}
            controls
            preload="metadata"
            onError={(e) => { (e.target as HTMLVideoElement).style.display = 'none' }}
            onLoadedData={(e) => { (e.target as HTMLVideoElement).style.display = 'block' }}
          />
        </div>
      )}

      {showPicker && (
        <AssetPicker
          mode="single-video"
          onSelect={handleSelectAsset}
          onCancel={() => setShowPicker(false)}
        />
      )}
    </div>
  )
}

export default VideoField
