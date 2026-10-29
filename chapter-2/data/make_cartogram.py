"""Build the contiguous area cartogram used in Chapter 2 (first tab).

Each state's AREA is made proportional to its number of students tested (2026, chapter-2/data/map_latest.csv), while states keep touching their neighbours.
Method: Dougenik, Chrisman and Niemeyer (1985), "An algorithm to construct continuous area cartograms" - every state pulls or pushes
the map around it until areas match the target. Input: chapter-2/data/states.geojson (simplified outlines from Natural Earth).
Output (planar coordinates, y pointing down, so Vega-Lite can draw them with an "identity" projection):
  chapter-2/data/cartogram.geojson, chapter-2/data/cartogram_labels.csv
Run from the project root:  python3 chapter-2/data/make_cartogram.py
"""
import csv
import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
latest = list(csv.DictReader(open(ROOT / "chapter-2/data/map_latest.csv", encoding="utf-8")))
ENROLLED = {r["state"]: float(r["n"]) for r in latest}      # students tested (Tasmania has a count but no published result)
geo = json.load(open(ROOT / "chapter-2/data/states.geojson", encoding="utf-8"))


def albers(lon, lat, lon0=134.0, lat0=-27.0, p1=-18.0, p2=-36.0):
    """Albers equal-area conic projection (same one the Chapter 2 maps use) -> planar x, y with y pointing up."""
    r = np.radians
    n = (np.sin(r(p1)) + np.sin(r(p2))) / 2
    c = np.cos(r(p1)) ** 2 + 2 * n * np.sin(r(p1))
    rho = lambda phi: np.sqrt(c - 2 * n * np.sin(r(phi))) / n
    th = n * r(np.asarray(lon) - lon0)
    return rho(np.asarray(lat)) * 0 + rho(lat) * np.sin(th), rho(lat0) - rho(lat) * np.cos(th)


# ---- read the outlines: regions -> polygons -> rings -> (N, 2) arrays ----
regions = []
for f in geo["features"]:
    g = f["geometry"]
    polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
    rings = []
    for pi, poly in enumerate(polys):
        for ri, ring in enumerate(poly):
            a = np.array(ring, dtype=float)
            x, y = albers(a[:, 0], a[:, 1])
            rings.append({"xy": np.column_stack([x, y]), "hole": ri > 0, "poly": pi})
    regions.append({"name": f["properties"]["name"], "code": f["properties"]["code"], "rings": rings, "props": f["properties"]})


def ring_area(xy):
    x, y = xy[:, 0], xy[:, 1]
    return 0.5 * (np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1)))


def region_area_centroid(reg):
    A = 0.0; cx = cy = 0.0
    for r in reg["rings"]:
        xy = r["xy"]; x, y = xy[:, 0], xy[:, 1]
        cr = x * np.roll(y, -1) - np.roll(x, -1) * y
        a = 0.5 * cr.sum()
        sx = ((x + np.roll(x, -1)) * cr).sum() / 6; sy = ((y + np.roll(y, -1)) * cr).sum() / 6
        sgn = -1 if r["hole"] else 1
        A += sgn * abs(a); s = np.sign(a) or 1
        cx += sgn * sx * s; cy += sgn * sy * s
    return A, np.array([cx / A, cy / A])


total_enrolled = sum(ENROLLED[r["name"]] for r in regions)
total_area = sum(region_area_centroid(r)[0] for r in regions)
target = {r["name"]: total_area * ENROLLED[r["name"]] / total_enrolled for r in regions}

allpts = np.vstack([ring["xy"] for r in regions for ring in r["rings"]])
for it in range(120):
    info = [region_area_centroid(r) for r in regions]
    areas = np.array([i[0] for i in info]); cents = np.array([i[1] for i in info])
    des = np.array([target[r["name"]] for r in regions])
    # scale so the total area stays the same
    des = des * areas.sum() / des.sum()
    err = np.maximum(areas, des) / np.minimum(areas, des)
    mean_err = err.mean()
    if it % 20 == 0:
        print(it, "mean area error", round(float(mean_err), 3))
    if mean_err < 1.03:
        break
    radius = np.sqrt(areas / np.pi)
    mass = np.sqrt(des / np.pi) - np.sqrt(areas / np.pi)
    fr = 1 / (1 + mean_err)
    for reg in regions:
        for ring in reg["rings"]:
            p = ring["xy"]
            disp = np.zeros_like(p)
            for k in range(len(regions)):
                d = p - cents[k]
                dist = np.maximum(np.hypot(d[:, 0], d[:, 1]), 1e-9)
                r = radius[k]
                force = np.where(dist > r, mass[k] * r / dist, mass[k] * (dist / r) ** 2 * (4 - 3 * dist / r))
                disp += (d / dist[:, None]) * force[:, None]
            ring["new"] = p + disp * fr
    for reg in regions:
        for ring in reg["rings"]:
            ring["xy"] = ring.pop("new")

# ---- write out: scale to roughly 0-1000, y down ----
pts = np.vstack([ring["xy"] for r in regions for ring in r["rings"]])
x0, y0 = pts.min(axis=0); span = (pts.max(axis=0) - pts.min(axis=0)).max()
S = 1000 / span
STRETCH = 1.4      # widen the whole drawing: any linear stretch scales every area by the same factor, so area shares stay exact
feats, labels = [], []
for reg in regions:
    polys = {}
    for ring in reg["rings"]:
        xy = np.column_stack([(ring["xy"][:, 0] - x0) * S * STRETCH, (pts[:, 1].max() - ring["xy"][:, 1]) * S]).round(1)
        polys.setdefault(ring["poly"], []).append(xy.tolist())
    coords = [polys[k] for k in sorted(polys)]
    feats.append({"type": "Feature", "properties": {"name": reg["name"], "code": reg["code"]}, "geometry": {"type": "MultiPolygon", "coordinates": coords}})
    a, c = region_area_centroid(reg)
    cx, cy = round(float((c[0] - x0) * S * STRETCH), 1), round(float((pts[:, 1].max() - c[1]) * S), 1)
    # small states get their label beside the shape (ext = 1) with a short leader line; the rest are labelled inside
    outside = {"NT": (300, 170, -1), "ACT": (960, 830, 1), "TAS": (800, 955, 1)}.get(reg["code"])   # x, y (before stretch), side of the label (-1 = left of the state)
    if outside:
        outside = (round(outside[0] * STRETCH), outside[1], outside[2])
    labels.append({"state": reg["name"], "code": reg["code"], "cx": cx, "cy": cy, "ext": 1 if outside else 0,
                   "lx": outside[0] if outside else cx, "ly": outside[1] if outside else cy, "side": outside[2] if outside else 1,
                   "area_share": round(float(a / sum(region_area_centroid(r)[0] for r in regions) * 100), 2),
                   "students_share": round(ENROLLED[reg["name"]] / total_enrolled * 100, 2)})
(ROOT / "chapter-2/data/cartogram.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": feats}, separators=(",", ":")), encoding="utf-8")
with open(ROOT / "chapter-2/data/cartogram_labels.csv", "w", newline="", encoding="utf-8") as fh:
    w = csv.DictWriter(fh, fieldnames=list(labels[0])); w.writeheader(); w.writerows(labels)
print("wrote cartogram.geojson and cartogram_labels.csv")
for l in labels: print(l)
