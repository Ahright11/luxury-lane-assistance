#!/usr/bin/env python3
"""Send the LLA hero cuts through Wavespeed (ByteDance 4K upscaler), then
downscale to 1080p for delivery (supersampled = sharper, still light)."""
import base64, json, os, subprocess, sys, time, urllib.request

KEY  = os.environ["WS"]
A    = "/Users/manolesphotiades/lla-demo/assets"
API  = "https://api.wavespeed.ai/api/v3"
JOBS = [
    # (source file, output file, final size)
    (f"{A}/hero-fs.mp4",  f"{A}/hero-fs.mp4",  "1920:1080"),
    (f"{A}/hero-mob.mp4", f"{A}/hero-mob.mp4", "1080:1920"),
]

def post(path, payload):
    r = urllib.request.Request(f"{API}{path}", data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(r, timeout=600))

def get(url):
    r = urllib.request.Request(url, headers={"Authorization": f"Bearer {KEY}"})
    return json.load(urllib.request.urlopen(r, timeout=120))

def balance():
    return get(f"{API}/balance")["data"]["balance"]

for src, dst, size in JOBS:
    name = os.path.basename(src)
    print(f"\n=== {name} ===", flush=True)
    # keep the upload small: send a lean 720p-ish version, let the model do the work
    tmp = f"/tmp/ws_in_{name}"
    w, h = size.split(":")
    small = "1280:-2" if int(w) > int(h) else "-2:1280"
    subprocess.run(f'ffmpeg -y -i "{src}" -an -vf "scale={small}" -c:v libx264 -crf 25 '
                   f'-preset fast "{tmp}"', shell=True, check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    mb = os.path.getsize(tmp) / 1048576
    print(f"upload {mb:.1f} MB", flush=True)

    uri = "data:video/mp4;base64," + base64.b64encode(open(tmp, "rb").read()).decode()
    job = post("/bytedance/video-upscaler", {"video": uri, "target_resolution": "4k"})
    jid = job["data"]["id"]
    poll = job["data"]["urls"]["get"]
    print(f"job {jid} submitted", flush=True)

    t0 = time.time()
    while True:
        d = get(poll)["data"]
        if d["status"] == "completed":
            out = d["outputs"][0]; break
        if d["status"] == "failed":
            print("FAILED:", d.get("error")); sys.exit(1)
        if time.time() - t0 > 900:
            print("TIMEOUT"); sys.exit(1)
        time.sleep(10)
    print(f"done in {time.time()-t0:.0f}s -> {out}", flush=True)

    raw = f"/tmp/ws_out_{name}"
    urllib.request.urlretrieve(out, raw)
    # 4K -> target size: supersampled downscale, then sane web bitrate
    subprocess.run(f'ffmpeg -y -i "{raw}" -an -vf "scale={size}:flags=lanczos+accurate_rnd" '
                   f'-c:v libx264 -crf 21 -preset slow -pix_fmt yuv420p '
                   f'-movflags +faststart "{dst}"', shell=True, check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    poster = dst.replace(".mp4", ".jpg")
    subprocess.run(f'ffmpeg -y -ss 0.8 -i "{dst}" -frames:v 1 -q:v 2 "{poster}"',
                   shell=True, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f"saved {dst}  {os.path.getsize(dst)/1048576:.1f} MB | balance ${balance()}", flush=True)

print("\nALL DONE", flush=True)
