/**
 * Service Worker Registration Utility
 * Handles PWA functionality and caching
 */

export const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      })

      // Handle updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New content is available, notify user
              console.log('New content is available and will be used when all tabs for this page are closed.')

              // Optional: Show update notification to user
              if (window.confirm('New version available! Reload to update?')) {
                window.location.reload()
              }
            }
          })
        }
      })

      console.log('Service Worker registered successfully:', registration.scope)
      return registration
    } catch (error) {
      console.error('Service Worker registration failed:', error)
    }
  } else {
    console.warn('Service Worker not supported in this browser')
  }
}

export const unregisterServiceWorker = async () => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready
      await registration.unregister()
      console.log('Service Worker unregistered')
    } catch (error) {
      console.error('Service Worker unregistration failed:', error)
    }
  }
}