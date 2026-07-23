'use client'
import Draggable, { DraggableData, DraggableEvent } from 'react-draggable'
import { useRef } from 'react'

interface Position {
  x: number
  y: number
}

interface Props {
  position: Position
  width: number
  height: number
  imageUrl: string
  onDrag: (pos: Position) => void
}

export default function StampZoneDragger({ position, width, height, imageUrl, onDrag }: Props) {
  const nodeRef = useRef<HTMLDivElement>(null)

  function handleDrag(_e: DraggableEvent, data: DraggableData) {
    onDrag({ x: data.x, y: data.y })
  }

  return (
    <Draggable
      nodeRef={nodeRef as React.RefObject<HTMLElement>}
      position={position}
      onDrag={handleDrag}
    >
      <div
        ref={nodeRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width,
          height,
          border: '2px dashed #3b82f6',
          borderRadius: 4,
          background: 'rgba(59, 130, 246, 0.08)',
          cursor: 'move',
          userSelect: 'none',
          zIndex: 11,
          overflow: 'hidden',
        }}
      >
        <img
          src={imageUrl}
          alt="stamp"
          style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none', opacity: 0.75 }}
        />
      </div>
    </Draggable>
  )
}
