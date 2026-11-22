import { MotionObject, useShotHeading } from "./handoff.jsx";
import { easeBetween } from "./motion.mjs";

const purple = "#7638df";
const muted = "#5f4879";
const panel = {
  position: "absolute",
  top: 322,
  height: 485,
  boxSizing: "border-box",
  border: "1px solid #c8ace9",
  borderRadius: 24,
  background: "#fff",
  boxShadow: "0 20px 55px #43246625",
  padding: 34,
};

function ReviewRow({ state, title, detail, progress }) {
  return (
    <div
      style={{
        marginTop: 13,
        padding: "11px 19px",
        border: "1px solid #e7d6f7",
        borderRadius: 13,
        background: "#faf6ff",
        opacity: progress,
        transform: `translateY(${15 * (1 - progress)}px)`,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          fontSize: 25,
          fontWeight: 650,
        }}
      >
        <span>{title}</span>
        <span style={{ color: purple, fontSize: 18, whiteSpace: "nowrap" }}>{state}</span>
      </div>
      <div style={{ marginTop: 5, color: muted, fontSize: 21 }}>{detail}</div>
    </div>
  );
}

function Status({ children }) {
  return (
    <div
      style={{
        padding: "11px 18px",
        width: "fit-content",
        marginTop: 22,
        borderRadius: 10,
        background: "#e3d3f7",
        color: "#462379",
        fontSize: 20,
        fontWeight: 650,
      }}
    >
      {children}
    </div>
  );
}

function Curate({ f }) {
  return (
    <>
      <MotionObject order={2} style={{ ...panel, left: 190, width: 695 }}>
        <div style={{ fontSize: 32, fontWeight: 650 }}>How the posting maps to your work</div>
        {["Release automation", "TypeScript services", "Platform leadership"].map((label, i) => (
          <div key={label} style={{ marginTop: 32, fontSize: 26 }}>
            {label}
            <div style={{ marginTop: 9, height: 9, borderRadius: 8, background: "#eee0fa" }}>
              <div
                style={{
                  width: `${100 * easeBetween(f, 10 + i * 10, 35 + i * 10)}%`,
                  height: "100%",
                  borderRadius: 8,
                  background: "linear-gradient(90deg, #7136d8, #b283fc)",
                }}
              />
            </div>
          </div>
        ))}
      </MotionObject>
      <MotionObject primary style={{ ...panel, left: 1015, width: 715, height: 545 }}>
        <div style={{ color: purple, fontSize: 20, fontWeight: 700, letterSpacing: 2 }}>
          SELECTED FOR THIS ROLE
        </div>
        <div style={{ fontSize: 36, fontWeight: 650, marginTop: 8 }}>
          Alex Morgan / Platform Engineer
        </div>
        <ReviewRow
          state="EXPERIENCE"
          title="Release automation"
          detail="Cut deployment time by 42%"
          progress={easeBetween(f, 17, 34)}
        />
        <ReviewRow
          state="SKILLS"
          title="TypeScript services"
          detail="TypeScript, React and Node.js"
          progress={easeBetween(f, 36, 52)}
        />
        <ReviewRow
          state="LEADERSHIP"
          title="Supported product teams"
          detail="Led six engineers on a shared platform"
          progress={easeBetween(f, 55, 70)}
        />
        <div style={{ opacity: easeBetween(f, 72, 87) }}>
          <Status>Saved as a tailored resume</Status>
        </div>
      </MotionObject>
    </>
  );
}

export function AssistantResume({ f }) {
  const heading = useShotHeading();
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 110,
          top: 255,
          color: muted,
          fontSize: 21,
          fontWeight: 650,
          letterSpacing: 1,
          opacity: heading,
        }}
      >
        ASSISTANT / DEMO RESPONSES
      </div>
      <Curate f={f} />
    </>
  );
}
