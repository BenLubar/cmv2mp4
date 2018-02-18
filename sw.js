importScripts('https://storage.googleapis.com/workbox-cdn/releases/3.0.0-beta.0/workbox-sw.js');
workbox.core.setCacheNameDetails({prefix: 'cmv2mp4-'});
workbox.skipWaiting();
workbox.clientsClaim();
workbox.googleAnalytics.initialize();
workbox.precaching.precacheAndRoute([
  {
    "url": "baybeyond.ogg",
    "revision": "ed00e117554df7e13351f60003415a6f"
  },
  {
    "url": "bayend.ogg",
    "revision": "88261d82de9b37a21d8e6a1ceb516bb3"
  },
  {
    "url": "bayquality.ogg",
    "revision": "0dde01264c72be6790f62e1533e8cd9f"
  },
  {
    "url": "baystart.ogg",
    "revision": "4d5508f89c9620239b447f6abbe18694"
  },
  {
    "url": "curses_800x600.png",
    "revision": "1faa2c26603e89b176f0d1a684aea383"
  },
  {
    "url": "DFINTRO.ogg",
    "revision": "634262897dc957c3b0373ec4bccff16a"
  },
  {
    "url": "DFINTROEND.ogg",
    "revision": "d1b3e3d8561036c2f59b3db46c3f01c3"
  },
  {
    "url": "DFPICK.ogg",
    "revision": "e8ce1aeafe3452cff10e0b98b565b5e8"
  },
  {
    "url": "DFRUBBLE.ogg",
    "revision": "194dcb95b4d58a3e42eb30a527d6df79"
  },
  {
    "url": "ffmpeg-mp4.js",
    "revision": "de684f3468bd4301c7560020dd6069f8"
  },
  {
    "url": "ffmpeg-mp4.js.mem",
    "revision": "9f326e4ac48e14df63bfb558a2152314"
  },
  {
    "url": "index.html",
    "revision": "f79eb231a30d69288e569f01ec768817"
  },
  {
    "url": "manifest-icon-192.png",
    "revision": "c01f58e336a2e0fc7345a538419f7c9f"
  },
  {
    "url": "manifest.json",
    "revision": "68692e90b71227a5580648588fc79420"
  },
  {
    "url": "pako_inflate.min.js",
    "revision": "7cf7c10567166f43c008178cda895f5a"
  },
  {
    "url": "style.css",
    "revision": "0efed3550f49480e2e5419741366fd29"
  },
  {
    "url": "ui.js",
    "revision": "1d63bee84176a2bcefd2b7a1cbd18e58"
  },
  {
    "url": "worker.js",
    "revision": "8729835913afe542b219dc7c545e8aac"
  },
  {
    "url": "/cmv2mp4",
    "revision": "eacf331f0ffc35d4b482f1d15a887d3b"
  }
]);
