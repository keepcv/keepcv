import type { FlowBlock, Pagination } from "@keepcv/core";
import { paginate } from "@keepcv/core";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface Size {
  width: number;
  height: number;
}

const contentSize = (of: HTMLElement): Size => ({
  width: of.scrollWidth,
  height: of.scrollHeight,
});

// `scrollWidth` measures the page against itself and prevents scaling.
const boxSize = (of: HTMLElement): Size => ({ width: of.clientWidth, height: of.clientHeight });

function useSize(element: HTMLElement | null, read: (of: HTMLElement) => Size): Size {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  useEffect(() => {
    if (element === null) return;
    const measure = () => {
      const next = read(element);
      setSize((current) =>
        current.width === next.width && current.height === next.height ? current : next,
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [element, read]);

  return size;
}

const BLOCKISH = new Set(["block", "flex", "grid", "list-item", "table"]);

function usableHeight(inside: Document, into: HTMLElement): number {
  const probe = inside.createElement("div");
  probe.style.cssText =
    "position:absolute;visibility:hidden;width:0;height:var(--kc-page-content-height)";
  into.append(probe);
  const height = probe.getBoundingClientRect().height;
  probe.remove();
  return height;
}

function keysUnder(element: Element): string[] {
  return [...element.querySelectorAll("[data-key]")].flatMap((found) => {
    const key = found.getAttribute("data-key");
    return key === null ? [] : [key];
  });
}

function blocksIn(element: Element, counter: { next: number }): FlowBlock[] {
  const style = getComputedStyle(element);
  const atomic = style.breakInside === "avoid";
  const children = [...element.children].filter((child) =>
    BLOCKISH.has(getComputedStyle(child).display),
  );

  if (!atomic && children.length > 0) {
    const nested = children.flatMap((child) => blocksIn(child, counter));
    const key = element.getAttribute("data-key");
    const first = nested[0];
    if (key !== null && first !== undefined) {
      nested[0] = { ...first, covers: [key, ...first.covers] };
    }
    return nested;
  }

  const box = element.getBoundingClientRect();
  counter.next += 1;
  return [
    {
      key: element.getAttribute("data-key") ?? `:${String(counter.next)}`,
      top: box.top,
      height: box.height,
      atomic,
      keepWithNext: style.breakAfter === "avoid",
      covers: keysUnder(element),
    },
  ];
}

const EMPTY: Pagination = { pages: 1, pageOf: {}, breaks: [] };

// Break offsets are relative to `origin` inside the frame.
interface Measured {
  pagination: Pagination;
  origin: number;
}

function measure(inside: Document, host: HTMLElement): Measured {
  const counter = { next: 0 };
  const rendered = [...host.children].filter((child) => getComputedStyle(child).display !== "none");
  const blocks = rendered.flatMap((child) => blocksIn(child, counter));
  const first = blocks[0];
  if (first === undefined) return { pagination: EMPTY, origin: 0 };

  const flowed = blocks.map((block) => ({ ...block, top: block.top - first.top }));
  return {
    pagination: paginate(flowed, usableHeight(inside, host)),
    origin: first.top,
  };
}

function same(a: Pagination, b: Pagination): boolean {
  const keys = Object.keys(a.pageOf);
  return (
    a.pages === b.pages &&
    a.breaks.length === b.breaks.length &&
    a.breaks.every((at, index) => at === b.breaks[index]) &&
    keys.length === Object.keys(b.pageOf).length &&
    keys.every((key) => a.pageOf[key] === b.pageOf[key])
  );
}

// `@page` and physical units need a document isolated from app styles.
export function TemplateFrame({
  title,
  styles,
  overflowsFrom,
  onPaginate,
  zoom,
  page = 1,
  children,
}: {
  title: string;
  styles: string;
  overflowsFrom?: number | undefined;
  onPaginate?: ((pagination: Pagination) => void) | undefined;
  zoom?: number | undefined;
  page?: number;
  children: ReactNode;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [room, setRoom] = useState<HTMLElement | null>(null);
  const [pagination, setPagination] = useState<Pagination>(EMPTY);
  const [origin, setOrigin] = useState(0);

  useEffect(() => {
    const inside = frame.current?.contentDocument;
    if (inside === null || inside === undefined) return;
    inside.documentElement.style.overflow = "hidden";
    inside.body.style.margin = "0";
    // Measurement probes must stay outside the portal's React tree.
    const mount = inside.createElement("div");
    mount.style.display = "inline-block";
    inside.body.append(mount);
    setHost(mount);
  }, []);

  const paper = useSize(host, contentSize);
  const available = useSize(room, boxSize).width;
  const measured = paper.width !== 0 && available !== 0;
  const scale = measured ? (zoom ?? Math.min(1, available / paper.width)) : 1;

  const report = useRef(onPaginate);
  report.current = onPaginate;
  const last = useRef<Pagination>(EMPTY);

  // Reordering can change page breaks without changing document height.
  const remeasure = useCallback(() => {
    const inside = frame.current?.contentDocument;
    if (inside === null || inside === undefined || host === null) return;
    const { pagination: next, origin: at } = measure(inside, host);
    setOrigin(at);
    if (same(last.current, next)) return;
    last.current = next;
    setPagination(next);
    report.current?.(next);
  }, [host]);

  useEffect(remeasure);

  const previousPage = useRef(page);
  useEffect(() => {
    if (page === previousPage.current || room === null) return;
    previousPage.current = page;
    room.querySelector(`[data-page="${String(page)}"]`)?.scrollIntoView({ block: "start" });
  }, [page, room]);

  const from = overflowsFrom ?? Number.POSITIVE_INFINITY;

  return (
    <div
      ref={setRoom}
      className={`flex ${paper.width * scale > available ? "justify-start" : "justify-center"}`}
    >
      <div
        className="relative shrink-0 overflow-hidden shadow-sm ring-1 ring-paper-edge"
        style={
          measured
            ? { width: paper.width * scale, height: paper.height * scale }
            : { width: "100%", height: "60vh" }
        }
      >
        <span data-page="1" className="absolute top-0" aria-hidden />
        <iframe
          ref={frame}
          title={title}
          className="block border-0 bg-surface"
          style={{
            width: measured ? paper.width : "100%",
            height: measured ? paper.height : "60vh",
            transform: `scale(${String(scale)})`,
            transformOrigin: "top left",
          }}
        />
        {pagination.breaks.map((at, index) => {
          const page = index + 2;
          return (
            <div
              key={at}
              data-page={page}
              aria-hidden
              className={`pointer-events-none absolute inset-x-0 border-t border-dashed ${
                page > from ? "border-caution" : "border-line-strong"
              }`}
              style={{ top: (origin + at) * scale }}
            >
              <span
                className={`absolute right-1 -top-2.5 rounded px-1 text-[10px] leading-4 ${
                  page > from
                    ? "bg-caution-soft text-caution-text"
                    : "bg-surface-sunken text-text-subtle"
                }`}
              >
                Page {page}
              </span>
            </div>
          );
        })}
      </div>
      {host === null
        ? null
        : createPortal(
            <>
              <style>{styles}</style>
              {children}
            </>,
            host,
          )}
    </div>
  );
}
