import '@testing-library/jest-dom/vitest'

// WXT entrypoint macro globals for test environment
;(globalThis as any).defineContentScript = (def: any) => def
;(globalThis as any).defineBackground = (def: any) => def
