var realDBOpen = indexedDB.open;
indexedDB.open = function(name) {
	if (name === 'workbox-precaching') {
		return realDBOpen.call(indexedDB, 'workbox-precaching-cmv2mp4');
	}
	return realDBOpen.apply(indexedDB, arguments);
};

importScripts('https://storage.googleapis.com/workbox-cdn/releases/3.0.0-beta.0/workbox-sw.js');

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
    "url": "ffmpeg-mp4.asm.js",
    "revision": "79774afdb02b6471725ce110786ec209"
  },
  {
    "url": "ffmpeg-mp4.js",
    "revision": "28d8756695bcf1451cc63121f9d47661"
  },
  {
    "url": "ffmpeg-mp4.js.mem",
    "revision": "71f4f12057caaaaef54d0b448cb68540"
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
    "revision": "ec89b45dd430261645a576390741fc3f"
  },
  {
    "url": "worker.js",
    "revision": "ed51dd4ff29c0b154da69a7d3e80ab6c"
  },
  {
    "url": "/cmv2mp4",
    "revision": "eacf331f0ffc35d4b482f1d15a887d3b"
  }
]);
