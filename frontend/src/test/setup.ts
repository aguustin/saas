import '@testing-library/jest-dom'
import { vi } from 'vitest'

// ── localStorage ──────────────────────────────────────────────────
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem:    (key: string) => store[key] ?? null,
    setItem:    (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear:      () => { store = {} },
    get length() { return Object.keys(store).length },
    key:        (i: number) => Object.keys(store)[i] ?? null,
  }
})()

Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true })

// ── matchMedia ────────────────────────────────────────────────────
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value:    vi.fn().mockImplementation((query: string) => ({
    matches:            false,
    media:              query,
    onchange:           null,
    addListener:        vi.fn(),
    removeListener:     vi.fn(),
    addEventListener:   vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent:      vi.fn(),
  })),
})

// ── ResizeObserver ────────────────────────────────────────────────
window.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe:    vi.fn(),
  unobserve:  vi.fn(),
  disconnect: vi.fn(),
}))
