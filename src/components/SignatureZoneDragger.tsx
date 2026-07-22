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
  onDrag: (pos: Position) => void
}

export default function SignatureZoneDragger({ position, width, height, onDrag }: Props) {
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
          border: '2px dashed #f59e0b',
          borderRadius: 4,
          background: 'rgba(245, 158, 11, 0.08)',
          cursor: 'move',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          userSelect: 'none',
          zIndex: 10,
        }}
      >
        <span style={{ color: '#f59e0b', fontSize: 13, pointerEvents: 'none' }}>
          ✍ Sign here
        </span>
      </div>
    </Draggable>
  )
}
