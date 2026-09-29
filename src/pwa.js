export function registerServiceWorker() {
	if (!('serviceWorker' in navigator) || import.meta.env.DEV) {
		return
	}

	window.addEventListener('load', () => {
		const serviceWorkerUrl = `${import.meta.env.BASE_URL}sw.js`

		navigator.serviceWorker.register(serviceWorkerUrl).catch((error) => {
			console.error('PWA service worker registration failed:', error)
		})
	})
}
