importScripts('https://storage.googleapis.com/workbox-cdn/releases/3.0.0-beta.0/workbox-sw.js');
workbox.core.setCacheNameDetails({prefix: 'cmv2mp4-'});
workbox.skipWaiting();
workbox.clientsClaim();
workbox.googleAnalytics.initialize();
workbox.precaching.precacheAndRoute([
  {
    "url": "curses_800x600.png",
    "revision": "1faa2c26603e89b176f0d1a684aea383"
  },
  {
    "url": "ffmpeg-mp4.js",
    "revision": "aa6e509527a6c12d06663e6c58fa19bb"
  },
  {
    "url": "ffmpeg-mp4.js.mem",
    "revision": "61fcb0337d50fa73f3cb45ee37f7d721"
  },
  {
    "url": "index.html",
    "revision": "a23b78baa838fd96b533c0ec04844642"
  },
  {
    "url": "pako_inflate.min.js",
    "revision": "7cf7c10567166f43c008178cda895f5a"
  },
  {
    "url": "style.css",
    "revision": "b184564d023c2ce174f30de8443721d7"
  },
  {
    "url": "ui.js",
    "revision": "482a096ce5f448ab7c098bbb8acb9ee5"
  },
  {
    "url": "worker.js",
    "revision": "b3028d659a9698225a552d614da7c6f9"
  },
  {
    "url": "/cmv2mp4",
    "revision": "eacf331f0ffc35d4b482f1d15a887d3b"
  }
]);
