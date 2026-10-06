#!/bin/sh
# Φτιάχνει τα δύο κάθετα κλιπ του desktop hero από ένα βίντεο-πηγή.
#
#   ./make-hero.sh πηγή.mp4 [έναρξη_A] [έναρξη_B] [διάρκεια]
#
# Παράδειγμα (οι τρέχουσες τιμές):
#   ./make-hero.sh _src-media/hero-mob.mp4 4.8 9.4 4.2
#
# Βγάζει: assets/hero-p-a.mp4 (δεξί πάνελ, παίζει πρώτο)
#         assets/hero-p-b.mp4 (αριστερό πάνελ)
#         + .webp αφίσες για την πρώτη εμφάνιση
#
# ΣΗΜΑΝΤΙΚΟ: διάλεξε σημεία έναρξης σε ΚΑΘΑΡΟ καρέ. Το βίντεο έχει γρήγορα
# πλάνα (whip pans) που στο still φαίνονται θολά. Το script ελέγχει μόνο του
# στο τέλος και σε προειδοποιεί. Για να δεις πού είναι τα θολά:
#   ./make-hero.sh --scan _src-media/hero-mob.mp4
set -e
cd "$(dirname "$0")"

SRC="${1:?δώσε ένα αρχείο βίντεο-πηγή}"
A="${2:-4.8}"
B="${3:-9.4}"
LEN="${4:-4.2}"
W=810
H=912   # 8:9 — ό,τι βλέπει το ένα πάνελ σε 16:9 οθόνη

# κέντραρε και κόψε σε 8:9, όποια κι αν είναι η αναλογία της πηγής
CROP="crop=w='min(iw,ih*8/9)':h='min(ih,iw*9/8)':x='(iw-ow)/2':y='(ih-oh)/2',scale=${W}:${H}:flags=lanczos"

echo "πηγή: $SRC"
ffprobe -v error -select_streams v:0 -show_entries stream=width,height -show_entries format=duration \
  -of default=nw=1 "$SRC" | tr '\n' ' '; echo

# --scan: δείχνει την οξύτητα ανά 0.2" ώστε να διαλέξεις καθαρά σημεία
if [ "$1" = "--scan" ]; then
  SRC="${2:?δώσε βίντεο}"
  D=$(mktemp -d); ffmpeg -v error -i "$SRC" -vf "fps=5,scale=270:-1" -q:v 4 "$D/f%04d.jpg"
  python3 - "$D" <<'PYX'
import sys, glob, numpy as np
from PIL import Image
vs=[]
for f in sorted(glob.glob(sys.argv[1]+'/*.jpg')):
    a=np.asarray(Image.open(f).convert('L'),dtype=np.float32)
    vs.append(float((np.abs(np.diff(a,axis=1)).mean()+np.abs(np.diff(a,axis=0)).mean())/2))
mx=max(vs)
print(f"{'t':>6} {'οξύτητα':>8}")
for i,v in enumerate(vs):
    print(f"{i/5:6.1f} {v:8.1f}  {'█'*int(24*v/mx)}{'   <- ΘΟΛΟ' if v<0.45*mx else ''}")
PYX
  rm -rf "$D"; exit 0
fi

encode () {
  name="$1"; start="$2"
  ffmpeg -y -v error -ss "$start" -t "$LEN" -i "$SRC" -vf "$CROP" \
    -c:v libx264 -crf 23 -preset slow -profile:v high -pix_fmt yuv420p \
    -r 25 -g 50 -movflags +faststart -an "assets/$name.mp4"
  ffmpeg -y -v error -i "assets/$name.mp4" -frames:v 1 /tmp/_hero_poster.png
  cwebp -quiet -q 76 /tmp/_hero_poster.png -o "assets/$name.webp" || true
  printf "  %-18s %6.0f KB  (από %ss)\n" "$name.mp4" "$(wc -c < "assets/$name.mp4" | awk '{print $1/1024}')" "$start"
}

encode hero-p-a "$A"
encode hero-p-b "$B"

echo
printf "σύνολο desktop hero: %.2f MB\n" "$(cat assets/hero-p-a.mp4 assets/hero-p-b.mp4 | wc -c | awk '{print $1/1048576}')"
# έλεγχος οξύτητας: αν κάποιο καρέ είναι θολό, το προειδοποιεί
for n in hero-p-a hero-p-b; do
  D=$(mktemp -d); ffmpeg -v error -i "assets/$n.mp4" -vf "fps=5,scale=270:-1" -q:v 4 "$D/f%04d.jpg"
  python3 - "$D" "$n" <<'PYX'
import sys, glob, numpy as np
from PIL import Image
vs=[]
for f in sorted(glob.glob(sys.argv[1]+'/*.jpg')):
    a=np.asarray(Image.open(f).convert('L'),dtype=np.float32)
    vs.append(float((np.abs(np.diff(a,axis=1)).mean()+np.abs(np.diff(a,axis=0)).mean())/2))
mn=min(vs)
print(("  ✓ " if mn>4 else "  ✗ ΠΡΟΣΟΧΗ ") + f"{sys.argv[2]}: min οξύτητα {mn:.1f}" + ("" if mn>4 else "  -> διάλεξε άλλα σημεία, υπάρχει θολό καρέ"))
PYX
  rm -rf "$D"
done

echo "Έλεγξε τις αφίσες: assets/hero-p-a.webp, assets/hero-p-b.webp"
echo "Μετά: ./deploy.sh"
