# KeepCV promotional videos

The approved [three-minute walkthrough](showcase/keepcv-3min.mp4) and
[90-second overview](showcase/keepcv-90s.mp4) live in `showcase/` for
repository visitors.

Two 3840x2160, 30 fps exports combine actual application recordings and custom graphics:

- `KeepCV90`: 90 seconds, focused on storing, reusing, composing and exporting.
- `KeepCV180`: three minutes, adding import, profile, record details, vocabulary,
  role profiles, job targeting and visual/HTML builders.

Both use fictional demo data. The real Assistant UI follows the store overview,
at about 9.6 seconds and 11.5 seconds respectively. Captures show the job URL
composer, Web search state, proposal and approval, and resulting resume editor.
The longer cut also shows accepting a tag and Point on an existing record.
The "Demo responses" label identifies the local fixture and sample posting.
An animated match summary connects the approval to the real editor.

`timeline.mjs` allocates exactly 40% UI-led screen time and 60% custom-graphics
screen time: 36/54 seconds in the short cut and 72/108 in the longer cut.
Graphics-only chapters use native shapes, text and branding, without app captures.

## Produce the videos

```sh
pnpm install
pnpm build
pnpm exec playwright install chromium
node videos/keepcv/server.mjs
```

Leave that demo server running. In a second terminal:

```sh
pnpm promo:capture
node videos/keepcv/score.mjs
pnpm promo:studio
```

Studio is at <http://localhost:4321>. To export both MP4 files:

```sh
pnpm promo:render
```

New MP4 files use the `-4k` suffix, with matching silent copies and SRT captions
in `.keepcv-promo/deliverables/`. Earlier 1080p exports are retained. Generated footage, audio,
branding copies and capture coordinates live in the ignored `public/` directory.
Capture creates before/after screenshots and page text in `.keepcv-promo/qa/`.
The Assistant shots use separately captured `assistantJob.mp4`,
`assistantReview.mp4`, `assistantResult.mp4` and `assistantManage.mp4` in
`public/clips/`. They were recorded at 2400x1350 with a local fixture adapter
running the actual proposal and approval endpoints against the demo store.
One-time capture utilities are kept in the ignored `.keepcv-promo/` folder.
Set `PROMO_RESUME=1` to retain completed shots while retrying a failed capture.
Start a new demo server for a fresh store; stop it with Ctrl+C when finished.

The launcher must be built first. The recorder uses its actual HTTP API and
browser application. Native drag events, clicks, navigation and file intake run
against that store. Layout motion, captions and custom illustrations are added in
Remotion; they are presentation effects, not claimed application behavior.

## Story and motion

The order follows content prerequisites: capture -> reusable wording and
vocabulary -> composition -> design -> export, history and backup. Import is
introduced early because it is an alternative way to fill the store.

`story.mjs` owns feature copy. `timeline.mjs` owns ordering and durations. `film.jsx` owns the
frame-based motion. Each shot keeps its recording and caption on one clock.
The scenes are generated from that table; edit the table to change scene content
and ordering. Studio exposes both compositions and individual shot sequences.

The logo and name are visible from frame zero against a purple background.
Opening and closing graphics take three seconds each. Most UI demonstrations take
3 seconds in the short cut and 3.6 seconds in the longer cut. Composition and
export interactions play at 1.6x to include hide/show and download within those
shots. The Assistant takes a few separate shots to follow the prompt, review
and result. Full recordings fit inside the 16:9 stage while interactions play.
The panels, documents and windows share one continuous layout across cuts.
The primary object travels from its outgoing bounds into the incoming layout
over 24 frames. Secondary objects gather and unfold on staggered paths. A
persistent purple stage anchors the movement and the headings stay readable
above the moving objects. The full app viewport settles before each demo.

`graphics.jsx` and `patterns.jsx` add card stacks, grid unfolding, import review,
profile assembly, context tabs, filtering, search typing, role emphasis bars,
selection transfers, cursor-led sorting, metric counters, design morphs, source
reveals, page compression, a format fan, a version timeline, archive assembly
and the labeled AI match summary. The short cut has 13 custom feature chapters.
The longer cut has 21. Each adds a specific action or explanation.
These chapters keep an action or comparison moving through their duration.
The composition uses a 1920x1080 logical stage and Remotion's `--scale=2` output
for 4K rasterization of text and vector graphics. The UI captures are scaled
into that output from 1600x900 and 2400x1350 sources.

The soundtrack is an original deterministic electronic-pop instrumental generated
by `score.mjs`, with a repeating melodic synth hook, warm bass, layered claps,
detuned pads, a harmonic arpeggio and stereo delay at 140 BPM. A four-on-the-floor
kick, offbeat open hats, sixteenth-note hats and short drum fills keep the groove
upbeat from the opening. `audio-cues.mjs` derives separate cue sheets for both
cuts from the same shot timeline. `soundtrack.mjs` mixes short page swishes,
card pops, typing ticks, clicks and confirmation tones with a little music
ducking around each sound. UI cues account for source in-points and playback
speed; graphic cues use the same normalized action clock as their animation.
`finalize-audio.mjs` stream-copies the rendered video while replacing its audio,
so a soundtrack revision preserves the reviewed frames. It contains
no downloaded recordings and needs no third-party music attribution. There is
no voiceover. Rendering also writes lossless video copies without music, named
`*-silent.mp4`. An additional `*-effects-only.mp4` keeps action sounds without
background music. The composition's `music` prop disables the complete music and
effects mix in Studio. Generated mixes are `public/audio/mix-short.wav` and
`mix-long.wav`; cue sheets are in `.keepcv-promo/qa/audio-cues-*.json`.

`pnpm test:promo` checks viewport bounds, exact runtime, continuous shot boundaries
and the 40/60 timing allocation in both cuts.

## Research applied

- [Official Remotion skill](https://github.com/remotion-dev/skills/blob/main/skills/remotion-best-practices/SKILL.md):
  frame-driven animation, shared timing boundaries, local assets and visual QA.
- [Remotion video creation](https://github.com/remotion-dev/skills/blob/main/skills/remotion-best-practices/remotion-create/REFERENCE.md):
  Studio preview, video-first layouts and independently inspectable scenes.
- [Video Shotcraft](https://github.com/Vincentwei1021/video-shotcraft/blob/main/SKILL.md)
  and its production pipeline: real UI footage, product-derived visual tokens,
  prerequisite-aware storyboarding, readable holds and independent review.
- [Screen Studio zoom guidance](https://screen.studio/guide/adding-editing-zooms)
  and [cursor guidance](https://screen.studio/guide/cursor): focus follows the
  interaction, with a controlled return to the full application context.
- [Shared view transitions](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API):
  retain a persistent frame and transition related views within it. The film
  implements that visual principle with deterministic Remotion masks.
- [Remotion slide presentations](https://www.remotion.dev/docs/transitions/presentations/slide)
  and [wipe presentations](https://www.remotion.dev/docs/transitions/presentations/wipe):
  short directional transitions with the outgoing scene still present underneath.
- [Motion layout patterns](https://motion.dev/docs/react-layout-animations):
  grid unfolding, shared card movement and list reordering, adapted to deterministic
  frame-based transforms so seeking and rendering always produce the same state.

These are technique references, not copied templates. Adaptations for this
project are moving recordings in place of still page textures, original music
in place of stock sound effects, and a shared source timeline for both cuts.
No Gallery shot-card reproduction or third-party template fidelity is claimed.

The opening uses a connected career-store diagram, entering career cards,
staggered Point tiles, an illustrated resume, orbital paths and a dot-grid
background. The logo and name are visible throughout the opening.
