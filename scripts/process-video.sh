#!/bin/bash
# process-video.sh - Generate thumbnail and preview GIF for a video
# Usage: ./process-video.sh input.mp4
# Output: input-thumb.jpg, input-preview.gif (same directory as input)
#
# Thumbnail: First frame of video, 300px long side
# Preview GIF: First 10 frames of first second, 300px long side

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <video.mp4>"
  exit 1
fi

INPUT="$1"
if [ ! -f "$INPUT" ]; then
  echo "Error: File not found: $INPUT"
  exit 1
fi

# Get directory and base name
DIR=$(dirname "$INPUT")
BASENAME=$(basename "$INPUT" .mp4)
THUMB="$DIR/${BASENAME}-thumb.jpg"
PREVIEW="$DIR/${BASENAME}-preview.gif"
PALETTE="/tmp/palette-$$.png"

echo "Processing: $INPUT"

# Thumbnail: first frame, 300px long side
echo "  Extracting thumbnail (first frame, 300px)..."
ffmpeg -y -i "$INPUT" -vframes 1 -vf "scale='if(gte(iw,ih),300,-1)':'if(lt(iw,ih),300,-1)'" -q:v 2 "$THUMB" 2>/dev/null

# Preview GIF: first 10 frames at 10fps (1 second), 300px long side
echo "  Generating preview GIF (10 frames, 300px)..."

# Two-pass for optimal palette
ffmpeg -y -t 1 -i "$INPUT" \
  -vf "fps=10,scale='if(gte(iw,ih),300,-1)':'if(lt(iw,ih),300,-1)':flags=lanczos,palettegen=stats_mode=diff" \
  "$PALETTE" 2>/dev/null

ffmpeg -y -t 1 -i "$INPUT" -i "$PALETTE" \
  -filter_complex "fps=10,scale='if(gte(iw,ih),300,-1)':'if(lt(iw,ih),300,-1)':flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5" \
  "$PREVIEW" 2>/dev/null

# Cleanup
rm -f "$PALETTE"

# Report sizes
THUMB_SIZE=$(ls -lh "$THUMB" | awk '{print $5}')
PREVIEW_SIZE=$(ls -lh "$PREVIEW" | awk '{print $5}')
echo "  Done: $THUMB ($THUMB_SIZE), $PREVIEW ($PREVIEW_SIZE)"
