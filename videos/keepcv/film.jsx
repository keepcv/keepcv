import { Audio, Video } from "@remotion/media";
import {
  AbsoluteFill,
  Easing,
  Img,
  Interactive,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { GraphicScene } from "./graphics.jsx";
import { HandoffObjects, SharedPanel, useObjectMotion, useShotHeading } from "./handoff.jsx";
import { handoffTail } from "./handoffs.mjs";
import { SOURCE_HEIGHT, SOURCE_WIDTH, stageAt } from "./motion.mjs";
import { Opening } from "./opening.jsx";
import { assistantScenes, scenes } from "./story.mjs";
import { timeline } from "./timeline.mjs";

const ease = {
  easing: Easing.bezier(0.22, 1, 0.36, 1),
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
};
const purple = "#7638df";
function Backdrop() {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        background: "#d9c3f2",
        backgroundImage:
          "radial-gradient(ellipse at 85% 10%, #b88ce8 0%, transparent 58%), radial-gradient(ellipse at 10% 100%, #cba5f0 0%, transparent 50%), radial-gradient(#8b59c630 1px, transparent 1px)",
        backgroundSize: "auto, auto, 42px 42px",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 1000,
          height: 1000,
          border: "1px solid #7638df14",
          borderRadius: "50%",
          right: -330,
          top: -450,
          scale: interpolate(f, [0, 5400], [1, 1.2]),
        }}
      />
    </AbsoluteFill>
  );
}
function Brand() {
  const frame = useCurrentFrame() * 1.8;
  const { fps } = useVideoConfig();
  const move = useObjectMotion();
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", gap: 36 }}>
      <Interactive.Div
        name="Brand mark"
        style={move(
          {
            translate: `0px ${interpolate(frame, [0, fps], [50, 0], ease)}px`,
            opacity: 1,
            scale: interpolate(frame, [0, fps * 1.3], [0.87, 1], ease),
          },
          true,
        )}
      >
        <Img src={staticFile("logo-light.svg")} style={{ width: 590 }} />
      </Interactive.Div>
      <Interactive.H1
        name="Brand promise"
        style={{
          margin: 0,
          fontSize: 86,
          letterSpacing: -4,
          fontWeight: 650,
          textAlign: "center",
          opacity: interpolate(frame, [fps * 0.7, fps * 1.4], [0, 1], ease),
          translate: `0px ${interpolate(frame, [fps * 0.7, fps * 1.4], [28, 0], ease)}px`,
        }}
      >
        Write it once. Never lose it.
      </Interactive.H1>
      <Interactive.Div
        name="Brand supporting copy"
        style={{
          fontSize: 34,
          color: "#625c68",
          opacity: interpolate(frame, [fps * 1.4, fps * 2], [0, 1], ease),
        }}
      >
        Open source. Run it locally. Keep your whole story.
      </Interactive.Div>
      <Interactive.Div
        name="Call to action"
        style={{
          marginTop: 20,
          padding: "20px 34px",
          background: purple,
          color: "white",
          borderRadius: 16,
          fontSize: 34,
          opacity: interpolate(frame, [fps * 2, fps * 2.7], [0, 1], ease),
        }}
      >
        github.com/keepcv/keepcv
      </Interactive.Div>
    </AbsoluteFill>
  );
}
function Footage({ name }) {
  const [title, sub, chapter] = scenes[name];
  const stage = stageAt();
  const move = useObjectMotion();
  const heading = useShotHeading();
  const assistant = Object.hasOwn(assistantScenes, name);
  const viewport = (
    <Video
      name={`${name} - real UI recording`}
      src={staticFile(`clips/${name}.${assistant ? "mp4" : "webm"}`)}
      trimBefore={assistant ? 0 : name === "export" ? 65 : 50}
      muted
      playbackRate={
        name === "assistantResult" ? 0.9 : name === "compose" || name === "export" ? 1.6 : 1
      }
      style={{ width: SOURCE_WIDTH, height: SOURCE_HEIGHT, display: "block" }}
    />
  );
  return (
    <AbsoluteFill>
      <Interactive.Div
        name="Chapter"
        style={{
          position: "absolute",
          left: 100,
          top: 47,
          fontSize: 24,
          letterSpacing: 3,
          fontWeight: 650,
          color: purple,
          opacity: heading,
        }}
      >
        {chapter}
      </Interactive.Div>
      <Interactive.H1
        name="Feature title"
        style={{
          position: "absolute",
          left: 100,
          top: 83,
          margin: 0,
          fontSize: 62,
          fontWeight: 650,
          letterSpacing: -2.2,
          opacity: heading,
        }}
      >
        {title}
      </Interactive.H1>
      <Interactive.Div
        name="Feature caption"
        style={{
          position: "absolute",
          left: 103,
          top: 169,
          fontSize: 30,
          color: "#615a65",
          maxWidth: 1730,
          opacity: heading,
        }}
      >
        {sub}
      </Interactive.Div>
      <div
        style={move(
          {
            position: "absolute",
            left: stage.left,
            top: stage.top,
            width: SOURCE_WIDTH * stage.scale,
            height: SOURCE_HEIGHT * stage.scale,
            background: "white",
            borderRadius: 17,
            overflow: "hidden",
            boxShadow: "0 20px 65px #39284b26, 0 0 0 1px #39284b20",
          },
          true,
        )}
      >
        <div style={{ scale: stage.scale, transformOrigin: "top left" }}>{viewport}</div>
      </div>
    </AbsoluteFill>
  );
}
function Music({ cut }) {
  return <Audio src={staticFile(`audio/mix-${cut}.wav`)} volume={1} />;
}
export function Film({ cut = "short", music = true }) {
  const shots = timeline(cut);
  const seconds = cut === "long" ? 180 : 90;
  return (
    <AbsoluteFill
      style={{
        fontFamily: '"Segoe UI", Arial, sans-serif',
        color: "#241e29",
        whiteSpace: "pre-line",
      }}
    >
      <Backdrop />
      <SharedPanel shots={shots} />
      {shots.map((shot, index) => {
        const content =
          shot.kind === "ui" ? (
            <Footage name={shot.name} />
          ) : shot.topic === "opening" ? (
            <Opening />
          ) : shot.topic === "closing" ? (
            <Brand />
          ) : (
            <GraphicScene topic={shot.topic} frames={shot.frames} />
          );
        return (
          <Sequence
            key={index}
            name={shot.kind === "ui" ? scenes[shot.name][0] : `Motion graphic - ${shot.topic}`}
            from={shot.from}
            durationInFrames={shot.frames + (index < shots.length - 1 ? handoffTail : 0)}
          >
            <HandoffObjects shot={shot} previous={shots[index - 1]} next={shots[index + 1]}>
              {content}
            </HandoffObjects>
          </Sequence>
        );
      })}
      {music ? <Music cut={cut} /> : null}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "100%",
          height: 4,
          background: "#7638df12",
        }}
      >
        <Progress seconds={seconds} />
      </div>
    </AbsoluteFill>
  );
}
function Progress({ seconds }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ width: `${(frame / fps / seconds) * 100}%`, height: 4, background: purple }} />
  );
}
