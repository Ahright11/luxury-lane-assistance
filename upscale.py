#!/usr/bin/env python3
"""Real-ESRGAN upscale for the LLA hero montage. Resumable, runs on Apple GPU."""
import os, sys, time, subprocess, glob
import numpy as np, torch
from PIL import Image
from spandrel import ModelLoader

SP    = "/private/tmp/claude-501/-Users-manolesphotiades-latelier-site-assets/95b49a6d-db27-4594-99ab-2fa270c6497d/scratchpad"
OUT   = "/Users/manolesphotiades/lla-demo/assets"
WORK  = os.path.expanduser("~/.cache/upscale/work")
MODEL = os.path.expanduser("~/.cache/upscale/RealESRGAN_x4plus.pth")
FPS   = 24

# (source, start, dur, crop_y)  — same cuts as the montage
CUTS = [
    (f"{SP}/reel/3895981843760342975.mp4", 21.0, 2.4, 600),  # Ferrari wide
    (f"{SP}/lla/3911188606411522369.mp4",  15.0, 2.2, 640),  # Maserati
    (f"{SP}/lla/3951085708482329675.mp4",  25.5, 2.2, 620),  # Supra
    (f"{SP}/lla/3946672640918588688.mp4",  21.0, 2.2, 420),  # Boxster
    (f"{SP}/reel/3895981843760342975.mp4", 30.0, 2.4, 560),  # Ferrari rear
]

def sh(c): subprocess.run(c, shell=True, check=False,
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def extract():
    """Pull the 16:9 band from each cut as PNG frames (no upscale yet)."""
    raw = f"{WORK}/raw"; os.makedirs(raw, exist_ok=True)
    if glob.glob(f"{raw}/*.png"):
        print(f"[extract] reusing {len(glob.glob(f'{raw}/*.png'))} frames", flush=True)
        return
    n = 0
    for i, (src, ss, dur, cy) in enumerate(CUTS):
        sh(f'ffmpeg -y -ss {ss} -t {dur} -i "{src}" -vf '
           f'"crop=iw:iw*9/16:0:{cy},fps={FPS}" -start_number {n} "{raw}/%04d.png"')
        n = len(glob.glob(f"{raw}/*.png"))
        print(f"[extract] cut {i+1}/5 -> {n} frames", flush=True)

def upscale():
    raw, up = f"{WORK}/raw", f"{WORK}/up"
    os.makedirs(up, exist_ok=True)
    frames = sorted(glob.glob(f"{raw}/*.png"))
    dev = "mps" if torch.backends.mps.is_available() else "cpu"
    model = ModelLoader().load_from_file(MODEL).eval().to(dev)
    todo = [f for f in frames if not os.path.exists(f"{up}/{os.path.basename(f)}")]
    print(f"[upscale] {len(todo)} of {len(frames)} frames remaining on {dev}", flush=True)
    t0 = time.time()
    for k, f in enumerate(todo):
        im = Image.open(f).convert("RGB")
        t = torch.from_numpy(np.array(im)).permute(2,0,1).float().div(255).unsqueeze(0).to(dev)
        with torch.no_grad():
            o = model(t)
        arr = o.squeeze(0).clamp(0,1).mul(255).byte().permute(1,2,0).cpu().numpy()
        # 4x then down to 1080p = supersampled, extra clean
        Image.fromarray(arr).resize((1920,1080), Image.LANCZOS)\
             .save(f"{up}/{os.path.basename(f)}")
        del t, o
        if (k+1) % 5 == 0 or k == 0:
            el = time.time()-t0; per = el/(k+1)
            print(f"[upscale] {k+1}/{len(todo)}  {per:.1f}s/frame  "
                  f"~{(len(todo)-k-1)*per/60:.0f} min left", flush=True)
    print("[upscale] done", flush=True)

def encode():
    up = f"{WORK}/up"
    sh(f'ffmpeg -y -framerate {FPS} -i "{up}/%04d.png" -c:v libx264 -crf 20 '
       f'-preset slow -pix_fmt yuv420p -movflags +faststart "{OUT}/hero-fs.mp4"')
    sh(f'ffmpeg -y -ss 0.8 -i "{OUT}/hero-fs.mp4" -frames:v 1 -q:v 2 "{OUT}/hero-fs.jpg"')
    sz = os.path.getsize(f"{OUT}/hero-fs.mp4")/1048576
    print(f"[encode] hero-fs.mp4  {sz:.1f} MB", flush=True)

if __name__ == "__main__":
    os.makedirs(WORK, exist_ok=True)
    extract(); upscale(); encode()
    print("ALL DONE", flush=True)
