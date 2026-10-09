#!/bin/sh
# Φτιάχνει τα βίντεο του hero από τα βίντεο-πηγές.
#
#   ./make-hero.sh            # με τις τρέχουσες ρυθμίσεις
#   ./make-hero.sh --scan ΑΡΧΕΙΟ   # οξύτητα ανά 0.2" για να διαλέξεις καθαρά σημεία
#
# Βγάζει: assets/hero-p-a.mp4  δεξί πάνελ desktop (παίζει πρώτο)
#         assets/hero-p-b.mp4  αριστερό πάνελ desktop
#         assets/hero-mob.mp4  κινητό (κάθετο, ολόκληρο)
#         + .webp αφίσες (πρώτο καρέ κάθε κλιπ)
#
# Πηγές (_src-media/, δεν ανεβαίνουν στο deploy):
#   hero-mob.mp4 (13.6", μέρα)
#     2.4-3.9    Porsche Macan πίσω όψη (καθαρό)
#     4.4-8.9    μαύρο coupe + φορτηγό (καθαρό)
#     9.0-11.2   παλιά Porsche Boxster  -> ΚΟΒΕΤΑΙ (ζήτημα πελάτη)
#     11.2-13.6  Ferrari F430 (καθαρό)
#   mclaren-garage.mov (3.0", νύχτα, φωτισμένο γκαράζ, το πιο καθαρό)
#   mclaren-rear.mov   (1.6", νύχτα, πίσω φώτα)
#   mclaren-rear2.mov  (1.1", νύχτα, πίσω 3/4, σκοτεινό)
#   mclaren-street.mov (2.5", νύχτα, πίσω όψη κάτω από φανάρι, φωτεινό)
#
# Τα δύο πάνελ του desktop ΠΡΕΠΕΙ να έχουν ίδιο πλήθος καρέ (105 = 4.2"),
# αλλιώς ξεφεύγει ο συγχρονισμός και η εναλλαγή πλευρών.
set -e
cd "$(dirname "$0")"

DAY="_src-media/hero-mob.mp4"
MCL="_src-media/mclaren-garage.mov"
MCL2="_src-media/mclaren-rear.mov"
MCL3="_src-media/mclaren-street.mov"
FPS=25
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

# desktop πάνελ (8:9 = το μισό μιας 16:9 οθόνης) / κινητό
PW=810; PH=912
MW=720; MH=1280

ENC="-c:v libx264 -crf 23 -preset medium -profile:v high -pix_fmt yuv420p -r $FPS -g 50 -movflags +faststart -an"

if [ "$1" = "--scan" ]; then
  D="$TMP/scan"; mkdir -p "$D"; ffmpeg -v error -i "${2:?δώσε βίντεο}" -vf "fps=5,scale=270:-1" -q:v 4 "$D/f%04d.jpg"
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

# κέντραρε και κόψε στην αναλογία W:H, όποια κι αν είναι η πηγή (το ffmpeg
# γυρίζει μόνο του τα κάθετα .mov του iPhone)
cropf () { echo "crop=w='min(iw,ih*$1/$2)':h='min(ih,iw*$2/$1)':x='(iw-ow)/2':y='(ih-oh)/2',scale=$1:$2:flags=lanczos,fps=$FPS"; }

# κομμάτι από πηγή: out src start len W H [grade] [slow]
# trim στο filter (όχι -ss): αλλιώς έμπαινε ένα καρέ από το προηγούμενο
# keyframe ως πρώτο καρέ. -frames:v για ακριβές πλήθος καρέ.
# slow (π.χ. 1.2): ήπιο slow-motion για να «κρατάει» ένα κοντό πλάνο· ως 1.25
# η πηγή (30fps) δίνει ακόμα ~24 μοναδικά καρέ/δευτ., δεν τραβάει.
seg () {
  slow="${8:-1}"
  ffmpeg -y -v error -i "$2" -vf "trim=start=$3:duration=$4,setpts=(PTS-STARTPTS)*$slow,$(cropf "$5" "$6")${7:+,$7}" \
    -frames:v "$(python3 -c "print(round($4*$slow*$FPS))")" $ENC "$1"
}

# νυχτερινά κλιπ: λίγο σήκωμα σκιών + αντίθεση για να κάθονται δίπλα στη μέρα
NIGHT="eq=brightness=0.03:contrast=1.06:saturation=1.08"

poster () {
  ffmpeg -y -v error -i "assets/$1.mp4" -frames:v 1 "$TMP/p.png"
  # q50 -m 6: δίπλα-δίπλα με το lossless καρέ δεν ξεχωρίζει, ~25% λιγότερα bytes από q76
  cwebp -quiet -q 50 -m 6 "$TMP/p.png" -o "assets/$1.webp"
}

join () { # out crf piece...
  out="$1"; crf="$2"; shift 2; : > "$TMP/list.txt"
  for p in "$@"; do echo "file '$p'" >> "$TMP/list.txt"; done
  ffmpeg -y -v error -f concat -safe 0 -i "$TMP/list.txt" -vf "fps=$FPS,format=yuv420p" $ENC -crf "$crf" "$out"
}

echo "πάνελ A: φορτηγό + coupe (4.7-8.9)"
seg "assets/hero-p-a.mp4" "$DAY" 4.7 4.2 $PW $PH
poster hero-p-a

echo "πάνελ B: Ferrari (1.8\") + McLaren γκαράζ (2.4\")"
seg "$TMP/b1.mp4" "$DAY" 11.8 1.8 $PW $PH
seg "$TMP/b2.mp4" "$MCL" 0.3 2.4 $PW $PH "$NIGHT"
join "assets/hero-p-b.mp4" 23 "$TMP/b1.mp4" "$TMP/b2.mp4"
poster hero-p-b

echo "κινητό: μέρα (χωρίς Porsche) + McLaren γκαράζ + πίσω φώτα"
seg "$TMP/m1.mp4" "$DAY" 2.5 6.4 $MW $MH
seg "$TMP/m2.mp4" "$DAY" 11.2 2.4 $MW $MH
seg "$TMP/m3.mp4" "$MCL" 0.2 2.6 $MW $MH "$NIGHT"
seg "$TMP/m4.mp4" "$MCL3" 0 2.5 $MW $MH "$NIGHT" 1.2
join "assets/hero-mob.mp4" 31 "$TMP/m1.mp4" "$TMP/m2.mp4" "$TMP/m3.mp4" "$TMP/m4.mp4"
poster hero-mob
sips -s format jpeg -s formatOptions 80 "$TMP/p.png" --out assets/hero-mob.jpg >/dev/null 2>&1 || true

echo "desktop μοντάζ: 4 ανεξάρτητα κλιπ, όλα >= 3\" (κάθε πάνελ κυλάει τα δικά του με crossfade)"
# ξεκινά στο 4.7: ως το 4.6 η πηγή δείχνει ακόμα το SUV του προηγούμενου πλάνου,
# και το πρώτο καρέ γίνεται η αφίσα που φαίνεται πριν παίξει το βίντεο
seg "assets/hero-d-truck.mp4"      "$DAY"  4.7  4.2  $PW $PH ""       1      # coupe -> jetski pan, ολόκληρο
seg "assets/hero-d-ferrari.mp4"    "$DAY"  11.2 2.4  $PW $PH ""       1.25   # 3.0"
seg "assets/hero-d-mcl-garage.mp4" "$MCL"  0.05 2.9  $PW $PH "$NIGHT" 1.15   # 3.3"
seg "assets/hero-d-mcl-rear.mp4"   "$MCL3" 0    2.5  $PW $PH "$NIGHT" 1.2    # 3.0", πίσω όψη στον δρόμο
poster hero-d-truck
poster hero-d-ferrari

echo
for n in hero-p-a hero-p-b hero-mob hero-d-truck hero-d-ferrari hero-d-mcl-garage hero-d-mcl-rear; do
  printf "  %-14s %6.0f KB  %5.2f s  %s καρέ\n" "$n.mp4" "$(wc -c < assets/$n.mp4 | awk '{print $1/1024}')" \
    "$(ffprobe -v error -show_entries format=duration -of csv=p=0 assets/$n.mp4)" \
    "$(ffprobe -v error -select_streams v:0 -count_frames -show_entries stream=nb_read_frames -of csv=p=0 assets/$n.mp4)"
done
echo "Έλεγξε τις αφίσες στο assets/*.webp. Μετά: ./deploy.sh"
