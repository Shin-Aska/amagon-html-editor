import React, {useCallback, useState} from 'react'
import AssetPicker from '../AssetManager/AssetPicker'
import './CarouselField.css'

export interface CarouselSlide {
  src: string
  alt: string
  caption: string
}

interface CarouselFieldProps {
  value: CarouselSlide[]
  onChange: (value: CarouselSlide[]) => void
}

function CarouselField({ value = [], onChange }: CarouselFieldProps): JSX.Element {
  const [showPicker, setShowPicker] = useState(false)

  const handleAddSlides = useCallback(() => {
    setShowPicker(true)
  }, [])

  const handleSelectAssets = (urls: string[]) => {
    setShowPicker(false)
    if (!urls.length) return

    const newSlides = urls.map(url => {
      const fileName = url.split('/').pop() || 'slide'
      const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '')
      return {
        src: url,
        alt: nameWithoutExt,
        caption: ''
      }
    })

    onChange([...value, ...newSlides])
  }

  const updateSlide = (index: number, updates: Partial<CarouselSlide>) => {
    const next = [...value]
    next[index] = { ...next[index], ...updates }
    onChange(next)
  }

  const moveSlide = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= value.length) return

    const next = [...value]
    const [item] = next.splice(index, 1)
    next.splice(newIndex, 0, item)
    onChange(next)
  }

  const removeSlide = (index: number) => {
    const next = [...value]
    next.splice(index, 1)
    onChange(next)
  }

  return (
    <div className="carousel-field" data-tutorial="carousel-field">
      <div className="carousel-field-header">
        <button
          className="carousel-add-btn"
          onClick={handleAddSlides}
          data-tutorial="carousel-add-btn"
        >
          + Add Slides
        </button>
      </div>

      <div className="carousel-slides-list">
        {value.length === 0 ? (
          <div className="carousel-empty">No slides added.</div>
        ) : (
          value.map((slide, index) => (
            <div key={`${slide.src}-${index}`} className="carousel-slide-item">
              <div className="carousel-slide-thumb">
                <img src={slide.src} alt={slide.alt} />
              </div>
              <div className="carousel-slide-details">
                <input
                  type="text"
                  className="carousel-slide-input"
                  placeholder="Alt text"
                  value={slide.alt}
                  onChange={(e) => updateSlide(index, { alt: e.target.value })}
                />
                <input
                  type="text"
                  className="carousel-slide-input"
                  placeholder="Caption (optional)"
                  value={slide.caption}
                  onChange={(e) => updateSlide(index, { caption: e.target.value })}
                />
              </div>
              <div className="carousel-slide-actions">
                <button
                  className="carousel-action-btn"
                  onClick={() => moveSlide(index, 'up')}
                  disabled={index === 0}
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  className="carousel-action-btn"
                  onClick={() => moveSlide(index, 'down')}
                  disabled={index === value.length - 1}
                  title="Move down"
                >
                  ↓
                </button>
                <button
                  className="carousel-action-btn delete"
                  onClick={() => removeSlide(index)}
                  title="Remove"
                >
                  &times;
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showPicker && (
        <AssetPicker
          mode="multi-image"
          onSelect={handleSelectAssets}
          onCancel={() => setShowPicker(false)}
        />
      )}
    </div>
  )
}

export default CarouselField
