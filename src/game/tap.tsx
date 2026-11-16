// One tap = one action, at the moment the finger touches (no waiting for the finger to lift, so a
// candy that starts moving never swallows the tap). The click that follows a touch is ignored, so
// one tap never counts twice; a click without a touch (keyboard, switch access) still works.
import type { ButtonHTMLAttributes, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'

const lastPointer = new WeakMap<EventTarget, number>()
const CLICK_AFTER_POINTER_MS = 800

export function tapProps(handler: (rect: DOMRect) => void) {
  return {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0 && event.pointerType === 'mouse') return
      lastPointer.set(event.currentTarget, performance.now())
      handler(event.currentTarget.getBoundingClientRect())
    },
    onClick: (event: ReactMouseEvent<HTMLElement>) => {
      const at = lastPointer.get(event.currentTarget)
      if (at !== undefined && performance.now() - at < CLICK_AFTER_POINTER_MS) return
      handler(event.currentTarget.getBoundingClientRect())
    },
  }
}

/** A button that acts on touch (see `tapProps`). */
export function TapButton({ onTap, children, ...rest }: { onTap: (rect: DOMRect) => void } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'onPointerDown'>) {
  return (
    <button type="button" {...rest} {...tapProps(onTap)}>
      {children}
    </button>
  )
}
