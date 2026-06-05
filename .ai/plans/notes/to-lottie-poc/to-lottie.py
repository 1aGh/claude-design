#!/usr/bin/env python
"""to-lottie.py — emit the studyfi-v3 fire mascot as a Lottie, FROM CODE (DDR-094).

Reads the flame keyframe data (mascotFireData.ts) + hardcodes the body/face geometry
and the _layout.css .mascot--fire choreography, builds a Lottie via python-lottie.
One artifact → lottie-web (web) + lottie-react-native (native) render it identically.
Self-verified by rendering frames to PNG (cairo) here before it ever hits a device.
"""
import re, json, math, sys
from lottie import objects, Point
from lottie.objects import shapes, easing
from lottie.utils.color import Color
MASKADD = type(__import__("lottie").objects.Mask().mode).Add

DATA = sys.argv[1] if len(sys.argv) > 1 else "/Users/iagh/git/AI-StudyMate/frontend/StudyFiMobile/src/components/mascot/mascotFireData.ts"
OUT = sys.argv[2] if len(sys.argv) > 2 else "/tmp/mascot-fire.json"

FPS, DUR = 60, 3.6
NF = int(FPS * DUR)            # 216 frames
YOFF = 44                     # viewBox 0 -44 120 176 → comp 0..176

def rgb(h):
    h = h.lstrip('#'); return (int(h[0:2],16)/255, int(h[2:4],16)/255, int(h[4:6],16)/255)
def hexc(h):
    r,g,b = rgb(h); return Color(r,g,b)
def set_grad(gf, color_stops, op_stops):
    """color_stops=[(offset,'#hex')], op_stops=[(offset, alpha 0..1)] → flat gradient w/ opacity."""
    flat = []
    for off, hx in color_stops:
        r,g,b = rgb(hx); flat += [off, r, g, b]
    for off, a in op_stops:
        flat += [off, a]
    gf.colors.colors.clear_animation(flat)
    gf.colors.count = len(color_stops)

# ── data ────────────────────────────────────────────────────────────────────
ts = open(DATA).read()
FIRE_LAYERS = json.loads(re.search(r'FIRE_LAYERS[^=]*=\s*(\[.*?\]);', ts, re.S).group(1))
FIRE_GRADS  = {g["id"]: g for g in json.loads(re.search(r'FIRE_GRADIENTS[^=]*=\s*(\[.*?\]);', ts, re.S).group(1))}
# FIRE_OUTER = translate(-2.46 -54.10) scale(0.2)  → bake into flame vertices (+YOFF)
FX, FY, FS = -2.46, -54.10 + YOFF, 0.2
BASE_LOCAL = max(v for L in FIRE_LAYERS for f in L["frames"] for v in f[1::2])
FLAME_BASE_Y = BASE_LOCAL * FS + FY    # envelope scaleY pivot in comp coords

# ── helpers ──────────────────────────────────────────────────────────────────
def bezier(tpl, coords, sx, sy, tx, ty):
    verts, ins, outs, k, cur = [], [], [], 0, None
    tf = lambda x, y: [x*sx+tx, y*sy+ty]
    for cmd, n in tpl:
        if cmd in ("M", "L"):
            cur = tf(coords[k], coords[k+1]); k += 2
            verts.append(cur); ins.append([0,0]); outs.append([0,0])
        elif cmd == "C":
            c1 = tf(coords[k],coords[k+1]); c2 = tf(coords[k+2],coords[k+3]); p = tf(coords[k+4],coords[k+5]); k += 6
            outs[-1] = [c1[0]-cur[0], c1[1]-cur[1]]
            verts.append(p); ins.append([c2[0]-p[0], c2[1]-p[1]]); outs.append([0,0]); cur = p
    if len(verts) > 1 and abs(verts[-1][0]-verts[0][0]) < 0.01 and abs(verts[-1][1]-verts[0][1]) < 0.01:
        ins[0] = ins[-1]; verts.pop(); ins.pop(); outs.pop()
    bz = objects.Bezier(); bz.closed = True
    for v, i_, o_ in zip(verts, ins, outs):
        bz.add_point(Point(v[0], v[1]), Point(i_[0], i_[1]), Point(o_[0], o_[1]))
    return bz

def d_bezier(d, sx, sy, tx, ty):
    """parse a raw SVG path d → Bezier (for static body/face/star shapes)."""
    toks = re.findall(r'[MLCZ]|-?\d*\.?\d+', d)
    verts, ins, outs, i, cmd, cur = [], [], [], 0, None, None
    tf = lambda x, y: [x*sx+tx, y*sy+ty]
    while i < len(toks):
        t = toks[i]
        if t in "MLCZ": cmd = t; i += 1; continue
        if cmd in ("M","L"):
            cur = tf(float(toks[i]), float(toks[i+1])); i += 2
            verts.append(cur); ins.append([0,0]); outs.append([0,0])
        elif cmd == "C":
            c1=tf(float(toks[i]),float(toks[i+1])); c2=tf(float(toks[i+2]),float(toks[i+3])); p=tf(float(toks[i+4]),float(toks[i+5])); i+=6
            outs[-1]=[c1[0]-cur[0],c1[1]-cur[1]]; verts.append(p); ins.append([c2[0]-p[0],c2[1]-p[1]]); outs.append([0,0]); cur=p
    if len(verts)>1 and abs(verts[-1][0]-verts[0][0])<0.01 and abs(verts[-1][1]-verts[0][1])<0.01:
        ins[0]=ins[-1]; verts.pop(); ins.pop(); outs.pop()
    bz=objects.Bezier(); bz.closed=True
    for v,i_,o_ in zip(verts,ins,outs): bz.add_point(Point(*v),Point(*i_),Point(*o_))
    return bz

import io as _io
from lottie.parsers.svg import parse_svg_file as _psf
def _find_sh(o):
    if isinstance(o, dict):
        if o.get('ty') == 'sh': return o
        for v in o.values():
            r = _find_sh(v)
            if r: return r
    if isinstance(o, list):
        for v in o:
            r = _find_sh(v)
            if r: return r
def arc_bezier(d, dy=0.0):
    """Parse an SVG path d (incl. A arcs) → Bezier via python-lottie, offset y by dy."""
    an = _psf(_io.StringIO('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><path d="%s"/></svg>' % d))
    k = _find_sh(an.to_dict())['ks']['k']
    v, i_, o_ = k['v'], k['i'], k['o']
    if len(v) > 1 and abs(v[-1][0]-v[0][0]) < 0.01 and abs(v[-1][1]-v[0][1]) < 0.01:
        i_[0] = i_[-1]; v.pop(); i_.pop(); o_.pop()
    bz = objects.Bezier(); bz.closed = bool(k.get('c'))
    for vv, ii, oo in zip(v, i_, o_):
        bz.add_point(Point(vv[0], vv[1]+dy), Point(ii[0], ii[1]), Point(oo[0], oo[1]))
    return bz

# CSS easing tokens → per-segment Lottie bezier handles (out of kf N = in of kf N+1).
# Applying the same Bezier(p1,p2) to every keyframe reproduces CSS's per-segment easing.
def EINOUT(): return easing.Bezier(Point(0.65, 0), Point(0.35, 1))    # --ease-in-out
def EOUT():   return easing.Bezier(Point(0.34, 1.42), Point(0.5, 1))  # --ease-out (OVERSHOOT = the "odpich")
def EMORPH(): return easing.Bezier(Point(0.42, 0), Point(0.58, 1))    # SMIL keySplines (flame flicker)
EIO = EINOUT
def key(prop, pairs, ez=EINOUT):
    for t, val in pairs:
        prop.add_keyframe(t * NF if t <= 1 else t, val, ez())

# ── animation ────────────────────────────────────────────────────────────────
an = objects.Animation(NF, FPS); an.width = 120; an.height = 176
idx = [0]
def nl(layer, parent=None):
    layer.index = idx[0]; idx[0] += 1
    if parent is not None: layer.parent_index = parent.index
    an.add_layer(layer); return layer

# jump carrier (null) — crouch/jump/squash + tremble, anchor bottom-centre
carrier = objects.NullLayer()
carrier.transform.anchor_point.value = Point(60, 176)
key(carrier.transform.position, [(0,Point(60,176)),(0.10,Point(60,179)),(0.22,Point(60,179)),
    (0.48,Point(60,159)),(0.62,Point(60,176)),(1,Point(60,176))])
key(carrier.transform.scale, [(0,Point(100,100)),(0.10,Point(106,90)),(0.22,Point(106,90)),
    (0.38,Point(106,90)),(0.48,Point(93,110)),(0.62,Point(109,93)),(0.74,Point(99,102)),(1,Point(100,100))])
key(carrier.transform.rotation, [(0,0),(0.22,0),(0.26,-1.3),(0.30,1.3),(0.34,-1.0),(0.38,0.8),(0.48,0),(1,0)])
nl(carrier)

# ── aura (NOT parented) — radial citron, swell ──────────────────────────────
aura = objects.ShapeLayer()
AC = 76  # aura centre y (~head/flame junction; web glow is "circle at 50% 45%")
ag = objects.Group(); el = objects.Ellipse(); el.position.value = Point(60,AC); el.size.value = Point(96,96)
gf = objects.GradientFill(); gf.gradient_type = objects.GradientType.Radial
gf.start_point.value = Point(60,AC); gf.end_point.value = Point(60,AC-48)
set_grad(gf, [(0.0,'#e2c812'),(0.55,'#e2c812'),(1.0,'#e2c812')], [(0.0,0.85),(0.55,0.30),(1.0,0.0)])
ag.add_shape(el); ag.add_shape(gf); aura.add_shape(ag)
key(aura.transform.scale, [(0,Point(84,84)),(0.10,Point(84,84)),(0.40,Point(96,96)),(0.48,Point(130,130)),(0.60,Point(100,100)),(1,Point(84,84))])
aura.transform.anchor_point.value = Point(60,AC); aura.transform.position.value = Point(60,AC)
key(aura.transform.opacity, [(0,30),(0.10,30),(0.40,66),(0.48,100),(0.60,58),(1,30)])
nl(aura)

# ── flame (parented to carrier) — 3 morph groups + envelope ─────────────────
flame = objects.ShapeLayer()
for L in reversed(FIRE_LAYERS):
    g = objects.Group(); path = objects.Path()
    cyc = L["durMs"]/1000*FPS
    j = 0
    while j*(cyc/3) <= NF + cyc:
        v = L["frames"][j % 3]
        path.shape.add_keyframe(j*(cyc/3), bezier(L["template"], v, FS, FS, FX, FY), EMORPH())
        j += 1
    grad = FIRE_GRADS[L["gradId"]]
    gf = objects.GradientFill(); gf.gradient_type = objects.GradientType.Linear
    gf.start_point.value = Point(60, FLAME_BASE_Y); gf.end_point.value = Point(60, -10)
    set_grad(gf, [(float(s["offset"]), s["color"]) for s in grad["stops"]],
                 [(float(s["offset"]), float(s["opacity"])) for s in grad["stops"]])
    g.add_shape(path); g.add_shape(gf); flame.add_shape(g)
flame.transform.anchor_point.value = Point(60, FLAME_BASE_Y); flame.transform.position.value = Point(60, FLAME_BASE_Y)
key(flame.transform.scale, [(0,Point(100,2)),(0.42,Point(100,2)),(0.50,Point(100,112)),(0.58,Point(100,100)),(0.76,Point(100,100)),(1,Point(100,5))], ez=EOUT)
key(flame.transform.opacity, [(0,0),(0.42,0),(0.50,100),(0.58,100),(0.76,100),(1,0)], ez=EOUT)
nl(flame, carrier)

# ── body (parented) — 3 facets ──────────────────────────────────────────────
BTF = (0.09174, 0.09174, 12.86, 4.97 + YOFF)
FACET = {
 'pink':'M529.24 64.0978C517.757 44.0348 488.853 43.9504 477.253 63.9458L26.1371 841.565C14.5346 861.565 28.9649 886.619 52.0867 886.619L317.561 886.618L503.386 437.572L603.61 194.038L529.24 64.0978Z',
 'blue':'M503.387 437.572L689.184 886.617L948.264 886.619C971.308 886.619 985.748 861.716 974.301 841.717L603.61 194.038L503.387 437.572Z',
 'violet':'M317.562 886.618L475.714 1263.08C486.01 1287.58 520.735 1287.58 531.031 1263.08L689.184 886.618L503.386 437.572L317.562 886.618Z'}
body = objects.ShapeLayer()
for col, d in (('#f894c4',FACET['pink']),('#221dff',FACET['blue']),('#8732fe',FACET['violet'])):
    g=objects.Group(); pth=objects.Path(); pth.shape.value=d_bezier(d,*BTF); g.add_shape(pth); g.add_shape(objects.Fill(hexc(col))); body.add_shape(g)
nl(body, carrier)

# ── glasses (parented) ──────────────────────────────────────────────────────
glasses = objects.ShapeLayer()
def rrect(x,y,w,h,r,col):
    g=objects.Group(); rc=objects.Rect(); rc.position.value=Point(x+w/2,y+h/2+YOFF); rc.size.value=Point(w,h); rc.rounded.value=r
    g.add_shape(rc); g.add_shape(objects.Fill(hexc(col))); return g
for a in (rrect(54.04,52.31,10,3.6,1.8,'#1a1622'),rrect(20.74,52.51,6.5,3.2,1.6,'#1a1622'),rrect(90.84,52.51,6.5,3.2,1.6,'#1a1622')):
    glasses.add_shape(a)
for cx in (41.54,76.54):
    g=objects.Group(); el=objects.Ellipse(); el.position.value=Point(cx,54.11+YOFF); el.size.value=Point(31.6,31.6)
    st=objects.Stroke(hexc('#1a1622'),3.6); g.add_shape(el); g.add_shape(st); glasses.add_shape(g)
nl(glasses, carrier)

# ── eyes (parented, masked, blinking lids) ──────────────────────────────────
def circle_bz(cx, cy, r):
    h = r * 0.5523
    bz = objects.Bezier(); bz.closed = True
    bz.add_point(Point(cx, cy-r), Point(-h,0), Point(h,0))   # top  (in, out)
    bz.add_point(Point(cx+r, cy), Point(0,-h), Point(0,h))   # right
    bz.add_point(Point(cx, cy+r), Point(h,0), Point(-h,0))   # bottom
    bz.add_point(Point(cx-r, cy), Point(0,h), Point(0,-h))   # left
    return bz
def ell(cx, cy, d, col, op=100):
    g=objects.Group(); e=objects.Ellipse(); e.position.value=Point(cx,cy); e.size.value=Point(d,d)
    g.add_shape(e); f=objects.Fill(hexc(col)); f.opacity.value=op; g.add_shape(f); return g
LID_T=[0,0.06,0.12,0.42,0.47,0.88,0.92,1]; LID_UP=[0,0,16,16,0,0,16,0]; LID_LO=[0,0,-11,-11,0,0,-11,0]
def eye(cx, gaze):
    cy=54.11+YOFF; px=cx+gaze; py=cy+1; R=13.6
    L=objects.ShapeLayer()
    m=objects.Mask(); m.shape.value=circle_bz(cx,cy,R); m.mode=MASKADD; m.opacity.value=100
    L.masks = [m]
    # Lottie renders first-added shape on TOP → lids FIRST (cover on blink), sclera LAST (bottom)
    up=objects.Group(); ur=objects.Rect(); ur.size.value=Point(42,50)
    upbase=cy-R+1-25
    key(up.transform.position, [(t,Point(cx,upbase+o)) for t,o in zip(LID_T,LID_UP)])
    up.add_shape(ur); up.add_shape(objects.Fill(hexc('#2a2440'))); L.add_shape(up)
    lo=objects.Group(); lr=objects.Rect(); lr.size.value=Point(42,50)
    lobase=cy+R-1+25
    key(lo.transform.position, [(t,Point(cx,lobase+o)) for t,o in zip(LID_T,LID_LO)])
    lo.add_shape(lr); lo.add_shape(objects.Fill(hexc('#2a2440'))); L.add_shape(lo)
    L.add_shape(ell(px+2.6,py-3,4.8,'#fffefb')); L.add_shape(ell(px-2.6,py+3,2.1,'#fffefb',70))
    L.add_shape(ell(px,py,2*5.6,'#1a1622')); L.add_shape(ell(px,py,2*6.9,'#7850da'))
    L.add_shape(ell(cx,cy,2*R,'#fffefb'))
    return L
nl(eye(41.54,1.3), carrier)
nl(eye(76.54,-1.3), carrier)

# ── mouth (parented) — open smile (dark lens) + pink tongue ──────────────────
mouth=objects.ShapeLayer()
# exact open-smile shape (the real A-arc path, parsed by python-lottie)
mb=arc_bezier("M49.54 73.91 A22 22 0 0 1 68.54 73.91 A9.5 9 0 0 1 49.54 73.91 Z", dy=YOFF)
mg=objects.Group(); mp=objects.Path(); mp.shape.value=mb; mg.add_shape(mp); mg.add_shape(objects.Fill(hexc("#1a1622")))
mm=objects.Mask(); mm.shape.value=mb.clone(); mm.mode=MASKADD; mouth.masks=[mm]
# tongue = ellipse rx5.4 ry3.6, FIRST (top); dark lens LAST (bottom)
tg=objects.Group(); te=objects.Ellipse(); te.position.value=Point(59.04,80.91+YOFF); te.size.value=Point(10.8,7.2)
tg.add_shape(te); tg.add_shape(objects.Fill(hexc("#f894c4"))); mouth.add_shape(tg)
mouth.add_shape(mg)                                   # dark lens LAST (bottom)
# sfv3-m-fire-mouth: grit (scaleY 0.32) while charging → yell (scaleY 1.55) on ignite
mouth.transform.anchor_point.value = Point(59.04, 121); mouth.transform.position.value = Point(59.04, 121)
key(mouth.transform.scale, [(0,Point(100,100)),(0.08,Point(100,100)),(0.14,Point(112,32)),
    (0.42,Point(112,32)),(0.48,Point(110,155)),(0.62,Point(100,112)),(1,Point(100,100))])
nl(mouth, carrier)

# ── stars (NOT parented) — static ───────────────────────────────────────────
STARS=[('60.47,-37.37 60.82,-34.61 63.37,-33.53 60.61,-33.18 59.53,-30.63 59.19,-33.39 56.63,-34.47 59.39,-34.81','#fff0c2'),
('21.46,-0.54 22.43,1.35 24.54,1.46 22.65,2.42 22.54,4.54 21.58,2.65 19.46,2.54 21.35,1.58','#ffc23d'),
('98.7,3.19 98.75,5.55 100.81,6.7 98.45,6.75 97.3,8.81 97.25,6.45 95.19,5.3 97.55,5.25','#fff0c2'),
('12.21,38.01 12.47,39.62 13.99,40.21 12.38,40.47 11.79,41.99 11.53,40.38 10.01,39.79 11.62,39.53','#ffc23d'),
('107.68,41.72 108.42,43.45 110.28,43.68 108.55,44.42 108.32,46.28 107.59,44.55 105.72,44.32 107.45,43.59','#ffc23d'),
('30.3,108.33 30.42,109.71 31.67,110.3 30.29,110.42 29.71,111.67 29.58,110.29 28.33,109.71 29.71,109.58','#ffc23d'),
('91.8,110.11 92.36,111.56 93.89,111.8 92.44,112.36 92.2,113.89 91.64,112.44 90.11,112.2 91.56,111.64','#ffc23d')]
stars=objects.ShapeLayer()
for pts,col in STARS:
    g=objects.Group(); bz=objects.Bezier(); bz.closed=True
    for p in pts.split(): x,y=p.split(','); bz.add_point(Point(float(x),float(y)+YOFF))
    pth=objects.Path(); pth.shape.value=bz; g.add_shape(pth); g.add_shape(objects.Fill(hexc(col))); g.transform.opacity.value=80; stars.add_shape(g)
nl(stars)

# Lottie renders layers[0] on TOP; we added back->front, so reverse (parenting is by ind, safe).
an.layers.reverse()

json.dump(an.to_dict(), open(OUT,"w"))
print("✓ wrote", OUT, "| layers", idx[0], "| frames", NF, "| flame base y", round(FLAME_BASE_Y,1))
