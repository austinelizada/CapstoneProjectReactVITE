const CACHE_NAME = 'acgc-shell-v1'
const APP_SHELL = ['./', './index.html', './favicon.svg', './manifest.webmanifest']

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
	)
	self.skipWaiting()
})

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((keys) =>
			Promise.all(
				keys
					.filter((key) => key !== CACHE_NAME)
					.map((key) => caches.delete(key)),
			),
		),
	)
	self.clients.claim()
})

self.addEventListener('fetch', (event) => {
	const requestUrl = new URL(event.request.url)

	if (requestUrl.origin !== self.location.origin || requestUrl.pathname.startsWith('/api')) {
		return
	}

	if (event.request.mode === 'navigate') {
		event.respondWith(
			fetch(event.request)
				.then((response) => {
					const responseCopy = response.clone()
					caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', responseCopy))
					return response
				})
				.catch(() => caches.match('./index.html')),
		)
		return
	}

	event.respondWith(
		caches.match(event.request).then((cachedResponse) => {
			if (cachedResponse) {
				return cachedResponse
			}

			return fetch(event.request).then((response) => {
				if (response.ok) {
					const responseCopy = response.clone()
					caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseCopy))
				}
				return response
			})
		}),
	)
})
