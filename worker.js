var pako;
var ffmpeg;
var tileset;

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

function loaded() {
	if (pako && ffmpeg && tileset) {
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
		convert(msg.n, msg.d);
		break;
	default:
		debugger;
	}
};

self.exports = {};
self.module = {};

Object.defineProperty(self.module, 'exports', {
	set: function(value) {
		if (typeof value === 'function') {
			ffmpeg = value;
		} else {
			pako = value;
		}

		if (ffmpeg && pako) {
			delete self.exports;
			delete self.module;
			loaded();
		}
	}
});

importScripts('pako_inflate.min.js', 'ffmpeg-mp4.js');

function Decoder(bytes) {
	this.file = bytes;
	this.fileOffset = 0;
	this.chunk = null;
	this.chunkOffset = 0;
	this.frame = null;
	this.lastChunkSize = 0;
	this.readHeader();
}

Decoder.prototype.rawWord = function() {
	if (this.fileOffset + 4 > this.file.length) {
		throw new Error('unexpected end of file');
	}
	this.fileOffset += 4;
	return this.file[this.fileOffset - 4] |
		(this.file[this.fileOffset - 3] << 8) |
		(this.file[this.fileOffset - 2] << 16) |
		(this.file[this.fileOffset - 1] << 24);
};

Decoder.prototype.rawString50 = function() {
	if (this.fileOffset + 50 > this.file.length) {
		throw new Error('unexpected end of file');
	}
	var chars = [];
	for (var i = 0; i < 50; i++) {
		if (!this.file[this.fileOffset + i]) {
			break;
		}
		chars.push(this.file[this.fileOffset + i]);
	}
	this.fileOffset += 50;
	return String.fromCharCode.apply(String, chars);
};

Decoder.prototype.readHeader = function() {
	this.version = this.rawWord();
	if (this.version !== 0x2710 && this.version !== 0x2711) {
		throw new Error('not a CMV file');
	}
	this.columns = this.rawWord();
	this.rows = this.rawWord();
	this.frameSize = this.columns * this.rows * 2;
	this.delayrate = this.rawWord();
	this.sounds = {
		files: [],
		time: []
	};
	for (var i = 0; i < 200; i++) {
		this.sounds.time.push([]);
	}
	if (this.version === 0x2711) {
		var count = this.rawWord();
		for (var i = 0; i < count; i++) {
			this.sounds.files.push(this.rawString50());
		}
		for (var i = 0; i < 200; i++) {
			for (var j = 0; j < 16; j++) {
				var index = this.rawWord();
				if (index !== -1) {
					this.sounds.time[i].push(index);
				}
			}
		}
	}
	this.headerSize = this.fileOffset;
};

Decoder.prototype.nextChunk = function() {
	if (this.fileOffset === this.file.length) {
		return false;
	}
	var size = this.rawWord();
	if (this.fileOffset + size > this.file.length) {
		throw new Error('unexpected end of file');
	}
	this.chunk = pako.inflate(this.file.subarray(this.fileOffset, this.fileOffset + size));
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

function renderFrame(decoder, frame) {
	var data = new Uint8ClampedArray(decoder.columns * decoder.rows * tileset.width * tileset.height * 3);

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

function convert(name, data) {
	try {
		doConvert(name, new Decoder(data));
	} catch (err) {
		postMessage({
			t: 'error',
			n: name,
			e: err.message,
			s: err.stack
		});
		close();
	}
}

function doConvert(name, decoder) {
	var frame = 1;
	var buffer = null;
	var offset = 0;
	var fail = null;

	function stdin() {
		if (fail) {
			return null;
		}

		try {
			if (buffer === null || buffer.length === offset) {
				if (decoder.nextFrame()) {
					buffer = renderFrame(decoder, decoder.frame);
					offset = 0;

					postMessage({
						t: 'progress',
						n: name,
						f: frame,
						hs: decoder.headerSize,
						co: decoder.chunkOffset,
						cs: decoder.chunk.length,
						ls: decoder.lastChunkSize,
						fo: decoder.fileOffset,
						fs: decoder.file.length
					});
					frame++;
				} else {
					return null;
				}
			}

			return buffer[offset++];
		} catch (err) {
			fail = err;

			postMessage({
				t: 'error',
				n: name,
				e: err.message,
				s: err.stack
			});
			close();

			return null;
		}
	}

	var size = (decoder.columns * tileset.width) + 'x' + (decoder.rows * tileset.height);
	var result = ffmpeg({
		arguments: [
			'-r', '50',
			'-s', size,
			'-f', 'rawvideo',
			'-pix_fmt', 'rgb24',
			'-i', '-',
			'-c:v', 'libx264',
			'-crf', '0',
			'-pix_fmt', 'yuv444p',
			name.replace(/\.cmv$/, '') + '.mp4'
		],
		stdin: stdin
	});

	if (fail) {
		throw fail;
	}

	if (result.MEMFS.length !== 1 || !result.MEMFS[0].data.length) {
		throw new Error('conversion failed! check console for details.');
	}

	postMessage({
		t: 'mp4',
		n: name,
		m: result.MEMFS[0].name,
		d: result.MEMFS[0].data
	});

	close();
}
