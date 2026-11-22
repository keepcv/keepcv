import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { MotionObject, useObjectMotion } from "./handoff.jsx";

const ease = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
  easing: Easing.bezier(0.22, 1, 0.36, 1),
};
const items = [
  ["Roles", "Every step of your career", 230, 100],
  ["Projects", "The work that made a difference", 420, 116],
  ["Points", "Your impact, in your words", 610, 92],
];
export function Opening() {
  const frame = useCurrentFrame();
  const f = frame * 1.8;
  const converge = interpolate(f, [20, 72], [0, 1], ease);
  const brand = interpolate(f, [72, 105], [0, 1], ease);
  const move = useObjectMotion();
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <svg
        width="1920"
        height="1080"
        style={move({ position: "absolute", left: 0, top: 0 })}
        aria-hidden="true"
      >
        <defs>
          <pattern id="opening-grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="#8a60c4" opacity=".16" />
          </pattern>
        </defs>
        <rect width="1920" height="1080" fill="url(#opening-grid)" />
        <ellipse
          cx="960"
          cy="470"
          rx="760"
          ry="330"
          fill="none"
          stroke="#7638df"
          strokeWidth="1"
          opacity=".12"
          transform={`rotate(${interpolate(f, [0, 180], [-12, -4])} 960 470)`}
        />
        <ellipse
          cx="960"
          cy="470"
          rx="630"
          ry="430"
          fill="none"
          stroke="#7638df"
          strokeWidth="1"
          opacity=".09"
          transform={`rotate(${interpolate(f, [0, 180], [12, 23])} 960 470)`}
        />
        {items.map((item, i) => (
          <path
            key={item[0]}
            d={`M 450 ${item[2] + 55} C 620 ${item[2] + 55} 570 400 740 400`}
            fill="none"
            stroke="#a581d9"
            strokeWidth="2"
            opacity={0.6 * (1 - brand)}
            strokeDasharray="600"
            strokeDashoffset={600 * (1 - interpolate(f, [10 + i * 8, 65 + i * 5], [0, 1], ease))}
          />
        ))}
        <path
          d="M 1200 400 C 1320 400 1300 450 1480 450"
          fill="none"
          stroke="#a581d9"
          strokeWidth="3"
          strokeDasharray="500"
          strokeDashoffset={500 * (1 - interpolate(f, [45, 85], [0, 1], ease))}
          opacity=".5"
        />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <circle
            key={i}
            cx={290 + i * 260}
            cy={160 + (i % 2) * 675 + Math.sin(f / 45 + i) * 10}
            r={i % 2 ? 5 : 8}
            fill="#a581d9"
            opacity=".22"
          />
        ))}
      </svg>
      {items.map(([title, note, y, delay], i) => (
        <MotionObject
          order={i}
          key={title}
          style={{
            position: "absolute",
            left: 100 + converge * (i === 1 ? 25 : 0),
            top: y + Math.sin(f / 38 + i) * 4,
            width: 350,
            padding: "24px 25px",
            border: "1px solid #d8c9ed",
            borderRadius: 20,
            background: "#ffffffed",
            boxShadow: "0 18px 45px #3f25551a",
            opacity: interpolate(f, [i * 8, 25 + i * 8], [0, 1], ease),
            translate: `${interpolate(f, [i * 8, 40 + i * 8], [-delay, 0], ease)}px 0px`,
            rotate: `${(i - 1) * interpolate(f, [0, 90], [5, 1.5], ease)}deg`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 35,
                height: 35,
                borderRadius: 10,
                background: "#eee4fc",
                color: "#7638df",
                display: "grid",
                placeItems: "center",
                fontSize: 22,
              }}
            >
              0{i + 1}
            </div>
            <span style={{ fontSize: 30, fontWeight: 650 }}>{title}</span>
          </div>
          <div style={{ fontSize: 20, color: "#7a6c87", marginTop: 12 }}>{note}</div>
        </MotionObject>
      ))}
      <MotionObject
        style={{
          position: "absolute",
          left: 710,
          top: 300,
          width: 510,
          height: 295,
          borderRadius: 28,
          background: "white",
          boxShadow: "0 30px 90px #5c378c24",
          border: "1px solid #dac9f2",
          opacity: 1 - brand,
          scale: interpolate(f, [0, 40, 85], [0.82, 1, 0.92], ease),
          translate: `0px ${interpolate(f, [0, 45], [60, 0], ease)}px`,
        }}
      >
        <div
          style={{
            padding: "27px 30px",
            background: "#7638df",
            borderRadius: "27px 27px 0 0",
            color: "white",
            fontSize: 34,
            fontWeight: 650,
          }}
        >
          Your career store
        </div>
        <div
          style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, padding: 28 }}
        >
          {Array.from({ length: 9 }, (_, i) => (
            <div
              key={i}
              style={{
                height: 26,
                borderRadius: 7,
                background: i % 3 === 0 ? "#cdb5f0" : "#eee6f7",
                opacity: interpolate(f, [18 + i * 4, 34 + i * 4], [0, 1], ease),
                translate: `${interpolate(f, [18 + i * 4, 40 + i * 4], [-30, 0], ease)}px 0px`,
              }}
            />
          ))}
        </div>
      </MotionObject>
      <MotionObject
        primary
        style={{
          position: "absolute",
          left: 1460,
          top: 260,
          width: 340,
          height: 495,
          overflow: "hidden",
          borderRadius: 16,
          border: "1px solid #d9cce9",
          boxShadow: "0 24px 65px #3c235c22",
          opacity: interpolate(f, [45, 85], [0, 1], ease),
          translate: `${interpolate(f, [45, 95], [110, 0], ease)}px 0px`,
          rotate: `${interpolate(f, [45, 110], [8, 2], ease)}deg`,
        }}
      >
        <div style={{ padding: 25, background: "white", height: 430 }}>
          <div style={{ fontSize: 27, color: "#7638df", fontWeight: 700 }}>Alex Morgan</div>
          <div style={{ fontSize: 14, marginTop: 9, color: "#775f93" }}>PRODUCT ENGINEER</div>
          {["Experience", "Projects", "Skills"].map((title) => (
            <div key={title} style={{ marginTop: 26, color: "#775f93", fontSize: 16 }}>
              <div style={{ borderBottom: "2px solid #7638df", paddingBottom: 7 }}>{title}</div>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    marginTop: 10,
                    width: `${95 - i * 17}%`,
                    height: 6,
                    background: "#d8c3ed",
                    borderRadius: 3,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            background: "#7638df",
            color: "white",
            padding: 17,
            fontSize: 25,
            textAlign: "center",
          }}
        >
          A resume, selected from it.
        </div>
      </MotionObject>
      <MotionObject
        order={2}
        style={{
          position: "absolute",
          left: 710,
          top: 130,
          opacity: 1,
          scale: 1,
        }}
      >
        <Img src={staticFile("logo-light.svg")} style={{ width: 510 }} />
      </MotionObject>
      <MotionObject
        order={3}
        style={{
          position: "absolute",
          left: 490,
          top: 540,
          width: 940,
          textAlign: "center",
          fontSize: 73,
          lineHeight: 1.18,
          letterSpacing: -3,
          fontWeight: 650,
          opacity: interpolate(f, [88, 117], [0, 1], ease),
          translate: `0px ${interpolate(f, [88, 117], [30, 0], ease)}px`,
        }}
      >
        Your career is bigger
        <br />
        than one page.
      </MotionObject>
      <MotionObject
        order={4}
        style={{
          position: "absolute",
          left: 500,
          top: 770,
          width: 920,
          textAlign: "center",
          fontSize: 30,
          color: "#6e5c82",
          opacity: interpolate(f, [108, 134], [0, 1], ease),
        }}
      >
        Keep the whole story. Choose what belongs on each resume.
      </MotionObject>
    </AbsoluteFill>
  );
}
