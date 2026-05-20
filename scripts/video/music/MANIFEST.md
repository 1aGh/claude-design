# Music — committed CC0 / Pixabay-License / FMA-CC0 instrumentals

> Track files live next to this manifest. **Every track MUST have a license
> URL recorded here.** Tracks without a license entry are removed by the
> phase 15.5 acceptance gate.

## Why committed, not API-fetched

- Pixabay has no music API (REST API covers images + videos only).
- Freesound API has license filters but no BPM tag on music.
- For a solo OSS maintainer shipping ~10 videos/year, curating 6-10 tracks
  once beats searching automatedly each cut.

## Curation criteria

| Trait | Target |
| ----- | ------ |
| Duration | 60-120s (long enough for Cut A primary, croppable for Cut B 30s) |
| BPM | 80-110 (under-the-voice, doesn't fight the captions) |
| Mood | corporate ambient / tech inspiration / minimal piano / lofi minimal |
| Format | mp3 at 192 kbps or less (file-size budget per track ~4-6 MB) |
| License | CC0 / Pixabay Content License / FMA-CC0 (no attribution required) |

## Filename convention

`<short-slug>-<bpm>bpm-<source>.mp3`

Examples (placeholders — replace with real downloads):
- `quiet-progress-92bpm-pixabay.mp3`
- `morning-print-shop-88bpm-fma.mp3`
- `industrial-calm-104bpm-mixkit.mp3`

## Tracks

| Filename | Source URL | License | BPM | Duration | Mood tags | Best for scene |
| -------- | ---------- | ------- | --- | -------- | --------- | -------------- |
| _none yet_ | — | — | — | — | — | — |

## How to add a track

1. Find a track matching the curation criteria. Suggested sources:
   - Pixabay Music: https://pixabay.com/music/
   - Mixkit: https://mixkit.co/free-stock-music/
   - Free Music Archive: https://freemusicarchive.org/
2. Download the MP3. Rename to the convention above.
3. Move into `scripts/video/music/`.
4. Append a row to the table. **Every column must be filled.**
5. Confirm the file size is under 6 MB. If not, transcode:
   ```sh
   ffmpeg -i input.mp3 -b:a 192k -ar 44100 output.mp3
   ```
6. `git add scripts/video/music/<file>.mp3 scripts/video/music/MANIFEST.md`.

## Removal

A track gets removed if any of:
- License URL no longer resolves (HTTP 404 / 403).
- File size grows past 8 MB.
- A scene's storyboard entry no longer references it AND no other future
  scene is queued to use it.

## License URL validity check (run before commit)

```sh
grep -oE 'https://[^ |]+' scripts/video/music/MANIFEST.md \
  | xargs -I{} sh -c 'curl -sI "{}" -o /dev/null -w "%{http_code} {}\n"' \
  | grep -v '^200'
```

Empty output = all URLs alive.
