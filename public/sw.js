// Service Worker for caching static assets and PWA support
// Version: 3.0.0

const CACHE_NAME = 'spare-finance-v3';
const STATIC_ASSETS = [
  '/icon.svg',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/apple-touch-icon.png',
  '/manifest.json',
];

// Routes that should NEVER be cached (always fetch from network)
const NO_CACHE_ROUTES = [
  '/dashboard',
  '/insights',
  '/reports',
  '/planning',
  '/investments',
  '/banking',
  '/settings/billing',
  '/settings/profile',
  '/members',
  '/api/',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Try to cache all static assets, but don't fail if some are missing
      return Promise.allSettled(
        STATIC_ASSETS.map((asset) => 
          cache.add(asset).catch((err) => {
            console.warn(`Failed to cache ${asset}:`, err);
            return null;
          })
        )
      );
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      // Claim all clients immediately
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Only cache GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);
  const pathname = url.pathname;
  const origin = url.origin;

  // Skip external URLs (extensions, etc.)
  if (
    event.request.url.startsWith('chrome-extension://') ||
    event.request.url.startsWith('moz-extension://')
  ) {
    return;
  }

  // Skip external domains - let them pass through without interception
  // This prevents CSP violations for external resources (Stripe, Supabase, Plaid, etc.)
  const isExternalDomain = !origin.startsWith(self.location.origin);
  if (isExternalDomain) {
    // Don't intercept external requests - let them pass through
    return;
  }

  // NEVER cache dynamic routes - always fetch from network
  const shouldNotCache = NO_CACHE_ROUTES.some(route => pathname.startsWith(route));
  
  if (shouldNotCache) {
    // For dynamic routes, always fetch from network and bypass cache
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(() => {
        // If network fails, return a basic error response
        return new Response('Network error', { status: 408 });
      })
    );
    return;
  }

  // For static assets and Next.js static files, use cache-first strategy
  if (event.request.url.includes('_next/static') || event.request.url.includes('/api/')) {
    // Let Next.js handle its own caching
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // For static assets, prefer cache but fallback to network
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((response) => {
        // Don't cache if not a valid response
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Clone the response
        const responseToCache = response.clone();

        // Only cache static assets (images, fonts, icons, manifest) - never cache HTML pages
        if (
          (event.request.url.match(/\.(jpg|jpeg|png|gif|svg|webp|woff|woff2|ttf|eot|ico|json)$/i) &&
          !pathname.match(/\.html?$/i)) ||
          pathname === '/manifest.json'
        ) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }

        return response;
      });
    })
  );
});

// Message event - handle updates and skip waiting
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

