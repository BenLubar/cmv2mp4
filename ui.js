(function() {

var updateAvailable = false;
var button = document.getElementById('button');
var uploadFromUrl = document.getElementById('upload_from_url');
var ufuUrl = document.getElementById('ufu_url');
var file = document.getElementById('file');
var dragdrop = document.getElementById('dragdrop');
var concurrency = document.getElementById('concurrency');
var workerReady = false;
var files = {};
var running = 0;
var queue = [];
var queue2 = [];

concurrency.value = Math.max(localStorage.cmv2mp4_concurrency || Math.min(navigator.hardwareConcurrency || 2, navigator.deviceMemory || 4), 1);
concurrency.addEventListener('change', function() {
	localStorage.cmv2mp4_concurrency = parseInt(concurrency.value, 10);
	runQueued();
});

function workerMessage(e) {
	var msg = e.data;
	switch (msg.t) {
	case 'loaded':
		workerReady = true;
		runQueued();
		if (!updateAvailable) {
			button.onclick = function() {
				file.click();
				return false;
			};
			button.innerText = 'Choose CMV File';
			uploadFromUrl.removeAttribute('hidden');
		}
		button.disabled = false;
		break;
	case 'progress':
		files[msg.n].p.value = (msg.fo - (1 - msg.co / msg.cs) * msg.ls - msg.hs) / (msg.fs - msg.hs);
		files[msg.n].s.innerText = msg.s.replace(/kB time=/, 'kB\ntime=').replace(/= +/g, '=').replace(/\s+$/, '');
		break;
	case 'error':
		gtag('event', 'cmv-error');
		var span = document.createElement('span');
		span.className = 'error';
		span.innerText = msg.e;
		span.setAttribute('data-stack-trace', msg.s);
		files[msg.n].p.parentNode.replaceChild(span, files[msg.n].p);
		files[msg.n].s.innerText = '';
		delete files[msg.n];
		running--;
		runQueued();
		break;
	case 'audio':
		gtag('event', 'cmv-audio');
		files[msg.n].p.value = -1;
		files[msg.n].s.innerText = 'preparing to add audio...';
		running--;
		queue2.push({
			t: 'convert',
			n: msg.n,
			d: msg.d,
			a: msg.a
		});
		runQueued();
		break;
	case 'mp4':
		gtag('event', 'cmv-finished');
		var a = document.createElement('a');
		a.innerText = msg.m;
		a.download = msg.m;
		a.href = URL.createObjectURL(msg.d);
		files[msg.n].p.parentNode.replaceChild(a, files[msg.n].p);
		files[msg.n].s.innerText = Math.round(msg.d.size / 1024 / 1024 * 10) / 10 + ' MiB';
		delete files[msg.n];
		running--;
		runQueued();
		break;
	default:
		debugger;
	}
}

var worker = new Worker('worker.js');
worker.onmessage = workerMessage;

var tileset = new Image();
var tilesetData;
tileset.onload = function() {
	var canvas = document.createElement('canvas');
	canvas.width = tileset.width;
	canvas.height = tileset.height;

	var ctx = canvas.getContext('2d');
	ctx.drawImage(tileset, 0, 0);

	var data = ctx.getImageData(0, 0, tileset.width, tileset.height);
	tilesetData = {
		t: 'tileset',
		w: data.width,
		h: data.height,
		d: data.data
	};
	worker.postMessage(tilesetData);
};
tileset.src = 'curses_800x600.png';

function runQueued() {
	while (queue.length) {
		var f = queue.shift();
		var name = f.name;

		while (Object.hasOwnProperty.call(files, name)) {
			name = name.replace(/\.cmv$/, '') + '_.cmv';
		}

		var div = document.createElement('div');
		div.className = 'file';

		var b = document.createElement('b');
		b.innerText = name;
		div.appendChild(b);

		div.appendChild(document.createElement('br'));

		var progress = document.createElement('progress');
		progress.max = 1;
		div.appendChild(progress);

		var status = document.createElement('pre');
		status.className = 'status';
		status.innerText = 'waiting for a slot...';
		div.appendChild(status);

		files[name] = {p: progress, s: status};

		uploadFromUrl.parentNode.insertBefore(div, uploadFromUrl.nextSibling);

		queue2.push({
			t: 'convert',
			n: name,
			d: f
		});
	}

	if (!queue2.length || !workerReady || concurrency.value <= running) {
		return;
	}

	var f = queue2.shift();
	running++;

	var myWorker = worker;
	workerReady = false;

	worker = new Worker('worker.js');
	worker.onmessage = workerMessage;
	worker.postMessage(tilesetData);

	gtag('event', f.a ? 'cmv-audio-started' : 'cmv-started');

	files[f.n].s.innerText = f.a ? 'preparing to process audio...' : 'initializing...';

	myWorker.postMessage(f);
}

file.addEventListener('change', function() {
	if (file.files.length) {
		gtag('event', 'cmv-select');

		[].push.apply(queue, file.files);

		file.value = null;

		runQueued();
	}
});

document.body.parentNode.addEventListener('drop', function(e) {
	e.preventDefault();

	gtag('event', 'cmv-drop');

	dragdrop.classList = 'inactive';

	var dt = e.dataTransfer;
	if (dt.items) {
		for (var i = 0; i < dt.items.length; i++) {
			var item = dt.items[i];
			if (item.kind === 'file') {
				queue.push(item.getAsFile());
			}
		}
	} else {
		[].push.apply(queue, dt.files);
	}

	runQueued();
});

document.body.parentNode.addEventListener('dragover', function(e) {
	e.preventDefault();

	dragdrop.classList = '';
});

document.body.parentNode.addEventListener('dragleave', function() {
	dragdrop.classList = 'inactive';
});

uploadFromUrl.addEventListener('submit', function(e) {
	e.preventDefault();

	if (uploadFromUrl.getAttribute('hidden') !== null || !/^https?:\/\//.test(ufuUrl.value)) {
		return;
	}

	var url = ufuUrl.value;
	ufuUrl.value = '';

	var baseName = url.split('?')[0].split('/');
	baseName = baseName[baseName.length - 1];
	if (!baseName) {
		baseName = encodeURIComponent(url).replace(/%../g, '');
	}
	if (!/\.cmv$/.test(baseName)) {
		baseName += '.cmv';
	}
	var cors = 'https://cors-anywhere.herokuapp.com/' + url;
	gtag('event', 'cmv-url-started');

	var div = document.createElement('div');
	div.className = 'file';

	var b = document.createElement('b');
	b.innerText = url;
	div.appendChild(b);

	div.appendChild(document.createElement('br'));

	var progress = document.createElement('progress');
	div.appendChild(progress);

	var status = document.createElement('pre');
	status.className = 'status';
	status.innerText = 'requesting...';
	div.appendChild(status);

	uploadFromUrl.parentNode.insertBefore(div, uploadFromUrl.nextSibling);

	var xhr = new XMLHttpRequest();
	xhr.responseType = 'blob';
	xhr.onprogress = function(e) {
		if (e.lengthComputable) {
			progress.max = e.total;
			progress.value = e.loaded;
			status.innerText = 'downloading... ' + e.loaded + ' / ' + e.total;
		} else {
			status.innerText = 'downloading...';
		}
	};
	xhr.onload = function(e) {
		if (xhr.status >= 400) {
			gtag('event', 'cmv-url-error');

			var span = document.createElement('span');
			span.className = 'error';
			span.innerText = xhr.statusText;

			div.replaceChild(span, progress);
			status.innerText = '';

			return;
		}

		gtag('event', 'cmv-url-finished');

		uploadFromUrl.parentNode.removeChild(div);
		try {
			xhr.response.name = baseName;
		} catch (ex) {}

		queue.push(xhr.response);

		runQueued();
	};
	xhr.open('GET', cors, true);
	xhr.send();
});

if ('serviceWorker' in navigator) {
	if (navigator.serviceWorker.controller) {
		navigator.serviceWorker.addEventListener('controllerchange', function() {
			updateAvailable = true;
			button.innerText = 'Refresh for Update';
			button.onclick = function() {
				location.reload();
				return false;
			};
			button.disabled = false;
			uploadFromUrl.setAttribute('hidden', '');
		});
	}
	window.addEventListener('load', function() {
		navigator.serviceWorker.register('/cmv2mp4/sw.js');
	});
}

window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'UA-41367436-1');

})();
