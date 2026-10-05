#!/bin/sh
# Φτιάχνει τα δύο κάθετα κλιπ του desktop hero από ένα βίντεο-πηγή.
#
#   ./make-hero.sh πηγή.mp4 [έναρξη_A] [έναρξη_B] [διάρκεια]
#
# Παράδειγμα (οι τρέχουσες τιμές):
#   ./make-hero.sh _src-media/hero-mob.mp4 0.85 6.85 5
#
# Βγάζει: assets/hero-p-a.mp4 (δεξί πάνελ, παίζει πρώτο)
#         assets/hero-p-b.mp4 (αριστερό πάνελ)
#         + .webp αφίσες για την πρώτη εμφάνιση
#
# ΣΗΜΑΝΤΙΚΟ: διάλεξε σημεία έναρξης που να πέφτουν σε ΚΑΘΑΡΟ καρέ.
# Αν η αρχή πέσει σε κίνηση/μετάβαση, στο loop θα φαίνεται θολούρα.
set -e
cd "$(dirname "$0")"

SRC="${1:?δώσε ένα αρχείο βίντεο-πηγή}"
A="${2:-0.85}"
B="${3:-6.85}"
LEN="${4:-5}"
W=810
H=912   # 8:9 — ό,τι βλέπει το ένα πάνελ σε 16:9 οθόνη

# κέντραρε και κόψε σε 8:9, όποια κι αν είναι η αναλογία της πηγής
CROP="crop=w='min(iw,ih*8/9)':h='min(ih,iw*9/8)':x='(iw-ow)/2':y='(ih-oh)/2',scale=${W}:${H}:flags=lanczos"

echo "πηγή: $SRC"
ffprobe -v error -select_streams v:0 -show_entries stream=width,height -show_entries format=duration \
  -of default=nw=1 "$SRC" | tr '\n' ' '; echo

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
echo "Έλεγξε τις αφίσες: assets/hero-p-a.webp, assets/hero-p-b.webp"
echo "Μετά: ./deploy.sh"
