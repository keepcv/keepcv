import { createContext, useContext } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { handoffAt, handoffHalf, handoffTail, panelFor } from "./handoffs.mjs";
import { easeBetween } from "./motion.mjs";

const Motion = createContext(null);

function panelOpacity(relative, entering, leaving, sameWindow) {
  if (entering) return easeBetween(relative, 0, sameWindow ? handoffTail : handoffHalf);
  if (leaving && !sameWindow) return 1 - easeBetween(relative, -handoffHalf, handoffTail);
  return 1;
}

export function HandoffObjects({ shot, previous, next, children }) {
  const frame = useCurrentFrame();
  const entering = previous && frame < handoffHalf;
  const leaving = next && frame >= shot.frames - handoffHalf;
  const adjacent = entering ? previous : next;
  const sameWindow = shot.kind === "ui" && adjacent?.kind === "ui";
  const relative = entering ? frame : frame - shot.frames;
  const pose = entering
    ? handoffAt(previous, shot, relative)
    : leaving
      ? handoffAt(shot, next, relative)
      : null;
  const strength = entering
    ? 1 - easeBetween(relative, 0, handoffHalf)
    : leaving
      ? easeBetween(relative, -handoffHalf, 0)
      : 0;
  const opacity = panelOpacity(relative, entering, leaving, sameWindow);
  return (
    <Motion.Provider
      value={
        pose && { anchor: panelFor(shot, entering), pose, strength, opacity, entering, relative }
      }
    >
      <AbsoluteFill style={{ isolation: "isolate" }}>{children}</AbsoluteFill>
    </Motion.Provider>
  );
}

export function useShotHeading() {
  const motion = useContext(Motion);
  return motion && !motion.entering && motion.relative >= 0 ? 0 : 1;
}

export function useObjectMotion() {
  const motion = useContext(Motion);
  return (style, primary = false, order = 0) => {
    if (!motion) return style;
    const { anchor, pose, strength, opacity, entering, relative } = motion;
    if (primary) {
      const [x, y, width, height] = anchor;
      const left = pose[0] - x + (x - (style.left ?? x)) * (1 - opacity);
      const top = pose[1] - y + (y - (style.top ?? y)) * (1 - opacity);
      return {
        ...style,
        opacity: (style.opacity ?? 1) * opacity,
        transformOrigin: "top left",
        transform: `translate(${left}px, ${top}px) scale(${pose[2] / width}, ${pose[3] / height})`,
      };
    }
    const delay = Math.min(order, 4);
    const visible = entering
      ? easeBetween(relative, 1 + delay, handoffHalf)
      : 1 - easeBetween(relative, -handoffHalf + delay, 2);
    const dx = pose[0] + pose[2] / 2 - (style.left ?? 960);
    const dy = pose[1] + pose[3] / 2 - (style.top ?? 540);
    const move = (1 - visible) * 0.32;
    return {
      ...style,
      opacity: (style.opacity ?? 1) * visible,
      transform: `translate(${dx * move}px, ${dy * move + Math.sin(strength * Math.PI) * (order % 2 ? -26 : 26)}px) scale(${1 - move * 0.55})`,
    };
  };
}

export function MotionObject({ style, primary = false, order = 0, children, ...props }) {
  const move = useObjectMotion();
  return (
    <div {...props} style={move(style, primary, order)}>
      {children}
    </div>
  );
}

export function SharedPanel({ shots }) {
  const frame = useCurrentFrame();
  const index = shots.findIndex((shot, i) => i > 0 && Math.abs(shot.from - frame) < handoffHalf);
  if (index < 0) return null;
  if (shots[index - 1].kind === "ui" && shots[index].kind === "ui") return null;
  const relative = frame - shots[index].from;
  const [x, y, width, height, radius] = handoffAt(shots[index - 1], shots[index], relative);
  const energy = 1 - easeBetween(Math.abs(relative), 3, handoffHalf);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          width,
          height,
          borderRadius: radius,
          boxSizing: "border-box",
          background: "linear-gradient(120deg, #fff, #f3e9ff)",
          border: "1px solid #c4a7e7",
          boxShadow: "0 20px 65px #39284b26",
          opacity: energy,
          overflow: "hidden",
        }}
      />
    </AbsoluteFill>
  );
}
