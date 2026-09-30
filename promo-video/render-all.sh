#!/bin/bash
set -e

mkdir -p out

FLOWS=(
  "SellFlow-Vertical"
  "BuyFlow-Vertical"
  "EventFlow-Vertical"
  "PostUpdateFlow-Vertical"
  "OnboardingFlow-Vertical"
)

for FLOW in "${FLOWS[@]}"; do
  OUT_MP4="out/${FLOW}.mp4"
  FRAMES_DIR="out/${FLOW}-frames"

  if [ -f "$OUT_MP4" ]; then
    echo "========================================"
    echo "Skipping $FLOW (already generated: $OUT_MP4)"
    echo "========================================"
    continue
  fi

  echo "========================================"
  echo "Rendering $FLOW..."
  echo "========================================"
  
  if [ ! -d "$FRAMES_DIR" ]; then
    npx remotion render "$FLOW" "$FRAMES_DIR" --sequence --concurrency=4
  fi
  
  NUM_FILES=$(ls -1 "${FRAMES_DIR}"/element-*.png 2>/dev/null | wc -l | tr -d ' ')
  PADDING=3
  if [ "$NUM_FILES" -ge 1000 ]; then
    PADDING=4
  fi

  echo "Stitching $OUT_MP4 ($NUM_FILES frames, padding %0${PADDING}d)..."
  /tmp/ffmpeg -y -framerate 30 -i "${FRAMES_DIR}/element-%0${PADDING}d.png" -c:v libx264 -pix_fmt yuv420p -crf 18 "$OUT_MP4"
  
  rm -rf "$FRAMES_DIR"
  echo "Done: $OUT_MP4"
done

echo "========================================"
echo "ALL FLOWS RENDERED SUCCESSFULLY!"
echo "========================================"
ls -lh out/*.mp4
