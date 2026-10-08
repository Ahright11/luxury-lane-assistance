#!/bin/sh
# Φτιάχνει τα βίντεο του hero από το βίντεο-πηγή + φωτογραφίες (stills).
#
#   ./make-hero.sh                       # με τις τρέχουσες ρυθμίσεις
#   ./make-hero.sh --scan                # δείχνει πού είναι τα θολά καρέ της πηγής
#   STILLS="a.jpg b.jpg" ./make-hero.sh  # άλλες φωτογραφίες για το τελευταίο πλάνο
#
# Βγάζει: assets/hero-p-a.mp4  δεξί πάνελ desktop (παίζει πρώτο)
#         assets/hero-p-b.mp4  αριστερό πάνελ desktop
#         assets/hero-mob.mp4  κινητό (κάθετο, ολόκληρο)
#         + .webp αφίσες
#
# Η πηγή (_src-media/hero-mob.mp4, 13.6") έχει αυτά τα πλάνα:
#   2.4-3.9   Porsche Macan πίσω όψη (καθαρό)
#   4.4-8.9   μαύρο coupe + φορτηγό (καθαρό)
#   8.9-11.2 παλιά Porsche Boxster  -> ΚΟΒΕΤΑΙ (ζήτημα πελάτη)
#   11.2-13.6  Ferrari F430 (καθαρό)
#
# Οι φωτογραφίες γίνονται «πλάνο»: ίδιο κάδρο, αργό push-in και ελαφρύ
# τρέμουλο χεριού, ίδιο encode. Έτσι δεν ξεχωρίζουν από το βίντεο.
set -e
cd "$(dirname "$0")"

SRC="_src-media/hero-mob.mp4"
STILLS="${STILLS:-assets/still-mclaren-1.jpg assets/still-mclaren-2.jpg}"
FPS=25
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

# --- desktop πάνελ (8:9 = ό,τι δείχνει το μισό μιας 16:9 οθόνης) ---
PW=810; PH=912
# --- κινητό ---
MW=720; MH=1280

# πάνελ A: το φορτηγό με το μαύρο coupe
A_START=4.7; A_LEN=4.2   # τελειώνει 8.9, στο 9.0 μπαίνει η Porsche
# πάνελ B: Ferrari (2.4") + φωτογραφία (1.8") = 4.2" -> ίδιο μήκος με το A,
# αλλιώς ξεφεύγει ο συγχρονισμός των δύο πάνελ
B_SEG_START=11.2; B_SEG_LEN=2.4
STILL_LEN=1.8
# κινητό: η πηγή από 2.5" (τα πρώτα 2.4" είναι θολό whip pan) χωρίς το 8.9-11.2,
# + φωτογραφία στο τέλος
M_START=2.5; M_CUT_START=8.9; M_CUT_END=11.2

ENC="-c:v libx264 -crf 23 -preset medium -profile:v high -pix_fmt yuv420p -r $FPS -g 50 -movflags +faststart -an"

if [ "$1" = "--scan" ]; then
  D="$TMP/scan"; mkdir -p "$D"; ffmpeg -v error -i "$SRC" -vf "fps=5,scale=270:-1" -q:v 4 "$D/f%04d.jpg"
  python3 - "$D" <<'PYX'
import sys, glob, numpy as np
from PIL import Image
vs=[]
for f in sorted(glob.glob(sys.argv[1]+'/*.jpg')):
    a=np.asarray(Image.open(f).convert('L'),dtype=np.float32)
    vs.append(float((np.abs(np.diff(a,axis=1)).mean()+np.abs(np.diff(a,axis=0)).mean())/2))
mx=max(vs)
for i,v in enumerate(vs):
    print(f"{i/5:6.1f} {v:8.1f}  {'█'*int(24*v/mx)}{'   <- ΘΟΛΟ' if v<0.45*mx else ''}")
PYX
  exit 0
fi

# κέντραρε και κόψε στην αναλογία W:H, όποια κι αν είναι η πηγή
cropf () { echo "crop=w='min(iw,ih*$1/$2)':h='min(ih,iw*$2/$1)':x='(iw-ow)/2':y='(ih-oh)/2',scale=$1:$2:flags=lanczos,fps=$FPS"; }

# κομμάτι βίντεο από την πηγή
seg () { # out start len W H
  # -ss ΜΕΤΑ το -i: με -ss πριν το -i, το fps filter έβγαζε ένα καρέ από το
  # προηγούμενο keyframe ως πρώτο καρέ (εμφανιζόταν η Porsche στην αφίσα)
  # -frames:v: ακριβές πλήθος καρέ, ώστε τα δύο πάνελ να έχουν ίδιο μήκος
  ffmpeg -y -v error -i "$SRC" -vf "trim=start=$2:duration=$3,setpts=PTS-STARTPTS,$(cropf "$4" "$5")" \
    -frames:v "$(python3 -c "print(round($3*$FPS))")" $ENC "$1"
}

# φωτογραφία ως πλάνο: cover-crop, αργό push-in 8%, ελαφρύ sway, ήπιο grade
# ώστε να «κάθεται» δίπλα σε βίντεο κινητού (λίγη αντίθεση, λίγος κόκκος).
still () { # out photo len W H
  W=$4; H=$5; N=$(python3 -c "print(int($3*$FPS))")
  ffmpeg -y -v error -loop 1 -t "$3" -i "$2" -vf "\
scale=w='if(gt(a,$W/$H),-2,$((W*2)))':h='if(gt(a,$W/$H),$((H*2)),-2)':flags=lanczos,\
crop=$((W*2)):$((H*2)),\
zoompan=z='1+0.08*on/$N':x='iw/2-iw/zoom/2+7*sin(on/9)':y='ih/2-ih/zoom/2+5*cos(on/12)':d=1:s=${W}x${H}:fps=$FPS,\
eq=contrast=1.04:saturation=1.03,noise=alls=3:allf=t,format=yuv420p" $ENC "$1"
}

poster () { # name
  ffmpeg -y -v error -i "assets/$1.mp4" -frames:v 1 "$TMP/p.png"
  cwebp -quiet -q 76 "$TMP/p.png" -o "assets/$1.webp"
}

join () { # out crf piece...
  out="$1"; crf="$2"; shift 2; : > "$TMP/list.txt"
  for p in "$@"; do echo "file '$p'" >> "$TMP/list.txt"; done
  # ξανακωδικοποίηση στην ένωση: τα κομμάτια έχουν διαφορετικό timebase (zoompan)
  ffmpeg -y -v error -f concat -safe 0 -i "$TMP/list.txt" -vf "fps=$FPS,format=yuv420p" $ENC -crf "$crf" "$out"
}

# ποιες φωτογραφίες υπάρχουν
HAVE=""; for s in $STILLS; do [ -f "$s" ] && HAVE="$HAVE $s"; done
if [ -z "$HAVE" ]; then
  echo "!! δεν βρέθηκαν φωτογραφίες ($STILLS) — το πάνελ B παίρνει το Macan αντί για φωτογραφία"
fi
FIRST=$(echo $HAVE | awk '{print $1}')

echo "πάνελ A"
seg "assets/hero-p-a.mp4" "$A_START" "$A_LEN" $PW $PH
poster hero-p-a

echo "πάνελ B"
seg "$TMP/b1.mp4" "$B_SEG_START" "$B_SEG_LEN" $PW $PH
if [ -n "$FIRST" ]; then still "$TMP/b2.mp4" "$FIRST" "$STILL_LEN" $PW $PH
else seg "$TMP/b2.mp4" 2.4 "$STILL_LEN" $PW $PH; fi
join "assets/hero-p-b.mp4" 23 "$TMP/b1.mp4" "$TMP/b2.mp4"
poster hero-p-b

echo "κινητό"
seg "$TMP/m1.mp4" "$M_START" "$(python3 -c "print($M_CUT_START-$M_START)")" $MW $MH
seg "$TMP/m2.mp4" "$M_CUT_END" 99 $MW $MH
PIECES="$TMP/m1.mp4 $TMP/m2.mp4"
i=0; for s in $HAVE; do i=$((i+1)); still "$TMP/ms$i.mp4" "$s" "$STILL_LEN" $MW $MH; PIECES="$PIECES $TMP/ms$i.mp4"; done
join "assets/hero-mob.mp4" 29 $PIECES   # κινητό: πιο σφιχτό, ~2 MB
poster hero-mob
cp "$TMP/p.png" "$TMP/mob.png"; sips -s format jpeg -s formatOptions 80 "$TMP/mob.png" --out assets/hero-mob.jpg >/dev/null 2>&1 || true

echo
for n in hero-p-a hero-p-b hero-mob; do
  printf "  %-14s %6.0f KB  %5.2f s\n" "$n.mp4" "$(wc -c < assets/$n.mp4 | awk '{print $1/1024}')" \
    "$(ffprobe -v error -show_entries format=duration -of csv=p=0 assets/$n.mp4)"
done
echo "Έλεγξε τις αφίσες στο assets/*.webp. Μετά: ./deploy.sh"
