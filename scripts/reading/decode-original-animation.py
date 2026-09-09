"""Bounded independent original-raster/GIF decoder; stdout evidence, no writes."""
import base64, hashlib, io, json, os, pathlib, sys
import PIL
from PIL import Image
# Fixed plugin inventory avoids format-dependent hidden imports.
Image.init()
H = lambda b: hashlib.sha256(b).hexdigest()
Image.MAX_IMAGE_PIXELS = 16000000

def require(ok, message):
    if not ok:
        raise ValueError('Original media decoder: ' + message)

def runtime():
    files = {}
    for module in tuple(sys.modules.values()):
        for name in ('__file__', '__cached__'):
            path = getattr(module, name, None)
            if not path or path == __file__:
                continue
            p = pathlib.Path(path)
            if p.is_file():
                p = p.resolve()
                require(p.stat().st_size <= 50000000, 'unbounded decoder module')
                files[str(p)] = H(p.read_bytes())
    exe = pathlib.Path(sys.executable).resolve()
    return {'pythonPath': str(exe), 'pythonSha256': H(exe.read_bytes()), 'pythonVersion': sys.version.split()[0], 'pillowVersion': PIL.__version__, 'modules': [{'path': p, 'sha256': h} for p, h in sorted(files.items())]}

def main():
    require(len(sys.argv) == 1, 'accept JSON on stdin only')
    raw = sys.stdin.buffer.read(1000001)
    require(len(raw) <= 1000000, 'unbounded input')
    items = json.loads(raw)
    require(isinstance(items, list) and len(items) <= 24, 'invalid image inventory')
    results = []
    for row in items:
        require(set(row) == {'id', 'path', 'sha256', 'format', 'mode'}, 'unknown decoder fields')
        require(row['format'] in ('PNG', 'WEBP', 'GIF') and row['mode'] in ('still', 'gif-frame0'), 'unsupported media type/clock')
        path = pathlib.Path(row['path'])
        require(path.is_file() and not path.is_symlink() and path.stat().st_nlink == 1 and path.stat().st_size <= 12000000, 'unsafe original raster')
        data = path.read_bytes()
        require(H(data) == row['sha256'], 'original raster hash mismatch')
        with Image.open(io.BytesIO(data)) as im:
            require(im.format == row['format'] and 0 < im.width * im.height <= 16000000, 'format or image bounds mismatch')
            count = getattr(im, 'n_frames', 1)
            require(1 <= count <= 500 and (row['mode'] != 'still' or count == 1), 'unsupported active raster clock')
            require(row['mode'] != 'gif-frame0' or im.format == 'GIF', 'frame extraction requires GIF')
            durations = []
            for n in range(count):
                im.seek(n)
                durations.append(int(im.info.get('duration', 0)))
            im.seek(0)
            rgba = im.convert('RGBA')
            out = io.BytesIO(); rgba.save(out, format='PNG', optimize=False)
            png = out.getvalue()
            # Independent roundtrip of lossless output; no label, color or geometry editing.
            with Image.open(io.BytesIO(png)) as reopened:
                require(reopened.convert('RGBA').tobytes() == rgba.tobytes(), 'lossless frame extraction changed pixels')
            results.append({'id': row['id'], 'originalSha256': row['sha256'], 'format': im.format, 'width': rgba.width, 'height': rgba.height, 'frameCount': count, 'durationsMs': durations, 'selectedFrame': 0, 'selectedTimeMs': 0, 'rgbaSha256': H(rgba.tobytes()), 'pngSha256': H(png), 'pngBase64': base64.b64encode(png).decode()})
        require(H(path.read_bytes()) == row['sha256'], 'source changed while decoding')
    print(json.dumps({'schemaVersion': 1, 'runtime': runtime(), 'images': results}, separators=(',', ':')))

if __name__ == '__main__':
    main()
