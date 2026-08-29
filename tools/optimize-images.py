#!/usr/bin/env python3
"""
Generate WebP derivatives into assets/opt/.

Originals in assets/colors/ and assets/images/ are never touched -- they stay
the archival copy and the <picture> fallback. This only adds smaller siblings,
because a few of the source files are enormous for what they show on screen
(0348.jpg is a 1 MB file rendered at 42 pixels).

    python tools/optimize-images.py

Requires Pillow. Outputs are committed to the repo, so contributors only need
to run this when they add or replace an image.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:  # pragma: no cover
    sys.exit("Pillow is required: pip install Pillow")

ROOT = Path(__file__).resolve().parent.parent
OPT = ROOT / "assets" / "opt"

# Colour photographs get a high quality setting: they are the visual record of
# what the fired glaze actually looks like, and this guide is a colour
# reference before it is anything else. 92 is visually lossless here.
COLOR_QUALITY = 92
DECOR_QUALITY = 82

# Rendered at 42px (card) and 72px (detail page). 320 covers 3x displays and
# anything we might want to do with these later.
COLOR_MAX = 320


def save_webp(image: Image.Image, target: Path, quality: int) -> int:
    target.parent.mkdir(parents=True, exist_ok=True)
    if image.mode not in ("RGB", "RGBA"):
        image = image.convert("RGBA" if "A" in image.getbands() else "RGB")
    image.save(target, "WEBP", quality=quality, method=6)
    return target.stat().st_size


def fit(image: Image.Image, max_width: int) -> Image.Image:
    if image.width <= max_width:
        return image.copy()
    height = round(image.height * max_width / image.width)
    return image.resize((max_width, height), Image.LANCZOS)


def relative_luminance(rgb: tuple[int, int, int]) -> float:
    def channel(value: int) -> float:
        v = value / 255
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4

    r, g, b = (channel(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def readable_on(rgb: tuple[int, int, int]) -> tuple[int, int, int]:
    """Black or white, whichever wins on WCAG contrast. Same rule as the site."""
    lum = relative_luminance(rgb)
    on_white = (1.05) / (lum + 0.05)
    on_black = (lum + 0.05) / 0.05
    return (0, 0, 0) if on_black >= on_white else (255, 255, 255)


def social_cards(colors: list[dict], manifest: dict) -> int:
    """
    One 1200x630 Open Graph card per color.

    Without these, sharing a color page hands Facebook and X the 100x85 product
    thumbnail, which is far too small for the large-image card the page asks
    for. The card is the flat color itself, which is also the most honest
    preview a color page could have.
    """
    out_dir = OPT / "social"
    out_dir.mkdir(parents=True, exist_ok=True)

    name_font = ImageFont.load_default(size=96)
    meta_font = ImageFont.load_default(size=40)
    tag_font = ImageFont.load_default(size=28)

    for c in colors:
        rgb = tuple(int(c["hex"].lstrip("#")[i : i + 2], 16) for i in (0, 2, 4))
        ink = readable_on(rgb)
        card = Image.new("RGB", (1200, 630), rgb)
        draw = ImageDraw.Draw(card)

        draw.text((80, 300), c["color"], font=name_font, fill=ink)
        draw.text((80, 420), f"{c['hex'].upper()}  -  {c['produced']}", font=meta_font, fill=ink)
        draw.text((80, 520), "The Unofficial Fiesta Color Guide", font=tag_font, fill=ink)

        # A hairline keeps a near-white card from disappearing on a white feed.
        draw.rectangle([(0, 0), (1199, 629)], outline=ink, width=2)

        name = f"{c['slug']}.jpg"
        card.save(out_dir / name, "JPEG", quality=82, optimize=True, progressive=True)
        manifest[f"assets/opt/social/{name}"] = {"w": 1200, "h": 630}

    return len(colors)


def main() -> None:
    saved_before = 0
    saved_after = 0
    count = 0
    # build.mjs reads this so it can emit width/height on every <img>, real
    # dimensions in the image sitemap, and og:image:width/height -- without
    # needing an image library in Node.
    manifest: dict[str, dict[str, int]] = {}

    # --- colour swatch photographs -------------------------------------
    for source in sorted((ROOT / "assets" / "colors").iterdir()):
        if source.suffix.lower() not in {".jpg", ".jpeg", ".png"}:
            continue
        with Image.open(source) as im:
            manifest[f"assets/colors/{source.name}"] = {"w": im.width, "h": im.height}
            out = OPT / "colors" / (source.stem + ".webp")
            resized = fit(im, COLOR_MAX)
            manifest[f"assets/opt/colors/{out.name}"] = {"w": resized.width, "h": resized.height}
            after = save_webp(resized, out, COLOR_QUALITY)
        before = source.stat().st_size
        saved_before += before
        saved_after += after
        count += 1

    # --- large decorative images ---------------------------------------
    jobs = [
        ("images/Fiesta-Plate-Stack-2023.png", "plate-stack-1200.webp", 1200),
        ("images/Fiesta-Plate-Stack-2023.png", "plate-stack-2000.webp", 2000),
        ("images/FeaturesBenefits.jpg", "features-1040.webp", 1040),
        ("images/made-in-usa.png", "made-in-usa-236.webp", 236),
    ]
    for rel_source, name, width in jobs:
        source = ROOT / "assets" / rel_source
        with Image.open(source) as im:
            manifest[f"assets/{rel_source}"] = {"w": im.width, "h": im.height}
            resized = fit(im, width)
            manifest[f"assets/opt/{name}"] = {"w": resized.width, "h": resized.height}
            after = save_webp(resized, OPT / name, DECOR_QUALITY)
        saved_before += source.stat().st_size
        saved_after += after
        count += 1

    # --- Open Graph card ------------------------------------------------
    # Social platforms want 1.91:1; the source is 2:1, so centre-crop rather
    # than letterbox, and ship JPEG because a few scrapers still ignore WebP.
    with Image.open(ROOT / "assets" / "images" / "FTC-OOGP.png") as im:
        target_w, target_h = 1200, 630
        scale = max(target_w / im.width, target_h / im.height)
        resized = im.convert("RGB").resize(
            (round(im.width * scale), round(im.height * scale)), Image.LANCZOS
        )
        left = (resized.width - target_w) // 2
        top = (resized.height - target_h) // 2
        card = resized.crop((left, top, left + target_w, top + target_h))
        og = OPT / "og-card.jpg"
        og.parent.mkdir(parents=True, exist_ok=True)
        card.save(og, "JPEG", quality=86, optimize=True, progressive=True)
        manifest["assets/opt/og-card.jpg"] = {"w": target_w, "h": target_h}
        count += 1

    # Social cards need the same slugs the site generates, so ask the module
    # that defines them rather than reimplementing the rule here.
    import subprocess

    query = (
        "import('./src/lib/data.mjs').then(async m=>{"
        "const d=await m.loadData('fiesta.json');"
        "console.log(JSON.stringify(d.colors.map(c=>"
        "({slug:c.slug,color:c.color,hex:c.hex,produced:c.produced}))))})"
    )
    try:
        result = subprocess.run(
            ["node", "-e", query], cwd=ROOT, capture_output=True, text=True, check=True
        )
        count += social_cards(json.loads(result.stdout), manifest)
    except (OSError, subprocess.CalledProcessError, json.JSONDecodeError) as exc:
        print(f"  skipped social cards (needs Node): {exc}")

    (OPT / "manifest.json").write_text(
        json.dumps(dict(sorted(manifest.items())), indent=2) + chr(10), encoding="utf-8"
    )

    print(f"Wrote {count} optimized files to assets/opt/")
    print(
        f"  {saved_before / 1024 / 1024:.2f} MB of sources -> "
        f"{saved_after / 1024 / 1024:.2f} MB of WebP "
        f"({100 - saved_after / saved_before * 100:.0f}% smaller)"
    )


if __name__ == "__main__":
    main()
