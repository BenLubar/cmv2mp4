var pako;
var ffmpeg;
var tileset;
var noexit = false;

var colors = [
	[
		[  0,   0,   0],
		[  0,   0, 128],
		[  0, 128,   0],
		[  0, 128, 128],
		[128,   0,   0],
		[128,   0, 128],
		[128, 128,   0],
		[192, 192, 192]
	],
	[
		[128, 128, 128],
		[  0,   0, 255],
		[  0, 255,   0],
		[  0, 255, 255],
		[255,   0,   0],
		[255,   0, 255],
		[255, 255,   0],
		[255, 255, 255]
	]
];

var realCalledRun = null;

var Module = {
	'thisProgram': 'ffmpeg',
	'stdin': function() { return null; }
};

var soundWhitelist = [
	'baybeyond.ogg',
	'bayend.ogg',
	'bayquality.ogg',
	'baystart.ogg',
	'DFINTROEND.ogg',
	'DFINTRO.ogg',
	'DFPICK.ogg',
	'DFRUBBLE.ogg'
];

Object.defineProperty(Module, 'calledRun', {
	get: function() {
		// return true the first time to prevent the initial run.
		// noInitialRun won't work because we need to define Module properties later.
		if (realCalledRun === null) {
			realCalledRun = false;
			return true;
		}
		return realCalledRun;
	},
	set: function(value) {
		realCalledRun = value;
	}
});

function loaded() {
	if (pako && Module['run'] && Module['asm'] && Module['memoryInitializerRequest'].readyState === 4 && tileset) {
		postMessage({t: 'loaded'});
	}
}

self.onmessage = function(e) {
	var msg = e.data;
	switch (msg.t) {
	case 'tileset':
		tileset = new TileSet(msg.w, msg.h, msg.d);
		loaded();
		break;
	case 'convert':
		convert(msg.n, msg.d, msg.a);
		break;
	default:
		debugger;
	}
};

self.onerror = function(message, source, lineno, colno, error) {
	fail(error);
	debugger;
};

var xhr = new XMLHttpRequest();
Module['memoryInitializerRequest'] = xhr;
xhr.open('GET', 'ffmpeg-mp4.js.mem', true);
xhr.responseType = 'arraybuffer';
xhr.onload = loaded;
xhr.send();

importScripts('pako_inflate.min.js', 'ffmpeg-mp4.asm.js', 'ffmpeg-mp4.js');

var reader = new FileReaderSync();

function Decoder(blob) {
	this.file = blob;
	this.fileOffset = 0;
	this.chunk = null;
	this.chunkOffset = 0;
	this.frame = null;
	this.lastChunkSize = 0;
	this.readHeader();
}

Decoder.prototype.rawWord = function(count) {
	var unpack = false;
	if (!count && count !== 0) {
		unpack = true;
		count = 1;
	}
	if (this.fileOffset + 4 * count > this.file.size) {
		throw new Error('unexpected end of file');
	}
	var slice = this.file.slice(this.fileOffset, this.fileOffset + 4 * count);
	this.fileOffset += 4 * count;
	var words = new Uint32Array(reader.readAsArrayBuffer(slice));
	return unpack ? words[0] : words;
};

Decoder.prototype.rawString50 = function(count) {
	var unpack = false;
	if (!count && count !== 0) {
		unpack = true;
		count = 1;
	}
	if (this.fileOffset + 50 * count > this.file.size) {
		throw new Error('unexpected end of file');
	}
	var slice = this.file.slice(this.fileOffset, this.fileOffset + 50 * count);
	var raw = new Uint8Array(reader.readAsArrayBuffer(slice));
	this.fileOffset += 50 * count;
	var strings = [];
	for (var i = 0; i < count; i++) {
		var chars = [];
		for (var j = 0; j < 50; j++) {
			if (!raw[i * 50 + j]) {
				break;
			}
			chars.push(raw[i * 50 + j]);
		}
		var string = String.fromCharCode.apply(String, chars);
		if (unpack) {
			return string;
		}
		strings.push(string);
	}
	return strings;
};

Decoder.prototype.readHeader = function() {
	var rawHeader = this.rawWord(4);
	this.version = rawHeader[0];
	if (this.version !== 10000 && this.version !== 10001) {
		throw new Error('not a CMV file');
	}
	this.columns = rawHeader[1];
	this.rows = rawHeader[2];
	this.frameSize = this.columns * this.rows * 2;
	this.delayrate = rawHeader[3];
	this.sounds = {
		files: [],
		time: []
	};
	for (var i = 0; i < 200; i++) {
		this.sounds.time.push([]);
	}
	if (this.version === 10001) {
		var count = this.rawWord();
		this.sounds.files = this.rawString50(count);
		var raw = this.rawWord(200 * 16);
		for (var i = 0; i < 200; i++) {
			for (var j = 0; j < 16; j++) {
				var index = raw[i * 16 + j];
				if (index !== 0xffffffff) {
					this.sounds.time[i].push(index);
				}
			}
		}
	}
	this.headerSize = this.fileOffset;
};

Decoder.prototype.nextChunk = function() {
	if (this.fileOffset === this.file.size) {
		return false;
	}
	var size = this.rawWord();
	if (this.fileOffset + size > this.file.size) {
		throw new Error('unexpected end of file');
	}
	var slice = this.file.slice(this.fileOffset, this.fileOffset + size);
	this.chunk = pako.inflate(new Uint8Array(reader.readAsArrayBuffer(slice)));
	this.fileOffset += size;
	this.lastChunkSize = size;
	if (this.chunk.length === 0) {
		throw new Error('empty chunk (corrupt CMV)');
	}
	if (this.chunk.length % this.frameSize !== 0) {
		throw new Error('unaligned chunk size (corrupt CMV)');
	}
	return true;
};

Decoder.prototype.nextFrame = function() {
	if (this.chunk && this.chunkOffset !== this.chunk.length) {
		this.frame = this.chunk.subarray(this.chunkOffset, this.chunkOffset + this.frameSize);
		this.chunkOffset += this.frameSize;
		return true;
	}
	if (this.nextChunk()) {
		this.frame = this.chunk.subarray(0, this.frameSize);
		this.chunkOffset = this.frameSize;
		return true;
	}
	return false;
};

function TileSet(width, height, data) {
	this.width = width / 16;
	this.height = height / 16;

	var stride1 = this.width * 4;
	var stride2 = stride1 * 16;
	var stride3 = stride2 * this.height;

	this.tiles = [];
	for (var ty = 0; ty < 16; ty++) {
		for (var tx = 0; tx < 16; tx++) {
			var tile = [];
			var offset = stride1 * tx + stride3 * ty;
			for (var y = 0; y < this.height; y++) {
				var row = data.subarray(offset, offset + stride1);
				for (var x = 0; x < row.length; x += 4) {
					if (row[x] === 255 && row[x + 1] === 0 && row[x + 2] === 255 && row[x + 3] === 255) {
						row[x] = row[x + 1] = row[x + 2] = row[x + 3] = 0;
					}
				}
				tile.push(row);
				offset += stride2;
			}
			this.tiles.push(tile);
		}
	}
}

function renderFrame(data, decoder, frame) {
	var length = decoder.columns * decoder.rows * tileset.width * tileset.height * 3;
	if (!data || data.length !== length) {
		data = new Uint8ClampedArray(length);
	}

	for (var tx = 0; tx < decoder.columns; tx++) {
		var off1 = tx * decoder.rows;
		for (var ty = 0; ty < decoder.rows; ty++) {
			var off2 = off1 + ty;
			var off3 = off2 + decoder.columns * decoder.rows;

			var t = tileset.tiles[frame[off2]];
			var fg = colors[frame[off3] >> 6][frame[off3] & 7];
			var bg = colors[0][(frame[off3] >> 3) & 7];

			for (var x = 0; x < tileset.width; x++) {
				for (var y = 0; y < tileset.height; y++) {
					var off4 = x * 4;
					var r = t[y][off4];
					var g = t[y][off4 + 1];
					var b = t[y][off4 + 2];
					var a = t[y][off4 + 3];

					var off5 = ((x + tx * tileset.width) + (y + ty * tileset.height) * decoder.columns * tileset.width) * 3;
					data[off5] = (r * a * fg[0] / 255 + (255 - a) * bg[0]) / 255;
					data[off5 + 1] = (g * a * fg[1] / 255 + (255 - a) * bg[1]) / 255;
					data[off5 + 2] = (b * a * fg[2] / 255 + (255 - a) * bg[2]) / 255;
				}
			}
		}
	}

	return data;
}

function fail(err) {
	if (err && !fail.err) {
		fail.err = err;

		postMessage({
			t: 'error',
			n: CMVInputDevice.name,
			e: err.message,
			s: err.stack
		});

		close();
	}
	return fail.err;
}
fail.err = null;

var CMVInputDevice = {
	name: '???.cmv',
	decoder: null,
	frame: 1,
	buffer: null,
	offset: 0,
	device: {
		open: function(stream) {
			stream.seekable = false;
		},
		read: function(stream, buffer, offset, length, pos) {
			if (!CMVInputDevice.refill()) {
				return 0;
			}

			var bytesRead = Math.min(length, CMVInputDevice.buffer.length - CMVInputDevice.offset);
			buffer.set(CMVInputDevice.buffer.subarray(CMVInputDevice.offset, CMVInputDevice.offset + bytesRead), offset);
			CMVInputDevice.offset += bytesRead;
			stream.node.timestamp = Date.now();
			return bytesRead;
		}
	},
	refill: function() {
		if (fail()) {
			return false;
		}

		var decoder = CMVInputDevice.decoder;
		var buffer = CMVInputDevice.buffer;

		if (buffer && buffer.length !== CMVInputDevice.offset) {
			return true;
		}

		try {
			if (!decoder.nextFrame()) {
				return false;
			}

			CMVInputDevice.buffer = renderFrame(buffer, decoder, decoder.frame);
			CMVInputDevice.offset = 0;
		} catch (err) {
			fail(err);

			return false;
		}

		postMessage({
			t: 'progress',
			n: CMVInputDevice.name,
			f: CMVInputDevice.frame,
			s: lastStatus,
			hs: decoder.headerSize,
			co: decoder.chunkOffset,
			cs: decoder.chunk.length,
			ls: decoder.lastChunkSize,
			fo: decoder.fileOffset,
			fs: decoder.file.size
		});

		CMVInputDevice.frame++;

		return true;
	}
};

var MP4OutputDevice = {
	blob: new Blob(),
	buffer: new Uint8Array(1 << 16),
	start: 0,
	offset: 0,
	device: {
		flush: function(stream) {
			if (MP4OutputDevice.offset === 0) {
				return;
			}

			var pos = MP4OutputDevice.start;
			var length = MP4OutputDevice.offset;
			var blob = MP4OutputDevice.blob;
			var data = MP4OutputDevice.buffer.subarray(0, length);
			if (blob.size === pos) {
				blob = new Blob([blob, data]);
			} else if (blob.size < pos) {
				var padding = new Uint8Array(pos - blob.size);
				blob = new Blob([blob, padding, data]);
			} else if (blob.size <= pos + length) {
				blob = new Blob([blob.slice(0, pos), data]);
			} else {
				blob = new Blob([blob.slice(0, pos), data, blob.slice(pos + length)]);
			}
			MP4OutputDevice.blob = blob;
			MP4OutputDevice.offset = 0;
		},
		llseek: function(stream, offset, whence) {
			MP4OutputDevice.device.flush(stream);

			if (whence === 1) {
				offset += stream.position;
			} else if (whence === 2) {
				offset += MP4OutputDevice.blob.size;
			}
			if (offset < 0) {
				throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
			}
			return offset;
		},
		read: function(stream, buffer, offset, length, pos) {
			MP4OutputDevice.device.flush(stream);

			var bytesRead = Math.min(length, MP4OutputDevice.blob.size - pos);
			if (!bytesRead) {
				return 0;
			}

			var slice = MP4OutputDevice.blob.slice(pos, pos + bytesRead);
			var data = reader.readAsArrayBuffer(slice);
			buffer.set(new Uint8Array(data), offset);
			stream.node.timestamp = Date.now();
			return slice.size;
		},
		write: function(stream, buffer, offset, length, pos) {
			if (!length) {
				return 0;
			}

			var remaining = length;
			while (remaining) {
				if (MP4OutputDevice.offset === 0) {
					MP4OutputDevice.start = pos;
				}
				var added = Math.min(MP4OutputDevice.buffer.length - MP4OutputDevice.offset, remaining);
				MP4OutputDevice.buffer.set(buffer.subarray(offset, offset + added), MP4OutputDevice.offset);
				MP4OutputDevice.offset += added;
				if (MP4OutputDevice.offset === MP4OutputDevice.buffer.length) {
					MP4OutputDevice.device.flush(stream);
				}
				remaining -= added;
				offset += added;
				pos += added;
			}

			stream.node.timestamp = Date.now();
			return length;
		}
	}
};

var lastStatus = 'starting encoder...';

function convert(name, blob, audioArgs) {
	CMVInputDevice.name = name;
	var mp4Name = name.replace(/\.cmv$/, '') + '.mp4';

	var decoder;
	if (!audioArgs) {
		try {
			decoder = new Decoder(blob);
			CMVInputDevice.decoder = decoder;
		} catch (err) {
			fail(err);
			return;
		}
	}

	var allowedSounds = audioArgs ? audioArgs.f : decoder.sounds.files.map(function(sound, i) {
		return [sound + '.ogg', i];
	}).filter(function(sound) {
		return soundWhitelist.indexOf(sound[0]) !== -1;
	});

	Module['preRun'].push(function() {
		var work = FS.mkdir('/work');
		FS.chdir('/work');

		if (!FS.createDevice.major) {
			FS.createDevice.major = 64;
		}

		if (audioArgs) {
			var blobs = [{'name': mp4Name, 'data': blob}];
			allowedSounds.map(function(sound) {
				return sound[0];
			}).filter(function(sound, i, a) {
				return a.indexOf(sound) === i;
			}).forEach(function(sound) {
				var xhr = new XMLHttpRequest();
				xhr.open('GET', sound, false);
				xhr.responseType = 'blob';
				xhr.send();

				blobs.push({'name': sound, 'data': xhr.response});
			});
			FS.mount(WORKERFS, {'blobs': blobs}, '/work');
		} else {
			var indev = FS.makedev(FS.createDevice.major++, 0);
			FS.registerDevice(indev, CMVInputDevice.device);
			FS.mkdev('/work/' + name, FS.getMode(true, false), indev);
		}

		FS.mkdir('/out');
		var outdev = FS.makedev(FS.createDevice.major++, 0);
		FS.registerDevice(outdev, MP4OutputDevice.device);
		FS.mkdev('/out/' + mp4Name, FS.getMode(true, true), outdev);
	});

	Module['postRun'].push(function() {
		if (fail()) {
			return;
		}

		if (!audioArgs && allowedSounds.length) {
			var audioTimestamps = [];
			for (var i = 0; i < 200; i++) {
				decoder.sounds.time[i].forEach(function(j) {
					allowedSounds.filter(function(sound) {
						return sound[1] === j;
					}).forEach(function(sound) {
						audioTimestamps.push([sound[0], i * decoder.delayrate / 100]);
					});
				});
			}

			if (audioTimestamps.length) {
				var aargs = [];
				var afilter = [];
				audioTimestamps.forEach(function(sound, i) {
					var ms = Math.round(sound[1] * 1000);
					afilter.push('[', i + 1, ':a]');
					if (ms) {
						afilter.push('adelay=', ms, '|', ms, ',');
					}
					afilter.push('apad[a', i, '];');
					aargs.push('-i', sound[0]);
				});
				for (var i = 0; i < audioTimestamps.length; i++) {
					afilter.push('[a', i, ']');
				}
				afilter.push('amerge=inputs=', audioTimestamps.length, ',pan=stereo|c0=');
				for (var i = 0; i < audioTimestamps.length; i++) {
					afilter.push('c', i * 2, '+');
				}
				afilter.pop();
				afilter.push('|c1=');
				for (var i = 0; i < audioTimestamps.length; i++) {
					afilter.push('c', i * 2 + 1, '+');
				}
				afilter.pop();
				afilter.push('[aout]');

				aargs.push('-filter_complex', afilter.join(''), '-map', '0:v', '-map', '[aout]', '-c:a', 'aac', '-shortest');

				postMessage({
					t: 'audio',
					n: name,
					m: mp4Name,
					a: {a: aargs, f: allowedSounds},
					d: new Blob([MP4OutputDevice.blob], {type: 'video/mp4'})
				});

				if (!noexit) {
					close();
				}

				return;
			}
		}

		postMessage({
			t: 'mp4',
			n: name,
			m: mp4Name,
			d: new Blob([MP4OutputDevice.blob], {type: 'video/mp4'})
		});

		if (!noexit) {
			close();
		}
	});

	if (decoder) {
		postMessage({
			t: 'progress',
			n: name,
			f: 0,
			s: lastStatus,
			hs: decoder.headerSize,
			co: 0,
			cs: 1,
			ls: 1,
			fo: decoder.headerSize + 1,
			fs: decoder.file.size
		});
	}

	var logBuffer = [];

	Module['stdout'] = Module['stderr'] = function(c) {
		if (c === '\n'.charCodeAt(0)) {
			if (logBuffer[logBuffer.length - 1] === '\r'.charCodeAt(0)) {
				logBuffer.pop();
			}
			if (logBuffer.length) {
				var message = '[' + name + '] ' + String.fromCharCode.apply(String, logBuffer);
				if (typeof console !== 'undefined') {
					console.log(message);
				}
				logBuffer.splice(0, logBuffer.length);
			}
			return;
		}
		if (logBuffer[logBuffer.length - 1] === '\r'.charCodeAt(0)) {
			lastStatus = String.fromCharCode.apply(String, logBuffer);
			if (audioArgs) {
				postMessage({
					t: 'progress',
					n: name,
					f: 0,
					s: '(adding audio) ' + lastStatus,
					hs: 0,
					co: 0,
					cs: 1,
					ls: 1,
					fo: -1,
					fs: 1
				});
			}
			logBuffer.splice(0, logBuffer.length);
		}
		logBuffer.push(c);
	};

	var args = audioArgs ? [
		'-i', mp4Name
	].concat(audioArgs.a, [
		'-c:v', 'copy',
		'-movflags', '+faststart',
		'-y', '/out/' + mp4Name
	]) : [
		'-r', '100/' + (decoder.delayrate || 2),
		'-s', (decoder.columns * tileset.width) + 'x' + (decoder.rows * tileset.height),
		'-f', 'rawvideo',
		'-pix_fmt', 'rgb24',
		'-i', name,
		'-c:v', 'libx264',
		'-crf', '25',
		'-pix_fmt', 'yuv420p',
		'-movflags', '+faststart',
		'-preset', 'fast',
		'-r', '50',
		'-y', '/out/' + mp4Name
	];

	Module['run'](args);
}
