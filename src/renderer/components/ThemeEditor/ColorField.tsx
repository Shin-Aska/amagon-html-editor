import { useEffect, useState } from 'react'

export default function ColorField({
  label,
  value,
  onChange
}: {
  label: string
  value: string
  onChange: (value: string) => void
}): JSX.Element {
  const [hex, setHex] = useState(value)

  useEffect(() => {
    setHex(value)
  }, [value])

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setHex(v)
    if (/^#[0-9a-fA-F]{6}$/.test(v) || /^#[0-9a-fA-F]{3}$/.test(v)) {
      onChange(v)
    }
  }

  const handleHexBlur = () => {
    if (!/^#[0-9a-fA-F]{3,6}$/.test(hex)) {
      setHex(value)
    }
  }

  return (
    <div className="theme-color-item">
      <span className="theme-color-label">{label}</span>
      <div className="theme-color-input-row">
        <div className="theme-color-swatch" style={{ backgroundColor: value }}>
          <input
            type="color"
            value={value}
            onChange={(e) => { setHex(e.target.value); onChange(e.target.value) }}
          />
        </div>
        <input
          className="theme-color-hex"
          value={hex}
          onChange={handleHexChange}
          onBlur={handleHexBlur}
          spellCheck={false}
        />
      </div>
    </div>
  )
}
