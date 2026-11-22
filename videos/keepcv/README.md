# KeepCV promotional videos

The [three-minute walkthrough](showcase/keepcv-3min.mp4) and
[90-second overview](showcase/keepcv-90s.mp4) live in `showcase/` for
repository visitors.

Two 2560x1440, 30 fps exports combine actual application recordings and custom graphics:

- `KeepCV90` follows a career record into a draft, uses Assistant to tailor it
  to a job, compares Classic, Compact and Editorial, then applies Classic and
  uses Export PDF to preserve the design.
- `KeepCV180` follows the same workflow and adds import, alternate phrasing,
  evidence, filters, role profiles, reordering, job targeting, the Studio
  template, design adjustments and version history.

Both use fictional demo data. After building a draft, the real Assistant UI
shows a job URL, Web search and a proposal for a tailored resume using the saved
work. The flow continues through approval and the resulting resume editor.
The longer cut also shows accepting a tag and Point on
an existing record. The "Demo responses" label identifies the scripted responses
and sample posting. The template chooser previews the same tailored content in
each layout before returning to the editor with Classic applied.

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

Leave that demo server running. In a second terminal, capture the baseline footage:

```sh
pnpm promo:capture
```

Rendering both cuts also requires separately recorded `assistantJob.mp4`,
`assistantReview.mp4`, `assistantResult.mp4`, `assistantManage.mp4`,
`journeyRecord.mp4`, `journeyTemplates.mp4`, `journeyApply.mp4` and
`journeyExport.mp4` in `public/clips/`. The Assistant recordings use a local
fixture adapter with the real proposal and approval endpoints. The journey
recordings use Alex's record and tailored resume in the same demo store.
These source recordings are 2400x1350.

```sh
node videos/keepcv/score.mjs
pnpm promo:studio
```

Studio is at <http://localhost:4321>. To export both MP4 files:

```sh
pnpm promo:render
```

New MP4 files use the `-2k` suffix, with matching silent and effects-only copies
and SRT captions in `.keepcv-promo/deliverables/`. Generated footage, audio,
branding copies and capture coordinates live in the ignored `public/` directory.
Capture creates before/after screenshots and page text in `.keepcv-promo/qa/`.
One-time capture utilities are kept in the ignored `.keepcv-promo/` folder.
Set `PROMO_RESUME=1` to retain completed shots while retrying a failed capture.
Start a new demo server for a fresh store; stop it with Ctrl+C when finished.

The launcher must be built first. The recorder uses its actual HTTP API and
browser application. Native drag events, clicks, navigation and file intake run
against that store. Layout motion, captions and custom illustrations are added in
Remotion; they are presentation effects, not claimed application behavior.

## Story and motion

Both cuts follow one resume from the profile and career store through selection,
Assistant tailoring, design and export. Import appears alongside profile and
career records in the extended cut, with version history after export.

`story.mjs` owns feature copy. `timeline.mjs` owns ordering and durations. `film.jsx` owns the
frame-based motion. Each shot keeps its recording and caption on one clock.
The scenes are generated from that table; edit the table to change scene content
and ordering. Studio exposes both compositions and individual shot sequences.

The logo and name are visible from frame zero against a purple background.
Both open with four seconds of KeepCV branding and end with the finished
resume and a branded closing. The Assistant has separate shots for the prompt,
review and result. Review, applying a template and export leave time to see the
outcome after the action. Full recordings fit inside the 16:9 stage.
The panels, documents and windows share one continuous layout across cuts.
The primary object travels from its outgoing bounds into the incoming layout
over 24 frames. Secondary objects gather and unfold on staggered paths. A
persistent purple stage anchors the movement and the headings stay readable
above the moving objects. The full app viewport settles before each demo.

`graphics.jsx`, `patterns.jsx` and `journey.jsx` animate the career-to-resume
steps, alternate wording, selection transfers, cursor-led sorting, role
emphasis bars, a labeled Assistant match summary, template comparisons and
version history. Remotion scales the 1920x1080 logical stage to 2560x1440 at
30 fps, with UI recordings from 1600x900 and 2400x1350 sources.

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

`pnpm test:promo` checks viewport bounds, exact runtime, continuous shot boundaries,
the 40/60 timing allocation and the resume-building order in both cuts.

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
