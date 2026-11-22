import { easeBetween } from "./motion.mjs";

const purple = "#7638df";
const ink = "#25143e";
const muted = "#6f568c";
const labels = ["Release pipeline", "Accessible components", "Team mentoring", "Community work"];
const box = {
  position: "absolute",
  boxSizing: "border-box",
  background: "white",
  border: "1px solid #bfa2e5",
  borderRadius: 24,
  padding: 32,
  boxShadow: "0 20px 55px #4b217c22",
};
const text = { fontSize: 27, color: muted, lineHeight: 1.45 };

function Cursor({ x, y, pressed = false }) {
  const move = useObjectMotion();
  return (
    <svg
      width="56"
      height="64"
      viewBox="0 0 56 64"
      style={move(
        {
          position: "absolute",
          zIndex: 10,
          left: x,
          top: y,
          filter: "drop-shadow(0 4px 5px #25143e40)",
          scale: pressed ? 0.85 : 1,
        },
        false,
        3,
      )}
      aria-hidden="true"
    >
      <path d="M6 3L44 36L26 38L19 56Z" fill={purple} stroke="white" strokeWidth="3" />
    </svg>
  );
}
function Tile({ label, x, y, width = 420, style, order = 1 }) {
  return (
    <MotionObject
      order={order}
      style={{
        ...box,
        left: x,
        top: y,
        width,
        height: 100,
        display: "flex",
        alignItems: "center",
        gap: 20,
        fontSize: 28,
        color: ink,
        ...style,
      }}
    >
      <div
        style={{ width: 28, height: 28, borderRadius: 8, background: "#d2b3f3", flexShrink: 0 }}
      />
      {label}
    </MotionObject>
  );
}
function Intake({ f }) {
  const formats = ["PDF", "DOCX", "JSON Resume", "RenderCV"];
  const review = easeBetween(f, 55, 90);
  return (
    <>
      {formats.map((label, i) => {
        const p = easeBetween(f, i * 12, 30 + i * 12);
        return (
          <Tile
            key={label}
            label={label}
            x={200 + p * 80}
            y={320 + i * 125}
            width={400}
            style={{ opacity: p, rotate: `${(1 - p) * -7}deg` }}
          />
        );
      })}
      <MotionObject primary style={{ ...box, left: 920, top: 310, width: 750, height: 600 }}>
        <h2 style={{ fontSize: 34, margin: "0 0 26px" }}>Review imported content</h2>
        {["Profile", "Experience", "Points", "Skills"].map((label, i) => (
          <div
            key={label}
            style={{
              ...text,
              display: "flex",
              padding: 18,
              marginTop: 12,
              borderRadius: 12,
              background: "#f0e5fc",
              opacity: easeBetween(f, 38 + i * 14, 53 + i * 14),
            }}
          >
            {label}
            <span style={{ marginLeft: "auto", color: purple }}>
              {f > 65 + i * 14 ? "Selected" : "Review"}
            </span>
          </div>
        ))}
        <div
          style={{
            marginTop: 28,
            padding: 16,
            background: purple,
            borderRadius: 12,
            color: "white",
            fontSize: 27,
            textAlign: "center",
            opacity: review,
          }}
        >
          Add reviewed content
        </div>
      </MotionObject>
      <Cursor
        x={780 + easeBetween(f, 80, 140) * 610}
        y={480 + easeBetween(f, 80, 140) * 300}
        pressed={f > 125 && f < 135}
      />
    </>
  );
}
function Profile({ f }) {
  const p = easeBetween(f, 20, 80);
  return (
    <>
      <MotionObject
        primary
        style={{
          ...box,
          left: 300 + p * 150,
          top: 320,
          width: 1000,
          height: 515,
          paddingLeft: 200,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 40,
            top: 45,
            width: 115,
            height: 115,
            borderRadius: "50%",
            background: "#e5d3fa",
            display: "grid",
            placeItems: "center",
            fontSize: 45,
            color: purple,
          }}
        >
          AM
        </div>
        <div style={{ fontSize: 48, fontWeight: 650 }}>Alex Morgan</div>
        <div style={{ ...text, marginTop: 12 }}>Product engineer</div>
        {[
          "alex@example.com",
          "Portfolio and professional links",
          "Building accessible product experiences.",
        ].map((label, i) => (
          <div
            key={label}
            style={{
              ...text,
              marginTop: 27,
              padding: 17,
              borderRadius: 12,
              background: "#f0e5fc",
              clipPath: `inset(0 ${(1 - easeBetween(f, 35 + i * 24, 55 + i * 24)) * 100}% 0 0)`,
            }}
          >
            {label}
          </div>
        ))}
      </MotionObject>
      <MotionObject
        order={2}
        style={{
          ...box,
          left: 1380,
          top: 385,
          width: 275,
          height: 190,
          opacity: easeBetween(f, 90, 120),
          translate: `0px ${(1 - easeBetween(f, 90, 120)) * 50}px`,
          color: purple,
          fontSize: 30,
        }}
      >
        One profile.
        <br />
        Reusable across resumes.
      </MotionObject>
    </>
  );
}
function Records({ f }) {
  const types = [
    "Experience",
    "Education",
    "Projects",
    "Skills",
    "Volunteering",
    "Custom sections",
  ];
  const unfold = easeBetween(f, 12, 95);
  return (
    <>
      {types.map((label, i) => {
        const x = 300 + (i % 3) * 450;
        const y = 325 + Math.floor(i / 3) * 245;
        return (
          <MotionObject
            primary={i === 0}
            order={i}
            key={label}
            style={{
              ...box,
              left: 750 + (x - 750) * unfold,
              top: 450 + (y - 450) * unfold,
              width: 410,
              height: 210,
              rotate: `${(1 - unfold) * (i - 2.5) * 8}deg`,
              opacity: easeBetween(f, i * 8, 15 + i * 8),
              background: Math.floor(f / 22) % 6 === i ? "#ede0fc" : "white",
            }}
          >
            <div style={{ color: purple, fontSize: 48, fontWeight: 650, marginBottom: 18 }}>
              {String(i + 1).padStart(2, "0")}
            </div>
            <div style={{ fontSize: 29 }}>{label}</div>
          </MotionObject>
        );
      })}
    </>
  );
}
function Context({ f }) {
  const tabs = ["Dates", "Links", "Custom fields", "Points"];
  const active = Math.min(3, Math.floor(f / 37));
  const tabX = [95, 250, 440, 650];
  const cursorX =
    tabX[Math.max(0, active - 1)] +
    (tabX[active] - tabX[Math.max(0, active - 1)]) * easeBetween(f, active * 37, active * 37 + 12);
  return (
    <MotionObject primary style={{ ...box, left: 290, top: 310, width: 1340, height: 540 }}>
      <h2 style={{ fontSize: 39, margin: "0 0 30px" }}>Senior Product Engineer</h2>
      <div style={{ display: "flex", gap: 18 }}>
        {tabs.map((label, i) => (
          <div
            key={label}
            style={{
              padding: "16px 28px",
              borderRadius: 12,
              background: i === active ? purple : "#f0e5fc",
              color: i === active ? "white" : muted,
              fontSize: 26,
            }}
          >
            {label}
          </div>
        ))}
      </div>
      <div style={{ ...text, marginTop: 40, fontSize: 34 }}>
        {
          [
            "March 2021 - Present",
            "Product portfolio and supporting links",
            "Team: Platform / Scope: 12 teams",
            "Reduced deployment time by 42%.",
          ][active]
        }
      </div>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            height: 15,
            borderRadius: 9,
            background: "#e6d5f7",
            marginTop: 28,
            width: `${70 - i * 12 + Math.sin(f / 30) * 3}%`,
          }}
        />
      ))}
      <Cursor x={cursorX} y={140} />
    </MotionObject>
  );
}
function Search({ f }) {
  const query = "deployment".slice(0, Math.floor(f / 4));
  const open = easeBetween(f, 90, 135);
  return (
    <>
      <MotionObject
        primary
        style={{
          ...box,
          left: 350,
          top: 310,
          width: 1220,
          height: 120,
          fontSize: 39,
          color: purple,
        }}
      >
        Search / {query}
        <span style={{ opacity: Math.floor(f / 12) % 2 }}>|</span>
      </MotionObject>
      {labels.slice(0, 3).map((label, i) => (
        <Tile
          key={label}
          label={i === 0 ? "Reduced deployment time by 42%" : label}
          x={350 + open * (i === 0 ? 100 : -80)}
          y={480 + i * 120}
          width={1220 - open * 200}
          style={{
            opacity: easeBetween(f, 35 + i * 10, 50 + i * 10) * (i === 0 ? 1 : 1 - open * 0.7),
            borderLeft: i === 0 ? "8px solid #7638df" : undefined,
          }}
        />
      ))}
      <MotionObject style={{ ...text, position: "absolute", left: 460, top: 875, opacity: open }}>
        Opened in Experience / Senior Product Engineer
      </MotionObject>
      <Cursor x={1400 - open * 200} y={540} pressed={f > 88 && f < 100} />
    </>
  );
}
function Roles({ f }) {
  const active = Math.min(2, Math.floor(f / 50));
  const roles = ["Platform", "Product", "Leadership"];
  return (
    <>
      <MotionObject primary style={{ ...box, left: 270, top: 330, width: 500, height: 470 }}>
        <h2 style={{ fontSize: 35, margin: "0 0 24px" }}>Role profile</h2>
        {roles.map((label, i) => (
          <div
            key={label}
            style={{
              ...text,
              padding: 20,
              marginTop: 14,
              borderRadius: 12,
              color: active === i ? "white" : muted,
              background: active === i ? purple : "#f0e5fc",
            }}
          >
            {label}
          </div>
        ))}
      </MotionObject>
      <MotionObject order={2} style={{ ...box, left: 940, top: 330, width: 700, height: 470 }}>
        <h2 style={{ fontSize: 35, margin: "0 0 24px" }}>Matching content</h2>
        {labels.slice(0, 3).map((label, i) => (
          <div key={label} style={{ ...text, marginTop: 27 }}>
            {label}
            <div
              style={{
                height: 14,
                marginTop: 12,
                borderRadius: 8,
                width: `${35 + 50 * (i === active ? 1 : 0.25) + Math.sin(f / 18) * 4}%`,
                background: i === active ? purple : "#ceb0ef",
              }}
            />
          </div>
        ))}
      </MotionObject>
    </>
  );
}
function Reorder({ f }) {
  const p = easeBetween(f, 25, 85);
  const settle = easeBetween(f, 90, 145);
  return (
    <>
      <MotionObject primary style={{ ...box, left: 420, top: 285, width: 1080, height: 610 }}>
        <h2 style={{ fontSize: 35, margin: 0 }}>Your resume selection</h2>
      </MotionObject>
      {labels.map((label, i) => {
        const delta = i === 2 ? -240 : i < 2 ? 120 : 0;
        return (
          <Tile
            key={label}
            label={label}
            order={i}
            x={470 + (i === 2 ? Math.sin(p * Math.PI) * 60 : 0)}
            y={380 + i * 120 + p * delta}
            width={980}
            style={{
              zIndex: i === 2 ? 2 : 1,
              scale: i === 2 ? 1 + Math.sin(p * Math.PI) * 0.035 : 1,
              border: i === 2 ? "2px solid #7638df" : undefined,
              background: i === 2 ? "#f2e8ff" : "white",
            }}
          />
        );
      })}
      <Cursor
        x={1300 + Math.sin(p * Math.PI) * 60}
        y={665 - p * 240 + settle * 80}
        pressed={p > 0 && p < 1}
      />
    </>
  );
}
function Builder({ f, html = false }) {
  const p = easeBetween(f, 25, 130);
  return (
    <>
      <MotionObject
        order={2}
        style={{
          ...box,
          left: 240,
          top: 300,
          width: 730,
          height: 565,
          background: html ? "#2d1749" : "white",
          color: html ? "#e7d6fb" : ink,
        }}
      >
        <h2 style={{ fontSize: 34, margin: "0 0 32px" }}>
          {html ? "Template workspace" : "Visual controls"}
        </h2>
        {(html
          ? [
              "index.html",
              "styles.css",
              "assets/",
              "{{ resume.header.fullName }}",
              "Preview your template",
            ]
          : [
              "Typeface / Georgia",
              "Heading size",
              "Column spacing",
              "Section rhythm",
              "Accent / Purple",
            ]
        ).map((label, i) => (
          <div
            key={label}
            style={{
              fontSize: html ? 24 : 27,
              padding: "15px 12px",
              marginTop: 12,
              borderRadius: 10,
              background: html ? "#432363" : "#f0e5fc",
              clipPath: `inset(0 ${(1 - easeBetween(f, i * 17, i * 17 + 23)) * 100}% 0 0)`,
            }}
          >
            {label}
          </div>
        ))}
      </MotionObject>
      <MotionObject primary style={{ ...box, left: 1120, top: 305, width: 500, height: 560 }}>
        <div style={{ fontSize: 36 + p * 7, color: purple, fontWeight: 650 }}>Alex Morgan</div>
        <div style={{ ...text, marginTop: 15 }}>Product engineer</div>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ marginTop: 22 - p * 4 }}>
            <div
              style={{
                fontSize: 24,
                fontWeight: 650,
                borderBottom: "2px solid #7638df",
                paddingBottom: 10,
              }}
            >
              {["Experience", "Projects", "Skills"][i]}
            </div>
            {[0, 1, 2].map((j) => (
              <div
                key={j}
                style={{
                  height: 9,
                  borderRadius: 4,
                  background: "#d4bde9",
                  marginTop: 11 - p * 2,
                  width: `${90 - j * 14}%`,
                }}
              />
            ))}
          </div>
        ))}
      </MotionObject>
      <Cursor x={850 + p * 390} y={650 - p * 180} />
    </>
  );
}
function Fit({ f }) {
  const p = easeBetween(f, 20, 125);
  return (
    <>
      <MotionObject
        primary
        style={{ ...box, left: 340, top: 290, width: 580, height: 610, overflow: "hidden" }}
      >
        <div style={{ fontSize: 36, color: purple, fontWeight: 650 }}>Alex Morgan</div>
        {Array.from({ length: 12 }, (_, i) => (
          <div
            key={i}
            style={{
              marginTop: 25 - p * 9,
              height: 14,
              width: `${85 - (i % 3) * 12}%`,
              borderRadius: 6,
              background: i % 4 === 0 ? purple : "#d8c2ed",
              translate: `0px ${i * (1 - p) * 2}px`,
            }}
          />
        ))}
        <div
          style={{
            position: "absolute",
            left: 20,
            right: 20,
            bottom: 48,
            borderTop: "2px dashed #a57acb",
          }}
        />
      </MotionObject>
      <MotionObject order={2} style={{ ...box, left: 1100, top: 355, width: 490, height: 380 }}>
        <h2 style={{ fontSize: 34, margin: "0 0 30px" }}>Live page budget</h2>
        <div style={{ fontSize: 76, color: purple, fontWeight: 650 }}>
          {(1.26 - p * 0.3).toFixed(2)}
        </div>
        <div style={{ ...text }}>estimated pages</div>
        <div style={{ height: 14, background: "#e9dcf8", borderRadius: 9, marginTop: 35 }}>
          <div
            style={{ width: `${100 - p * 24}%`, height: 14, background: purple, borderRadius: 9 }}
          />
        </div>
        <div style={{ ...text, marginTop: 25 }}>Adjust spacing. Review the result.</div>
      </MotionObject>
    </>
  );
}
function Recovery({ f }) {
  const p = easeBetween(f, 15, 95);
  return (
    <>
      {["Career records", "Points and wording", "Private evidence", "Resume history"].map(
        (label, i) => (
          <Tile
            key={label}
            label={label}
            x={250 + p * 90}
            y={315 + i * 130}
            width={560}
            style={{
              opacity: easeBetween(f, i * 10, i * 10 + 18),
              translate: `${Math.sin(p * Math.PI) * 35}px 0px`,
            }}
          />
        ),
      )}
      <MotionObject
        primary
        style={{
          ...box,
          left: 1080,
          top: 370,
          width: 510,
          height: 410,
          background: "#7638df",
          color: "white",
        }}
      >
        <div style={{ fontSize: 62, fontWeight: 650 }}>keepcv.json</div>
        <div style={{ ...text, color: "#f1e6ff", marginTop: 20 }}>
          A native backup of the whole store.
        </div>
        <div
          style={{
            marginTop: 44,
            height: 14,
            borderRadius: 9,
            background: "#a576e0",
            overflow: "hidden",
          }}
        >
          <div style={{ width: `${p * 100}%`, height: 14, background: "white" }} />
        </div>
        <div style={{ fontSize: 27, marginTop: 23 }}>
          {p < 1 ? "Preparing archive" : "Ready to keep and restore"}
        </div>
        <div style={{ marginTop: 18, fontSize: 22, opacity: easeBetween(f, 105, 145) }}>
          Your original store stays intact.
        </div>
      </MotionObject>
    </>
  );
}
export function ExtraGraphic({ topic, f }) {
  const Content = {
    intake: Intake,
    profile: Profile,
    records: Records,
    context: Context,
    search: Search,
    roles: Roles,
    reorder: Reorder,
    builder: Builder,
    html: Builder,
    fit: Fit,
    recovery: Recovery,
  }[topic];
  return <Content f={f} html={topic === "html"} />;
}

import { MotionObject, useObjectMotion } from "./handoff.jsx";
