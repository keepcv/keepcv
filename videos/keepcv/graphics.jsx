import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { AssistantResume } from "./assistant.jsx";
import { graphicCopy } from "./graphics-copy.mjs";
import { MotionObject, useObjectMotion, useShotHeading } from "./handoff.jsx";
import { easeBetween } from "./motion.mjs";
import { ExtraGraphic } from "./patterns.jsx";

const ink = "#25143e";
const purple = "#7638df";
const muted = "#6f568c";

function Card({
  x,
  y,
  width = 380,
  height = 180,
  title,
  children,
  style,
  primary = false,
  order = 0,
}) {
  return (
    <MotionObject
      primary={primary}
      order={order}
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        height,
        padding: 28,
        borderRadius: 22,
        background: "#fff",
        border: "1px solid #bfa2e5",
        boxShadow: "0 16px 44px #4b217c22",
        color: ink,
        ...style,
      }}
    >
      <div style={{ fontSize: 29, fontWeight: 650, marginBottom: 18 }}>{title}</div>
      {children}
    </MotionObject>
  );
}
export function Paper({ accent = purple, selected = 3, style }) {
  return (
    <div
      style={{
        width: 310,
        height: 420,
        overflow: "hidden",
        borderRadius: 12,
        background: "white",
        border: "1px solid #b79ad7",
        padding: 32,
        boxShadow: "0 20px 50px #4b217c22",
        ...style,
      }}
    >
      <div style={{ color: accent, fontSize: 29, fontWeight: 700 }}>Alex Morgan</div>
      <div style={{ color: muted, fontSize: 16, marginTop: 7 }}>PRODUCT ENGINEER</div>
      {["Experience", "Projects", "Skills"].map((label, section) => (
        <div key={label} style={{ marginTop: 20 }}>
          <div
            style={{
              fontSize: 17,
              color: accent,
              fontWeight: 650,
              borderBottom: `2px solid ${accent}`,
              paddingBottom: 6,
            }}
          >
            {label}
          </div>
          {[0, 1, 2].map((row) => (
            <div
              key={row}
              style={{
                height: 6,
                width: `${95 - row * 13}%`,
                marginTop: 7,
                borderRadius: 3,
                background: row < selected - section ? "#b6a0ce" : "#eee7f5",
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
function Chips({ labels, active = -1 }) {
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      {labels.map((label, i) => (
        <span
          key={label}
          style={{
            fontSize: 23,
            padding: "11px 17px",
            borderRadius: 12,
            background: active === i ? purple : "#eee3fc",
            color: active === i ? "white" : "#62418a",
          }}
        >
          {label}
        </span>
      ))}
    </div>
  );
}
function Store({ f }) {
  const count = Math.min(9, Math.floor(f / 12) + 1);
  return (
    <>
      <Card primary x={220} y={355} width={600} height={440} title="Your career store">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {Array.from({ length: 9 }, (_, i) => (
            <div
              key={i}
              style={{
                padding: 16,
                height: 78,
                borderRadius: 12,
                background: i < count ? "#e2cef9" : "#f4effa",
                color: purple,
                fontSize: 23,
                outline:
                  Math.floor(f / 18) % 9 === i ? "2px solid #7638df" : "2px solid transparent",
                opacity: easeBetween(f, i * 10, i * 10 + 12),
                translate: `0px ${(1 - easeBetween(f, i * 10, i * 10 + 12)) * 25}px`,
              }}
            >
              Point {i + 1}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 25, fontSize: 25, color: muted }}>Everything stays here.</div>
      </Card>
      <MotionObject
        order={2}
        style={{ position: "absolute", left: 1080, top: 345, display: "flex", gap: 70 }}
      >
        {[0, 1].map((i) => (
          <div
            key={i}
            style={{
              opacity: easeBetween(f, 35 + i * 30, 65 + i * 30),
              translate: `${(1 - easeBetween(f, 35 + i * 30, 65 + i * 30)) * 140}px 0px`,
              rotate: `${i ? 4 : -4}deg`,
            }}
          >
            <Paper selected={1 + ((Math.floor(f / 24) + i) % 3)} />
            <div style={{ fontSize: 26, marginTop: 20, textAlign: "center", color: muted }}>
              {i ? "Product role" : "Platform role"}
            </div>
          </div>
        ))}
      </MotionObject>
    </>
  );
}
function Wording({ f }) {
  const variants = [
    ["Standard", "Reduced deployment time by 42% across 12 product teams."],
    ["Compact", "Cut deployment time 42%."],
    ["Role-specific", "Redesigned the release pipeline for 12 teams."],
  ];
  return (
    <>
      {variants.map(([label, text], i) => {
        const p = easeBetween(f, i * 26, i * 26 + 24);
        return (
          <Card
            key={label}
            primary={i === 0}
            order={i}
            x={350 + i * 145}
            y={305 + i * 160}
            width={940}
            height={155}
            title={label}
            style={{
              opacity: p,
              translate: `${(1 - p) * 380}px 0px`,
              rotate: `${(1 - p) * (i - 1) * 8}deg`,
              zIndex: i,
              borderLeft:
                Math.max(0, Math.floor((f - 60) / 30)) % 3 === i
                  ? "8px solid #7638df"
                  : "1px solid #bfa2e5",
            }}
          >
            <div style={{ fontSize: 28, color: muted }}>{text}</div>
          </Card>
        );
      })}
      <MotionObject
        order={3}
        style={{
          position: "absolute",
          left: 1640,
          top: 415,
          width: 190,
          height: 190,
          borderRadius: "50%",
          background: "#7638df",
          color: "white",
          display: "grid",
          placeItems: "center",
          fontSize: 34,
          fontWeight: 650,
          scale: 0.9 + 0.1 * easeBetween(f, 60, 90),
        }}
      >
        One Point
      </MotionObject>
    </>
  );
}
function Evidence({ f }) {
  const reveal = easeBetween(f, 25, 58);
  return (
    <>
      <Card
        primary
        x={270}
        y={340}
        width={560}
        height={430}
        title="Impact that belongs on the page"
      >
        <div style={{ fontSize: 115, color: purple, fontWeight: 700, letterSpacing: -6 }}>
          {Math.round(42 * reveal)}%
        </div>
        <div style={{ fontSize: 30, color: muted }}>less deployment time</div>
        <div style={{ marginTop: 30 }}>
          <Chips labels={["12 teams", "Verified"]} active={1} />
        </div>
      </Card>
      <Card
        x={1080}
        order={2}
        y={340}
        width={560}
        height={430}
        title="Private evidence"
        style={{
          translate: `0px ${(1 - easeBetween(f, 40, 70)) * 80}px`,
          opacity: easeBetween(f, 40, 70),
        }}
      >
        <svg width="90" height="110" viewBox="0 0 90 110" aria-hidden="true">
          <rect x="17" y="45" width="58" height="52" rx="10" fill={purple} />
          <path d="M29 45V29a17 17 0 0 1 34 0v16" fill="none" stroke={purple} strokeWidth="7" />
          <circle cx="46" cy="68" r="6" fill="white" />
        </svg>
        <div style={{ fontSize: 28, color: muted, marginTop: 15 }}>
          Links, notes and supporting proof.
        </div>
        <div
          style={{
            marginTop: 30,
            fontSize: 25,
            background: "#eee3fc",
            padding: 16,
            borderRadius: 12,
          }}
        >
          Excluded from resume documents.
        </div>
        <div
          style={{
            marginTop: 12,
            fontSize: 18,
            color: muted,
            opacity: easeBetween(f, 110, 145),
            translate: `0px ${(1 - easeBetween(f, 110, 145)) * 12}px`,
          }}
        >
          Included in your native backup.
        </div>
      </Card>
    </>
  );
}
function Find({ f, roles = false }) {
  const chosen = Math.floor(f / 35) % 3;
  const labels = roles
    ? ["Platform", "Product", "Leadership"]
    : ["TypeScript", "Accessibility", "Leadership"];
  return (
    <>
      <Card
        x={330}
        primary
        y={300}
        width={1260}
        height={145}
        title={roles ? "Choose an emphasis" : "Find relevant work"}
      >
        <Chips labels={labels} active={chosen} />
      </Card>
      {Array.from({ length: 6 }, (_, i) => {
        const match = i % 3 === chosen;
        return (
          <Card
            key={i}
            order={i}
            x={330 + (i % 3) * 430}
            y={490 + Math.floor(i / 3) * 190}
            width={400}
            height={155}
            title={["Release pipeline", "Design system", "Team mentoring"][i % 3]}
            style={{
              opacity: match ? 1 : 0.3,
              scale: match ? 1 : 0.96,
              translate: `0px ${Math.sin(f / 18 + i) * 3}px`,
            }}
          >
            <div style={{ fontSize: 23, color: muted }}>
              {match ? "Relevant to this selection" : "Still kept in your store"}
            </div>
          </Card>
        );
      })}
    </>
  );
}
function Selection({ f }) {
  const p = easeBetween(f, 25, 65);
  return (
    <>
      <Card primary x={200} y={305} width={640} height={510} title="Everything you wrote">
        {["Release pipeline", "Accessible components", "Team mentoring", "Community work"].map(
          (label, i) => (
            <div
              key={label}
              style={{
                padding: 18,
                marginTop: 14,
                borderRadius: 12,
                background: "#eee3fc",
                fontSize: 26,
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              {label}
              <span style={{ color: purple }}>{i < 3 ? "+" : "kept"}</span>
            </div>
          ),
        )}
      </Card>
      <MotionObject
        order={2}
        style={{
          position: "absolute",
          left: 1130,
          top: 340,
          rotate: `${interpolate(p, [0, 1], [-7, 0])}deg`,
        }}
      >
        <Paper selected={3} />
      </MotionObject>
      {[0, 1, 2].map((i) => {
        const fly = easeBetween(f, 28 + i * 20, 55 + i * 20);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 760 + fly * 390,
              top: 430 + i * 80,
              width: 225,
              height: 38,
              borderRadius: 8,
              background: purple,
              opacity: fly > 0.95 ? 0 : fly,
              scale: 1 - fly * 0.55,
              boxShadow: "0 8px 20px #7638df35",
            }}
          />
        );
      })}
      <MotionObject
        order={3}
        style={{ position: "absolute", top: 900, left: 430, fontSize: 31, color: muted }}
      >
        Selecting changes the resume. Your store keeps the original.
      </MotionObject>
    </>
  );
}
function Target({ f }) {
  const rows = ["TypeScript", "Platform systems", "Accessibility", "Mentoring"];
  return (
    <>
      {[0, 1].map((side) => (
        <Card
          key={side}
          primary={side === 0}
          order={side}
          x={250 + side * 800}
          y={310}
          width={620}
          height={510}
          title={side ? "Selected career content" : "The job posting"}
        >
          {rows.map((label, i) => (
            <div
              key={label}
              style={{
                marginTop: 22,
                padding: 19,
                background: f > 22 + i * 24 ? "#e4d2fb" : "#f5effb",
                borderRadius: 12,
                fontSize: 27,
                translate: `${side * (1 - easeBetween(f, 22 + i * 24, 40 + i * 24)) * 50}px 0px`,
                opacity: side ? easeBetween(f, 22 + i * 24, 40 + i * 24) : 1,
              }}
            >
              {side && f > 22 + i * 24 ? "Matched: " : ""}
              {label}
            </div>
          ))}
        </Card>
      ))}
    </>
  );
}
function Design({ f }) {
  const active = Math.min(2, Math.floor(f / 38));
  const colors = ["#25143e", "#7638df", "#3c5988"];
  return (
    <>
      <Card primary x={230} y={340} width={500} height={425} title="Reusable design controls">
        {["Typography", "Spacing", "Accent"].map((label, i) => (
          <div key={label} style={{ marginTop: 30, fontSize: 26, color: muted }}>
            {label}
            <div
              style={{
                width: 380,
                height: 8,
                borderRadius: 5,
                background: "#e5d7f5",
                marginTop: 16,
              }}
            >
              <div
                style={{
                  width: `${35 + 25 * (0.5 + 0.5 * Math.sin(f / 22 + i))}%`,
                  height: 8,
                  borderRadius: 5,
                  background: colors[active],
                }}
              />
            </div>
          </div>
        ))}
      </Card>
      <MotionObject
        order={2}
        style={{ position: "absolute", left: 1020, top: 320, display: "flex", gap: 50 }}
      >
        {[0, 1].map((i) => (
          <div
            key={i}
            style={{ rotate: `${i ? 5 : -5}deg`, translate: `0px ${Math.sin(f / 22 + i) * 8}px` }}
          >
            <Paper accent={colors[(active + i) % 3]} selected={3} />
          </div>
        ))}
      </MotionObject>
    </>
  );
}
function Portable({ f }) {
  const formats = ["PDF", "HTML", "DOCX", "JSON Resume", "LaTeX", "Typst", "Web page"];
  return (
    <>
      <MotionObject
        primary
        style={{ position: "absolute", left: 824, top: 379, width: 338, height: 437 }}
      >
        <Paper style={{ scale: 0.9, transformOrigin: "top left" }} />
      </MotionObject>
      {formats.map((format, i) => {
        const angle =
          (i / formats.length) * Math.PI * 2 - Math.PI / 2 + easeBetween(f, 85, 145) * 0.22;
        const p = easeBetween(f, 10 + i * 9, 30 + i * 9);
        return (
          <MotionObject
            order={i}
            key={format}
            style={{
              position: "absolute",
              left: 855 + Math.cos(angle) * 580 * p,
              top: 560 + Math.sin(angle) * 290 * p,
              width: 220,
              padding: 22,
              borderRadius: 18,
              background: i % 2 ? "white" : purple,
              color: i % 2 ? purple : "white",
              fontSize: 27,
              fontWeight: 650,
              textAlign: "center",
              boxShadow: "0 12px 32px #4b217c22",
              opacity: p,
              rotate: `${(1 - p) * 30}deg`,
            }}
          >
            {format}
          </MotionObject>
        );
      })}
    </>
  );
}
function History({ f }) {
  const move = useObjectMotion();
  return (
    <>
      <svg
        width="1920"
        height="1080"
        style={move({ position: "absolute", left: 0, top: 0 })}
        aria-hidden="true"
      >
        <path
          d="M 310 690 H 1620"
          fill="none"
          stroke="#a37ace"
          strokeWidth="4"
          pathLength={1}
          strokeDasharray="1 1"
          strokeDashoffset={1 - easeBetween(f, 0, 65)}
        />
        <circle
          cx={310 + 1310 * easeBetween(f, 40, 145)}
          cy="690"
          r="13"
          fill="#7638df"
          stroke="white"
          strokeWidth="4"
        />
      </svg>
      {["First draft", "Tailored selection", "Named snapshot", "Keep moving"].map((label, i) => (
        <MotionObject
          primary={i === 0}
          order={i}
          key={label}
          style={{
            position: "absolute",
            left: 210 + i * 410,
            top: 360,
            opacity: easeBetween(f, i * 22, i * 22 + 18),
            translate: `0px ${(1 - easeBetween(f, i * 22, i * 22 + 18)) * 55}px`,
          }}
        >
          <div style={{ scale: 0.62, transformOrigin: "top left", height: 275 }}>
            <Paper accent={i === 2 ? purple : "#775f93"} selected={(i % 3) + 1} />
          </div>
          <div style={{ width: 210, fontSize: 27, color: muted, marginTop: 75 }}>{label}</div>
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: purple,
              position: "absolute",
              top: 321,
              left: 92,
            }}
          />
        </MotionObject>
      ))}
    </>
  );
}
export function GraphicScene({ topic, frames }) {
  const frame = useCurrentFrame();
  const f = (Math.min(frame, frames - 1) * 150) / frames;
  const heading = useShotHeading();
  const [title, sub] = graphicCopy[topic];
  const content = {
    store: Store,
    wording: Wording,
    evidence: Evidence,
    find: Find,
    roles: Find,
    selection: Selection,
    target: Target,
    design: Design,
    portable: Portable,
    history: History,
    assistantResume: AssistantResume,
  }[topic];
  const Content = content;
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: 110,
          top: 65,
          fontSize: 23,
          color: purple,
          fontWeight: 650,
          letterSpacing: 3,
          opacity: heading,
        }}
      >
        KEEPCV / THE IDEA IN MOTION
      </div>
      <div
        style={{
          position: "absolute",
          left: 110,
          top: 107,
          fontSize: 65,
          fontWeight: 650,
          letterSpacing: -2,
          color: ink,
          opacity: heading,
        }}
      >
        {title}
      </div>
      <div
        style={{
          position: "absolute",
          left: 113,
          top: 194,
          fontSize: 30,
          color: muted,
          opacity: heading,
        }}
      >
        {sub}
      </div>
      {Content && topic !== "roles" ? (
        <Content f={f} topic={topic} />
      ) : (
        <ExtraGraphic topic={topic} f={f} />
      )}
    </AbsoluteFill>
  );
}
