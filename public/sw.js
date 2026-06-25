const CACHE_NAME = 'aio-reborn-cache-v1';

// ইনস্টল ইভেন্ট
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// অ্যাক্টিভেট ইভেন্ট
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// ফেচ ইভেন্ট (PWABuilder-এর চেক পাস করার জন্য এটি থাকা বাধ্যতামূলক)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return new Response('You are offline. Please check your internet connection.Join Telegram channel for app update');
    })
  );
});
