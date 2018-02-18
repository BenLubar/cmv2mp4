module.exports = {
	globDirectory: './',
	globPatterns: ['*.{js,mem,html,css,png,json,ogg}'],
	globIgnores: ['sw.js', 'sw.src.js', 'workbox-config.js'],
	swDest: 'sw.js',
	swSrc: 'sw.src.js',
	templatedUrls: {'/cmv2mp4': 'index.html'},
	maximumFileSizeToCacheInBytes: 5 << 20
};
