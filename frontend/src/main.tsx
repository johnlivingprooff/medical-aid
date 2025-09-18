import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ToastProvider } from './components/ui/toast'
import './index.css'
import App from './App'
import { registerServiceWorker } from './lib/service-worker'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true
        }}
      >
        <App />
      </BrowserRouter>
    </ToastProvider>
  </React.StrictMode>
)

// Register service worker for PWA functionality
if (import.meta.env.PROD) {
  registerServiceWorker()
}
