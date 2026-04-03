// React 19 removed the global JSX namespace from @types/react.
// Re-declare it here so existing JSX.Element return-type annotations continue to compile.
import type { JSX as ReactJSX } from 'react'

export {}

declare global {
  namespace JSX {
    type Element = ReactJSX.Element
    type IntrinsicElements = ReactJSX.IntrinsicElements
    type ElementAttributesProperty = ReactJSX.ElementAttributesProperty
    type ElementChildrenAttribute = ReactJSX.ElementChildrenAttribute
    type IntrinsicAttributes = ReactJSX.IntrinsicAttributes
  }
}
