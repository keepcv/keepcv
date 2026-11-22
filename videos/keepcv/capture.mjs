import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const { origin, token, ids } = JSON.parse(await readFile(".keepcv-promo/session.json", "utf8"));
const out = resolve("videos/keepcv/public");
await mkdir(`${out}/clips`, { recursive: true });
await mkdir(".keepcv-promo/qa", { recursive: true });
const browser = await chromium.launch({ headless: true });
const auth = await browser.newContext();
const authPage = await auth.newPage();
await authPage.goto(`${origin}/#token=${token}`);
await authPage.waitForTimeout(1200);
const storageState = await auth.storageState();
await auth.close();
const manifest = JSON.parse(await readFile(`${out}/capture.json`, "utf8").catch(() => "{}"));
const resume = `/resumes/${ids.resume}`;
async function record(name, path, action) {
  if (process.env["PROMO_ONLY"] && !process.env["PROMO_ONLY"].split(",").includes(name)) return;
  if (process.env["PROMO_RESUME"] && manifest[name]) return;
  const context = await browser.newContext({
    storageState,
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: "light",
    recordVideo: { dir: ".keepcv-promo/raw", size: { width: 1600, height: 900 } },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  await page.goto(`${origin}${path}#token=${token}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const cursor = document.createElement("div");
    cursor.id = "demo-cursor";
    cursor.innerHTML =
      '<svg width="30" height="36" viewBox="0 0 24 28"><path d="M2 2 L2 23 L8 17 L13 26 L17 24 L12 15 L21 15 Z" fill="#7c3aed" stroke="white" stroke-width="2"/></svg>';
    Object.assign(cursor.style, {
      position: "fixed",
      left: "800px",
      top: "650px",
      pointerEvents: "none",
      zIndex: "2147483647",
      filter: "drop-shadow(0 2px 3px #0005)",
    });
    document.body.append(cursor);
    addEventListener("mousemove", (e) => {
      cursor.style.left = `${e.clientX}px`;
      cursor.style.top = `${e.clientY}px`;
    });
    addEventListener("mousedown", (e) => {
      const ring = document.createElement("div");
      Object.assign(ring.style, {
        position: "fixed",
        left: `${e.clientX - 22}px`,
        top: `${e.clientY - 22}px`,
        width: "44px",
        height: "44px",
        border: "3px solid #7c3aed",
        borderRadius: "50%",
        pointerEvents: "none",
        zIndex: "2147483646",
      });
      document.body.append(ring);
      ring.animate(
        [
          { transform: "scale(.35)", opacity: 1 },
          { transform: "scale(1.4)", opacity: 0 },
        ],
        { duration: 500 },
      ).onfinish = () => ring.remove();
    });
  });
  const cdp = await context.newCDPSession(page);
  const metrics = await cdp.send("Page.getLayoutMetrics");
  const video = page.video();
  await page.screenshot({ path: `.keepcv-promo/qa/${name}-before.png` });
  const start = Date.now();
  const move = async (locator) => {
    await locator.scrollIntoViewIfNeeded();
    const box = await locator.boundingBox();
    if (!box) throw new Error(`No box for ${name}`);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 35 });
    await page.waitForTimeout(220);
  };
  const click = async (locator) => {
    await move(locator);
    await locator.click();
    await page.waitForTimeout(600);
  };
  await action(page, click, move);
  const elapsed = Date.now() - start;
  await page.waitForTimeout(Math.max(2000, 10500 - elapsed));
  await page.screenshot({ path: `.keepcv-promo/qa/${name}.png` });
  await writeFile(`.keepcv-promo/qa/${name}.txt`, await page.locator("body").innerText());
  const layout = await page.locator("main, h1, button, [draggable=true]").evaluateAll((els) =>
    els.slice(0, 90).map((el) => {
      const r = el.getBoundingClientRect();
      return {
        text: el.textContent?.slice(0, 65),
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
      };
    }),
  );
  await context.close();
  await video.saveAs(`${out}/clips/${name}.webm`);
  manifest[name] = {
    path,
    duration: (Date.now() - start) / 1000,
    layout,
    viewport: metrics.cssLayoutViewport,
  };
  await writeFile(`${out}/capture.json`, JSON.stringify(manifest, null, 2));
  process.stdout.write(`Captured ${name}\n`);
}
try {
  await record("overview", "/overview", async (p, click) => {
    await click(p.getByRole("button", { name: "Show record kinds" }));
  });
  await record("import", "/import", async (p) => {
    await p.locator('input[type="file"]').setInputFiles({
      name: "career.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          basics: { name: "Alex Morgan", email: "alex@example.com" },
          projects: [
            {
              name: "Open Data Toolkit",
              description: "Tools for accessible public data",
              highlights: ["Made complex datasets easier to explore."],
            },
          ],
        }),
      ),
    });
  });
  await record("profile", "/profile", async (p, click) => {
    await click(p.getByRole("textbox", { name: "Headline", exact: true }));
    await p.getByRole("textbox", { name: "Headline", exact: true }).press("End");
  });
  await record("records", "/records", async (p, click) => {
    await click(p.getByRole("button", { name: "Show record kinds" }));
    await p.mouse.wheel(0, 380);
  });
  await record("record", `/records/${ids.record}`, async (p) => {
    await p.mouse.move(1050, 580, { steps: 40 });
    await p.mouse.wheel(0, 250);
  });
  await record("wording", `/points/${ids.point}/edit`, async (p, click) => {
    await click(p.getByText("Edit", { exact: true }).filter({ visible: true }).first());
  });
  await record("evidence", `/points/${ids.point}/edit`, async (p) => {
    await p
      .getByText("Private evidence", { exact: true })
      .evaluate((el) => el.scrollIntoView({ block: "center", behavior: "smooth" }));
    await p.waitForTimeout(1000);
    await p.mouse.move(1040, 600, { steps: 40 });
  });
  await record("tags", "/tags", async (p, click) => {
    await click(p.getByRole("link", { name: /^Sections/ }));
  });
  await record("search", "/records", async (p, _click) => {
    await p.keyboard.press("Control+k");
    await p.waitForTimeout(450);
    const input = p.locator("input").filter({ visible: true }).first();
    await input.pressSequentially("deployment", { delay: 140 });
    await p.waitForTimeout(600);
    await p.keyboard.press("Enter");
  });
  await record("roles", "/role-profiles", async (p) => {
    await p.mouse.move(650, 360, { steps: 40 });
  });
  await record("compose", resume, async (p, click) => {
    await click(p.getByRole("button", { name: /^Hide Raised accessibility/ }));
    await p.waitForTimeout(700);
    await click(p.getByRole("button", { name: /^Show Raised accessibility/ }));
  });
  await record("reorder", resume, async (p) => {
    const rows = p.locator('[draggable="true"]');
    const from = rows.nth(2);
    const to = rows.nth(3);
    const a = await from.boundingBox();
    const b = await to.boundingBox();
    if (!a || !b) throw new Error("Missing draggable rows");
    await p.mouse.move(a.x + 10, a.y + 16, { steps: 25 });
    await p.mouse.down();
    await p.waitForTimeout(350);
    await p.mouse.move(b.x + 20, b.y + b.height - 5, { steps: 50 });
    await p.waitForTimeout(500);
    await p.mouse.up();
  });
  await record("target", `${resume}?view=target`, async (p) => {
    await p.mouse.move(900, 610, { steps: 40 });
    await p
      .getByText("Least like the posting", { exact: true })
      .first()
      .evaluate((el) => el.scrollIntoView({ block: "center", behavior: "smooth" }));
    await p.waitForTimeout(1000);
  });
  await record("templates", "/templates", async (p, click) => {
    await click(p.getByRole("link", { name: "Classic", exact: true }));
  });
  await record("builder", "/templates/new?basedOn=modern-v1", async (p, click) => {
    await click(p.getByRole("textbox", { name: "Template name", exact: true }));
    await p
      .getByRole("textbox", { name: "Template name", exact: true })
      .fill("Alex - personal design");
    await p.getByLabel("Typeface", { exact: true }).selectOption({ label: "Georgia" });
  });
  await record("html", "/templates/new?basedOn=studio-html-v1", async (p) => {
    await p.mouse.move(750, 450, { steps: 40 });
  });
  await record("design", `${resume}?view=preview`, async (p, click) => {
    await click(p.getByRole("button", { name: "Fit and checks", exact: true }));
  });
  await record("export", `${resume}?view=preview`, async (p, click) => {
    await click(p.getByRole("button", { name: "Other formats", exact: true }));
    const select = p.getByLabel("File format", { exact: true });
    await select.selectOption("docx");
    await click(p.getByRole("button", { name: "Download Word document", exact: true }));
  });
  await record("history", `${resume}?view=history`, async (p, click) => {
    await click(p.getByRole("button", { name: "Save a version", exact: true }));
  });
  await record("backup", "/data", async (p, click) => {
    const button = p.getByRole("button", { name: /Download/ }).first();
    if (await button.count()) await click(button);
  });
  for (const file of ["logo-light.svg", "logo-dark.svg", "mark-light.svg", "logo-light-872.png"])
    await copyFile(`packages/editor/public/brand/${file}`, `${out}/${file}`);
} finally {
  await browser.close();
}
