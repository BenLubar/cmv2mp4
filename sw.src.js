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
workbox.precaching.precacheAndRoute([]);
