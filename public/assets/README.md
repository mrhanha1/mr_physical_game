# Color Wheel VR/AR — Asset Placeholders

Place real audio files here:

| File | Description |
|------|-------------|
| `correct.mp3` | Short chime/ding played at slot position when color matches (0.5–1s) |
| `fail.mp3`    | Short buzz/thud played at controller when wrong color dropped (0.3–0.5s) |
| `ambient.mp3` | Relaxing loop played quietly at scene center throughout gameplay (loopable) |

## Recommended Free Sources
- https://freesound.org (CC0 license)
- https://zapsplat.com
- https://opengameart.org

## Quick generation (if you have ffmpeg)
```bash
# 440Hz sine tone (correct)
ffmpeg -f lavfi -i "sine=frequency=880:duration=0.6" -ar 44100 correct.mp3

# Low buzz (fail)
ffmpeg -f lavfi -i "sine=frequency=110:duration=0.4" -ar 44100 fail.mp3

# Ambient pad (loop)
ffmpeg -f lavfi -i "aevalsrc=sin(330*t)*0.3+sin(440*t)*0.2:s=44100:d=30" ambient.mp3
```

The AudioManager gracefully handles missing files — the game still works without audio.
