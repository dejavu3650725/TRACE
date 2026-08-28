from pathlib import Path
import sys

from PIL import Image, ImageDraw


source = Path(sys.argv[1])
output = Path(sys.argv[2])
files = sorted(source.glob("page-*.png"))
if not files:
    raise SystemExit("No rendered page PNGs found")

tiles = []
for file in files:
    image = Image.open(file).convert("RGB")
    image.thumbnail((280, 396))
    tile = Image.new("RGB", (300, 430), "white")
    tile.paste(image, ((300 - image.width) // 2, 10))
    ImageDraw.Draw(tile).text((12, 408), file.stem, fill="black")
    tiles.append(tile)

columns = 4
rows = (len(tiles) + columns - 1) // columns
sheet = Image.new("RGB", (columns * 300, rows * 430), (225, 228, 235))
for index, tile in enumerate(tiles):
    sheet.paste(tile, ((index % columns) * 300, (index // columns) * 430))
sheet.save(output)
