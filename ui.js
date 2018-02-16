(function() {

var button = document.getElementById('button');
var file = document.getElementById('file');
var files = {};
var queue = [];

function workerMessage(e) {
	var msg = e.data;
	switch (msg.t) {
	case 'loaded':
		if (queue.length) {
			runQueued();
		} else {
			button.onclick = function() {
				file.click();
				return false;
			};
			button.disabled = false;
			button.innerText = 'Choose CMV File';
		}
		break;
	case 'progress':
		var frame = msg.f; // TODO
		files[msg.n].p.value = (msg.fo - (1 - msg.co / msg.cs) * msg.ls - msg.hs) / (msg.fs - msg.hs);
		break;
	case 'error':
		gtag('event', 'cmv-error');
		var span = document.createElement('span');
		span.className = 'error';
		span.innerText = msg.m;
		span.setAttribute('data-stack-trace', msg.s);
		files[msg.n].p.parentNode.replaceChild(span, files[msg.n].p);
		delete files[msg.n];
		break;
	case 'mp4':
		gtag('event', 'cmv-finished');
		var blob = new Blob([msg.d], {type: 'video/mp4'});
		var a = document.createElement('a');
		a.textContent = msg.m;
		a.download = msg.m;
		a.href = URL.createObjectURL(blob);
		files[msg.n].p.parentNode.replaceChild(a, files[msg.n].p);
		delete files[msg.n];
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
		d: data.data,
	};
	worker.postMessage(tilesetData);
};
tileset.src = 'curses_800x600.png';

function runQueued() {
	var f = queue.shift();
	var myWorker = worker;
	button.disabled = true;

	worker = new Worker('worker.js');
	worker.onmessage = workerMessage;
	worker.postMessage(tilesetData);

	var name = f.name;
	var reader = new FileReader();
	reader.onload = function() {
		gtag('event', 'cmv-started');

		while (Object.hasOwnProperty.call(files, name)) {
			name = name.replace(/\.cmv$/, '') + '_.cmv';
		}

		var div = document.createElement('div');
		div.className = 'file';

		var b = document.createElement('b');
		b.textContent = name;
		div.appendChild(b);

		div.appendChild(document.createElement('br'));

		var progress = document.createElement('progress');
		progress.max = 1;
		div.appendChild(progress);

		files[name] = {p: progress};

		button.parentNode.insertBefore(div, button.nextSibling);

		myWorker.postMessage({
			t: 'convert',
			n: name,
			d: new Uint8Array(this.result)
		});
	};
	reader.readAsArrayBuffer(f);
}

file.addEventListener('change', function() {
	if (file.files.length) {
		gtag('event', 'cmv-select');

		[].push.apply(queue, file.files);

		file.value = null;

		runQueued();
	}
});

document.addEventListener('drop', function(e) {
	e.preventDefault();

	gtag('event', 'cmv-drop');

	document.body.parentNode.classList.remove('dragdrop');

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

	if (!button.disabled) {
		runQueued();
	}
});

document.addEventListener('dragover', function(e) {
	e.preventDefault();

	document.body.parentNode.classList.add('dragdrop');
});

document.addEventListener('dragleave', function() {
	document.body.parentNode.classList.remove('dragdrop');
});

})();
