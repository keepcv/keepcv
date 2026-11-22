import { MotionObject } from "./handoff.jsx";
import { easeBetween } from "./motion.mjs";

const purple = "#7638df";
const paper = {
  position: "absolute",
  boxSizing: "border-box",
  border: "1px solid #c6a9eb",
  borderRadius: 26,
  background: "#fff",
  boxShadow: "0 24px 60px #45216e24",
  padding: 40,
};
const accent = { color: purple, fontSize: 19, fontWeight: 700, letterSpacing: 2 };

const stages = {
  route: [
    ["Your career store", "Alex Morgan", "Platform Engineer resume"],
    [
      ["Start with your profile", "Name, contact details and a short summary"],
      ["Capture the work", "An experience record and a measurable Point"],
      ["Choose the relevant pieces", "Select and tailor what belongs on the page"],
      ["Choose a template and export", "Preview the design before you send it"],
    ],
  ],
  assistantSetup: [
    ["One sample posting", "Platform Engineer", "Release automation and TypeScript"],
    [
      ["Paste the public job URL", "Turn on Web search for the request"],
      ["Review the suggestion", "Compare the proposed changes with saved work"],
      ["Accept and open the resume", "The selected Points and skills appear in the editor"],
    ],
  ],
  finish: [
    ["Ready to send", "Alex Morgan", "Platform Engineer / Classic"],
    [
      ["Career profile", "Contact details and introduction"],
      ["Selected work", "Deployment results and platform leadership"],
      ["Final layout", "Classic with selected experience and skills"],
    ],
  ],
};

function JourneyRows({ topic, f }) {
  const [goal, steps] = stages[topic];
  return (
    <>
      <MotionObject order={1} style={{ ...paper, left: 210, top: 305, width: 830, height: 600 }}>
        {steps.map(([title, detail], i) => {
          const p = easeBetween(f, 7 + i * 14, 25 + i * 14);
          return (
            <div
              key={title}
              style={{
                display: "flex",
                gap: 24,
                alignItems: "center",
                borderBottom: "1px solid #eee2fb",
                padding: "21px 0",
                opacity: p,
                translate: `${(1 - p) * -40}px 0px`,
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  display: "grid",
                  placeItems: "center",
                  color: purple,
                  background: "#eee1fc",
                  borderRadius: 14,
                  fontSize: 24,
                  fontWeight: 700,
                }}
              >
                {i + 1}
              </div>
              <div>
                <div style={{ fontSize: 30, fontWeight: 650 }}>{title}</div>
                <div style={{ fontSize: 22, color: "#654d7f", marginTop: 4 }}>{detail}</div>
              </div>
            </div>
          );
        })}
      </MotionObject>
      <MotionObject primary style={{ ...paper, left: 1100, top: 345, width: 585, height: 480 }}>
        <div style={accent}>{goal[0].toUpperCase()}</div>
        <div style={{ fontSize: 54, lineHeight: 1.16, fontWeight: 680, marginTop: 25 }}>
          {goal[1]}
        </div>
        <div style={{ fontSize: 26, color: "#674e83", marginTop: 12 }}>{goal[2]}</div>
        <div style={{ marginTop: 54, borderTop: "2px solid #e4cff9", paddingTop: 15 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: `${(88 - i * 12) * easeBetween(f, 46 + i * 10, 69 + i * 10)}%`,
                height: 10,
                background: i === 0 ? purple : "#dfc8f4",
                borderRadius: 6,
                marginTop: 18,
              }}
            />
          ))}
        </div>
      </MotionObject>
    </>
  );
}

const layouts = [
  ["Classic", "Centered header", "Georgia"],
  ["Compact", "Tighter spacing", "Segoe UI"],
  ["Editorial", "Side headings", "Georgia"],
];

function Layouts({ f }) {
  return (
    <>
      {layouts.map(([name, detail, fontFamily], i) => {
        const p = easeBetween(f, i * 16, 25 + i * 16);
        return (
          <MotionObject
            key={name}
            primary={i === 0}
            order={i}
            style={{
              ...paper,
              left: 240 + i * 495,
              top: 340,
              width: 445,
              height: 515,
              opacity: p,
              translate: `0px ${(1 - p) * 65}px`,
            }}
          >
            <div style={accent}>{name.toUpperCase()}</div>
            <div style={{ fontSize: 22, color: "#654d7f", margin: "10px 0 45px" }}>{detail}</div>
            <div
              style={{
                fontFamily,
                textAlign: i === 0 ? "center" : "left",
                fontSize: 38,
                fontWeight: 650,
              }}
            >
              Alex Morgan
            </div>
            <div
              style={{ height: 3, margin: "15px 0 28px", background: i === 2 ? "#25143e" : purple }}
            />
            {["Experience", "Skills"].map((label) => (
              <div
                key={label}
                style={{
                  display: i === 2 ? "flex" : "block",
                  gap: 24,
                  alignItems: "center",
                  marginBottom: i === 1 ? 15 : 30,
                }}
              >
                <div style={{ fontFamily, color: "#44206e", fontSize: 22, fontWeight: 650 }}>
                  {label}
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      height: 8,
                      width: "94%",
                      background: "#d6c1ed",
                      borderRadius: 5,
                      marginTop: 12,
                    }}
                  />
                  <div
                    style={{
                      height: 8,
                      width: "77%",
                      background: "#e9dcf6",
                      borderRadius: 5,
                      marginTop: 10,
                    }}
                  />
                </div>
              </div>
            ))}
          </MotionObject>
        );
      })}
    </>
  );
}

export function Journey({ topic, f }) {
  return topic === "layout" ? <Layouts f={f} /> : <JourneyRows topic={topic} f={f} />;
}
