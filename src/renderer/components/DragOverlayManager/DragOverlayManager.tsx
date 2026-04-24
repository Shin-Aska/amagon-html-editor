import {type CSSProperties, useEffect, useMemo, useRef, useState} from 'react'
import {useDndContext} from '@dnd-kit/core'
import './DragOverlayManager.css'

export interface DropTargetHint {
  targetBlockId: string
  mode: 'inside' | 'before' | 'after'
}

type CanvasRuntimeMessage =
  | { source: 'canvas-runtime'; type: 'dropTarget'; dropTarget?: DropTargetHint }
  | { source: 'canvas-runtime'; type: 'ready' }

function getCanvasIframe(): HTMLIFrameElement | null {
  const el = document.querySelector('iframe.canvas-iframe');
  return el instanceof HTMLIFrameElement ? el : null
}

export default function DragOverlayManager({
  onDropTargetChange
}: {
  onDropTargetChange: (target: DropTargetHint | null) => void
}): JSX.Element | null {
  const { active } = useDndContext();
  const isDragging = Boolean(active);

  const lastSentRef = useRef<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const [iframeRect, setIframeRect] = useState<DOMRect | null>(null);

  const overlayStyle = useMemo(() => {
    if (!iframeRect) return undefined;
    return {
      top: iframeRect.top,
      left: iframeRect.left,
      width: iframeRect.width,
      height: iframeRect.height
    } satisfies CSSProperties
  }, [iframeRect]);

  useEffect(() => {
    if (!isDragging) {
      setIframeRect(null);
      onDropTargetChange(null);
      const iframe = getCanvasIframe();
      iframe?.contentWindow?.postMessage({ type: 'dragEnd' }, '*');
      return
    }

    const updateRect = () => {
      const iframe = getCanvasIframe();
      if (!iframe) return;
      setIframeRect(iframe.getBoundingClientRect())
    };

    updateRect();
    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);
    return () => {
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect)
    }
  }, [isDragging, onDropTargetChange]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as CanvasRuntimeMessage;
      if (!data || data.source !== 'canvas-runtime') return;
      if (data.type === 'dropTarget') {
        onDropTargetChange(data.dropTarget ?? null)
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage)
  }, [onDropTargetChange]);

  const sendDragMove = (x: number, y: number) => {
    lastSentRef.current = { x, y };
    if (rafRef.current !== null) return;

    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      const iframe = getCanvasIframe();
      const last = lastSentRef.current;
      if (!iframe || !last) return;
      iframe.contentWindow?.postMessage({ type: 'dragMove', x: last.x, y: last.y }, '*')
    })
  };

  if (!isDragging || !iframeRect || iframeRect.width <= 0 || iframeRect.height <= 0) {
    return null
  }

  return (
    <div
      className="canvas-dnd-overlay"
      style={overlayStyle}
      onPointerMove={(e) => {
        const x = e.clientX - iframeRect.left;
        const y = e.clientY - iframeRect.top;
        sendDragMove(x, y)
      }}
      onPointerLeave={() => {
        onDropTargetChange(null);
        const iframe = getCanvasIframe();
        iframe?.contentWindow?.postMessage({ type: 'dragMove', x: -1, y: -1 }, '*')
      }}
    />
  )
}
