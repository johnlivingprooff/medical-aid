import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

type ToastVariant = 'success' | 'error' | 'info' | 'warning'

export type ToastOptions = {
  title?: string
  description?: string
  variant?: ToastVariant
  duration?: number // ms
}

type ToastItem = Required<ToastOptions> & { id: string }

type ToastContextValue = {
  show: (opts: ToastOptions) => string
  success: (message: string, opts?: Omit<ToastOptions, 'variant' | 'description'> & { description?: string }) => string
  error: (message: string, opts?: Omit<ToastOptions, 'variant' | 'description'> & { description?: string }) => string
  info: (message: string, opts?: Omit<ToastOptions, 'variant' | 'description'> & { description?: string }) => string
  warning: (message: string, opts?: Omit<ToastOptions, 'variant' | 'description'> & { description?: string }) => string
  dismiss: (id: string) => void
  clear: () => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}

function genId() {
  // Avoid crypto dependency across environments
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

const variantStyles: Record<ToastVariant, { border: string; bg: string; text: string; icon: JSX.Element }> = {
  success: {
    border: 'border-green-500',
    bg: 'bg-green-500/10',
    text: 'text-green-900 dark:text-green-100',
    icon: (
      <svg className="h-5 w-5 text-green-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.707a1 1 0 00-1.414-1.414L9 10.172 7.707 8.879A1 1 0 106.293 10.293l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    ),
  },
  error: {
    border: 'border-red-500',
    bg: 'bg-red-500/10',
    text: 'text-red-900 dark:text-red-100',
    icon: (
      <svg className="h-5 w-5 text-red-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9 6h2v5H9V6zm0 7h2v2H9v-2z" clipRule="evenodd" />
      </svg>
    ),
  },
  info: {
    border: 'border-blue-500',
    bg: 'bg-blue-500/10',
    text: 'text-blue-900 dark:text-blue-100',
    icon: (
      <svg className="h-5 w-5 text-blue-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
        <path fillRule="evenodd" d="M18 10A8 8 0 11.001 10 8 8 0 0118 10zM9 7h2V5H9v2zm0 8h2V8H9v7z" clipRule="evenodd" />
      </svg>
    ),
  },
  warning: {
    border: 'border-amber-500',
    bg: 'bg-amber-500/10',
    text: 'text-amber-900 dark:text-amber-100',
    icon: (
      <svg className="h-5 w-5 text-amber-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
        <path d="M8.257 3.099c.765-1.36 2.721-1.36 3.486 0l6.518 11.6A2 2 0 0116.518 18H3.482a2 2 0 01-1.743-3.3l6.518-11.6zM11 14H9v2h2v-2zm0-7H9v5h2V7z" />
      </svg>
    ),
  },
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef<Record<string, number>>({})

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const handle = timers.current[id]
    if (handle) {
      window.clearTimeout(handle)
      delete timers.current[id]
    }
  }, [])

  const show = useCallback((opts: ToastOptions) => {
    const id = genId()
    const item: ToastItem = {
      id,
      title: opts.title ?? '',
      description: opts.description ?? '',
      variant: opts.variant ?? 'info',
      duration: Math.max(1500, Math.min(opts.duration ?? 3500, 10000)),
    }
    setToasts((prev) => [item, ...prev].slice(0, 6))
    timers.current[id] = window.setTimeout(() => dismiss(id), item.duration)
    return id
  }, [dismiss])

  const clear = useCallback(() => setToasts([]), [])

  const api: ToastContextValue = useMemo(() => ({
    show,
    success: (message, opts) => show({ title: message, description: opts?.description, variant: 'success', duration: opts?.duration }),
    error: (message, opts) => show({ title: message, description: opts?.description, variant: 'error', duration: opts?.duration }),
    info: (message, opts) => show({ title: message, description: opts?.description, variant: 'info', duration: opts?.duration }),
    warning: (message, opts) => show({ title: message, description: opts?.description, variant: 'warning', duration: opts?.duration }),
    dismiss,
    clear,
  }), [show, dismiss, clear])

  useEffect(() => () => {
    Object.values(timers.current).forEach((h) => window.clearTimeout(h))
  }, [])

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Toast container */}
      <div
        className="pointer-events-none fixed z-50 flex w-full flex-col gap-2 p-4 md:inset-y-4 md:right-4 md:w-auto md:items-end"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto w-full max-w-sm overflow-hidden rounded-md border ${variantStyles[t.variant].border} bg-background shadow-lg ring-1 ring-black/5 md:w-[380px]`}
            role="status"
          >
            <div className={`flex items-start gap-3 p-3 ${variantStyles[t.variant].bg}`}>
              <div className="shrink-0 mt-0.5" aria-hidden>
                {variantStyles[t.variant].icon}
              </div>
              <div className="flex-1">
                {t.title && <p className={`text-sm font-medium leading-5 ${variantStyles[t.variant].text}`}>{t.title}</p>}
                {t.description && <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>}
              </div>
              <button
                onClick={() => api.dismiss(t.id)}
                className="rounded p-1 text-muted-foreground/70 transition hover:bg-foreground/5 hover:text-foreground"
                aria-label="Close notification"
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                  <path fillRule="evenodd" d="M10 8.586l4.95-4.95 1.414 1.415L11.414 10l4.95 4.95-1.414 1.414L10 11.414l-4.95 4.95-1.414-1.415L8.586 10l-4.95-4.95L5.05 3.636 10 8.586z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
