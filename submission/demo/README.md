# TeamPay narrated product walkthrough

Approximately 69 seconds, 1440×900, H.264/AAC MP4. Recorded from the public TeamPay UI in an isolated headless Chrome profile. No wallet extension was loaded, and no transactions were signed or submitted. Example interaction and draft editing are labelled separately from the completed mainnet test. Narration uses the local macOS Samantha synthetic English voice at rate 170, normalized during encoding. No external music or voice impersonation is used.

## Deliverables

- `/demo`: video player, chapter links, product actions, transcript, downloadable MP4, and withdrawal evidence.
- `dist/demo/teampay-demo.mp4`: downloadable video with narration and burned-in English captions.
- `dist/demo/captions.vtt`: optional English caption track. Cue timings approximate sentence boundaries using speech duration; captions are also visible in the picture.
- `scenes.json`: source narration and measured durations.

The video itself is a conventional MP4. Clickable chapters and product links work on the web page, not inside a downloaded MP4.

## Production

`record.mjs` connects to isolated Chrome on port 9227 using an existing `ws` module supplied through `WS_MODULE`. It captures real UI states at eight frames per second, including clicking the example payment presets and scrolling. Encoding repeats frames at 24fps. It never clicks publish, pay, withdraw, or wallet controls.

Audio is generated per scene with `say -v Samantha -r 170 --file-format=WAVE --data-format=LEI16@24000 -o /tmp/teampay-video/voice-N.wav TEXT`. `render.py` reads those files, pads each segment to its scene duration, and encodes the video using `imageio-ffmpeg` from an isolated Python environment. Intermediate frames and audio live in `/tmp/teampay-video`, not the repository.

Example draft names in the video are fictional; the two pre-existing builder wallet addresses are used only to preview the form. Mainnet evidence is the already completed project 2, not a transaction performed during recording.

## Validation

- Encoded duration: 68.625 seconds; MP4 size: 2,257,528 bytes.
- H.264 video at 1440×900/24fps and AAC mono narration at 48kHz.
- Complete file decoded without errors. Measured mean audio level -15.7 dB, peak -1.4 dB.
- Public page, MP4, and VTT return HTTP 200 with correct content types.
- Chrome checks at 390px and 1440px found six chapters and no horizontal overflow. Clicking the mainnet chapter started playback, advanced beyond the seek position, selected the chapter, and updated the shareable URL. See `browser-checks.json`.
- Representative footage frames and the public player layout were visually inspected. Narration is locally synthesized; no human voice-performance review is claimed.
- Existing 46 product tests still pass.
