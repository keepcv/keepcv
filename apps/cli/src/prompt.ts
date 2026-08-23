const ENTER = 13;
const LINE_FEED = 10;
const CTRL_C = 3;
const DELETE = 127;
const BACKSPACE = 8;

export type Keystroke = { done: true; cancelled: boolean } | { done: false; typed: string };

export function keystroke(typed: string, character: string): Keystroke {
  const code = character.charCodeAt(0);
  if (code === CTRL_C) return { done: true, cancelled: true };
  if (code === ENTER || code === LINE_FEED) return { done: true, cancelled: false };
  if (code === DELETE || code === BACKSPACE) return { done: false, typed: typed.slice(0, -1) };
  // Arrow keys and the rest arrive as escape sequences, which would otherwise
  // land in the password as literal characters.
  return { done: false, typed: code < 32 ? typed : typed + character };
}

export function readSecret(prompt: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    const input = process.stdin;
    process.stdout.write(prompt);
    input.setRawMode(true);
    input.resume();
    input.setEncoding("utf8");

    let typed = "";
    // The listener is removed rather than the stream closed: the confirmation
    // prompt reads the same stdin straight afterwards.
    const stop = (answer: string | undefined): void => {
      input.setRawMode(false);
      input.pause();
      input.off("data", onData);
      process.stdout.write("\n");
      resolve(answer);
    };

    const onData = (chunk: string): void => {
      for (const character of chunk) {
        const next = keystroke(typed, character);
        if (next.done) {
          stop(next.cancelled ? undefined : typed);
          return;
        }
        typed = next.typed;
      }
    };

    input.on("data", onData);
  });
}

export async function readPiped(): Promise<string> {
  let held = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) held += chunk;
  return held.trim();
}
