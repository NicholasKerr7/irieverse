"use strict";
// Generated public/sw.js from this source with `npm run build:sw`.
const serviceWorker = self;
const CACHE_NAME = "irieverse-travel-os-v6";
const APP_SHELL = [
    "/",
    "/manifest.webmanifest",
    "/favicon-16.png",
    "/favicon-32.png",
    "/icon-72.png",
    "/icon-96.png",
    "/icon-128.png",
    "/icon-144.png",
    "/icon-192.png",
    "/icon-384.png",
    "/icon-512.png",
    "/icon-1024.png",
    "/maskable-icon-192.png",
    "/maskable-icon-512.png",
    "/apple-touch-icon.png",
    "/data/bookings.json",
    "/data/events.json",
    "/data/flights-sample.json",
];
serviceWorker.addEventListener("install", (event) => {
    event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
    serviceWorker.skipWaiting();
});
serviceWorker.addEventListener("activate", (event) => {
    event.waitUntil(caches
        .keys()
        .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))));
    serviceWorker.clients.claim();
});
serviceWorker.addEventListener("fetch", (event) => {
    const { request } = event;
    if (request.method !== "GET")
        return;
    const url = new URL(request.url);
    if (url.origin !== serviceWorker.location.origin)
        return;
    if (request.mode === "navigate") {
        event.respondWith(networkFirst(request, "/"));
        return;
    }
    if (shouldCache(url)) {
        event.respondWith(cacheFirst(request));
    }
});
async function networkFirst(request, fallbackUrl) {
    const cache = await caches.open(CACHE_NAME);
    try {
        const response = await fetch(request);
        if (response.ok) {
            await cache.put(fallbackUrl, response.clone());
        }
        return response;
    }
    catch {
        const cached = await cache.match(fallbackUrl);
        return cached ?? Response.error();
    }
}
async function cacheFirst(request) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached)
        return cached;
    const response = await fetch(request);
    if (response.ok) {
        await cache.put(request, response.clone());
    }
    return response;
}
function shouldCache(url) {
    return (url.pathname.startsWith("/assets/") ||
        url.pathname.startsWith("/data/") ||
        url.pathname === "/favicon-16.png" ||
        url.pathname === "/favicon-32.png" ||
        url.pathname === "/icon-72.png" ||
        url.pathname === "/icon-96.png" ||
        url.pathname === "/icon-128.png" ||
        url.pathname === "/icon-144.png" ||
        url.pathname === "/icon-192.png" ||
        url.pathname === "/icon-384.png" ||
        url.pathname === "/icon-512.png" ||
        url.pathname === "/icon-1024.png" ||
        url.pathname === "/maskable-icon-192.png" ||
        url.pathname === "/maskable-icon-512.png" ||
        url.pathname === "/apple-touch-icon.png" ||
        url.pathname === "/manifest.webmanifest");
}
