// Written from what this tab already holds. The document was compiled here, so
// taking the resume away asks the store nothing.
export function saveFile(name: string, type: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export function printFile(html: string): void {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";

  frame.addEventListener("load", () => {
    const inside = frame.contentWindow;
    if (inside === null) return;
    inside.addEventListener("afterprint", () => {
      frame.remove();
    });
    inside.focus();
    inside.print();
  });

  // Appended first: `srcdoc` on a frame outside the document never loads.
  document.body.append(frame);
  frame.srcdoc = html;
}
