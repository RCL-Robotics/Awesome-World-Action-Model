#!/usr/bin/env python3
"""Trusted, offline source reader and faithful PDF crop tool for isolated workers."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def contained(root, name):
    path = (root / name).resolve()
    if not path.is_relative_to(root.resolve()):
        raise ValueError("Path escapes the private workspace")
    return path


def record(root, entry):
    with (root / "source-audit.jsonl").open("a") as stream:
        stream.write(json.dumps(entry) + "\n")


def render(root, config, page, dpi):
    if config["manifest"]["kind"] != "pdf":
        raise ValueError("Only verified PDFs may be rendered")
    if not isinstance(page, int) or page < 1 or not 180 <= dpi <= 600:
        raise ValueError("Use a positive PDF page and 180–600 DPI")
    from pypdf import PdfReader
    source = contained(root, config["sourceFile"])
    if page > len(PdfReader(source).pages):
        raise ValueError("Page is outside this PDF")
    directory = root / "renders"
    directory.mkdir(exist_ok=True)
    output = directory / f"page-{page}-{dpi}"
    if not output.with_suffix(".png").exists():
        environment = dict(os.environ, FONTCONFIG_FILE=str(root / "fonts.conf"))
        subprocess.run([config["pdftoppm"], "-f", str(page), "-l", str(page), "-r", str(dpi), "-singlefile", "-png", str(source), str(output)], check=True, env=environment, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    return output.with_suffix(".png")


def crop(root, config, page, dpi, bounds, name, output_dir="assets"):
    if not re.fullmatch(r"[a-z0-9-]+", name):
        raise ValueError("Unsafe crop name")
    if len(bounds) != 4 or not all(0 <= x <= 1 for x in bounds) or bounds[0] >= bounds[2] or bounds[1] >= bounds[3]:
        raise ValueError("Invalid normalized crop bounds")
    from PIL import Image
    path = render(root, config, page, dpi)
    with Image.open(path) as image:
        box = tuple(round(n * image.size[i % 2]) for i, n in enumerate(bounds))
        result = image.crop(box)
        if min(result.size) < 20:
            raise ValueError("Crop is too small")
        directory = root / output_dir
        directory.mkdir(exist_ok=True)
        target = directory / f"{name}.png"
        result.save(target)
        return {"id": name, "page": page, "dpi": dpi, "crop": bounds, "path": str(target.relative_to(root)), "width": result.width, "height": result.height, "sha256": sha(target)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path.cwd())
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("inventory")
    reader = commands.add_parser("read")
    reader.add_argument("chunk", type=int)
    renderer = commands.add_parser("render")
    renderer.add_argument("page", type=int)
    renderer.add_argument("--dpi", type=int, default=200)
    cutter = commands.add_parser("crop")
    cutter.add_argument("page", type=int)
    cutter.add_argument("name")
    cutter.add_argument("bounds", nargs=4, type=float)
    cutter.add_argument("--dpi", type=int, default=200)
    verifier = commands.add_parser("verify")
    verifier.add_argument("audit", type=Path)
    arguments = parser.parse_args()
    root = arguments.root.resolve()
    config = json.loads((root / "source-config.json").read_text())
    if sha(contained(root, config["sourceFile"])) != config["manifest"]["sha256"] or sha(root / "source.txt") != config["manifest"]["textSha256"]:
        raise ValueError("Source snapshot fingerprint changed")
    if arguments.command == "inventory":
        chunks = config["chunks"]
        pages = None
        if config["manifest"]["kind"] == "pdf":
            from pypdf import PdfReader
            pages = len(PdfReader(contained(root, config["sourceFile"])).pages)
        print(json.dumps({"chunks": len(chunks), "pages": pages, "scope": config["manifest"].get("scope"), "omissions": config["manifest"].get("omissions", [])}))
    elif arguments.command == "read":
        chunks = config["chunks"]
        if not 1 <= arguments.chunk <= len(chunks):
            raise ValueError("Unknown text chunk")
        chunk = chunks[arguments.chunk - 1]
        data = contained(root, chunk["path"]).read_text()
        if hashlib.sha256(data.encode()).hexdigest() != chunk["sha256"]:
            raise ValueError("Text chunk changed")
        print(f"SOURCE CHUNK {arguments.chunk}/{len(chunks)} — retain existing page/section labels\n{data}")
        record(root, {"operation": "read", "chunk": arguments.chunk, "sha256": chunk["sha256"]})
    elif arguments.command == "render":
        path = render(root, config, arguments.page, arguments.dpi)
        record(root, {"operation": "render", "page": arguments.page, "dpi": arguments.dpi, "path": str(path.relative_to(root)), "sha256": sha(path)})
        print(path)
    elif arguments.command == "crop":
        result = crop(root, config, arguments.page, arguments.dpi, arguments.bounds, arguments.name)
        record(root, {"operation": "crop", **result})
        print(json.dumps(result))
    elif arguments.command == "verify":
        # The coordinator invokes its trusted copy, in a fresh verification directory.
        audit = json.loads(arguments.audit.read_text())
        print(json.dumps([crop(root, config, item["page"], item["dpi"], item["crop"], item["id"]) for item in audit]))


if __name__ == "__main__":
    main()
