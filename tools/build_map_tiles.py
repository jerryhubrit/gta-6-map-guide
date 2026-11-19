"""Build the offline Yanis v16 original-color atlas tiles (Pillow required).

Usage: python3 tools/build_map_tiles.py /path/to/gtadb-yanis-16-z5 dist/tiles
Source: rolux/gtadb.org maps/tiles/6/yanis,16/5 @ 7c3f8c295d64254e6b6d269b77c6f84fc4339f9c
The navanem/gta6-leonida-atlas mirror exposes the same JPEG set in
public/assets/street-leonida/maps/gtadb-yanis-16-z5. Cartography CC BY 4.0,
Yanis, GTADB and the GTA Mapping Community. Adaptations: geographical crop,
ocean fill beyond the map, WebP compression, overview levels.
"""
import argparse
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path
from PIL import Image

ORIGIN = (3550, 5450)
MAP_WIDTH = 19000
# The left panel contains a legend and reference photographs. The cartographic
# portion starts at 5384. Eight more pixels remove the JPEG boundary fringe.
MAP_PANEL = (5392, 5376, 20384, 24384)
OCEAN = (44, 104, 166)
MAX_GRID = 16
TILE_WIDTH = 256


def bounds(width, grid, x, y):
    return tuple(round(c * width / grid) for c in (x, y, x + 1, y + 1))


def overlap(a, b):
    box = (max(a[0], b[0]), max(a[1], b[1]), min(a[2], b[2]), min(a[3], b[3]))
    return box if box[0] < box[2] and box[1] < box[3] else None


def original_crop(directory, box):
    """Copy source JPEG pixels 1:1 at their absolute raw coordinate."""
    out = Image.new("RGB", (box[2] - box[0], box[3] - box[1]), OCEAN)
    region = overlap(box, MAP_PANEL)
    if not region:
        return out
    for row in range(region[1] // TILE_WIDTH, (region[3] - 1) // TILE_WIDTH + 1):
        for col in range(region[0] // TILE_WIDTH, (region[2] - 1) // TILE_WIDTH + 1):
            left, top = col * TILE_WIDTH, row * TILE_WIDTH
            clip = overlap(region, (left, top, left + TILE_WIDTH, top + TILE_WIDTH))
            with Image.open(directory / f"5,{row},{col}.jpg") as tile:
                patch = tile.crop((clip[0]-left, clip[1]-top, clip[2]-left, clip[3]-top))
                out.paste(patch, (clip[0]-box[0], clip[1]-box[1]))
    return out


def write_tile(args):
    source, target, grid, x, y = args
    width = round(MAP_WIDTH * grid / MAX_GRID)
    box = bounds(width, grid, x, y)
    if grid == MAX_GRID:
        left, top = ORIGIN
        tile = original_crop(source, (box[0]+left, box[1]+top, box[2]+left, box[3]+top))
    else:
        # Reassemble four child tiles; their widths differ by at most one pixel.
        child_grid = grid * 2
        child_width = round(MAP_WIDTH * child_grid / MAX_GRID)
        left, top, right, bottom = bounds(child_width, grid, x, y)
        child_canvas = Image.new("RGB", (right-left, bottom-top), OCEAN)
        for cy in (2*y, 2*y+1):
            for cx in (2*x, 2*x+1):
                position = bounds(child_width, child_grid, cx, cy)
                with Image.open(target / str(child_grid) / f"{cx}-{cy}.webp") as child:
                    child_canvas.paste(child, (position[0]-left, position[1]-top))
        tile = child_canvas.resize((box[2]-box[0], box[3]-box[1]), Image.Resampling.LANCZOS)
    dest = target / str(grid) / f"{x}-{y}.webp"
    tile.save(dest, "WEBP", quality=91, method=4)
    return dest.stat().st_size


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("target", type=Path)
    args = parser.parse_args()
    with ProcessPoolExecutor(max_workers=4) as pool:
        for grid in (16, 8, 4, 2, 1):
            (args.target / str(grid)).mkdir(parents=True, exist_ok=True)
            tasks = [(args.source, args.target, grid, x, y) for y in range(grid) for x in range(grid)]
            size = sum(pool.map(write_tile, tasks))
            print(f"{grid}×{grid}: {size:,} bytes", flush=True)


if __name__ == "__main__":
    main()
