import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface Size {
  width: number;
  height: number;
}

// What the element laid out, which for the page inside the frame is bigger than
// the box holding it.
const contentSize = (of: HTMLElement): Size => ({
  width: of.scrollWidth,
  height: of.scrollHeight,
});

// What the element was given. `scrollWidth` here would answer with the page it
// is holding, and the page would then be measured against itself and never
// scale.
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

// A template's own document, not a corner of the app's. Its stylesheet carries
// `@page` and physical units, so it needs a page to be a page rather than one
// more block inside a layout that already has fonts, resets and a colour scheme
// (template-model.md #5). Fitting that on a screen is scaling, not restyling.
export function TemplateFrame({
  title,
  styles,
  children,
}: {
  title: string;
  styles: string;
  children: ReactNode;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [page, setPage] = useState<HTMLElement | null>(null);
  const [room, setRoom] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const inside = frame.current?.contentDocument;
    if (inside === null || inside === undefined) return;
    inside.documentElement.style.overflow = "hidden";
    inside.body.style.margin = "0";
    setPage(inside.body);
  }, []);

  const paper = useSize(page, contentSize);
  const available = useSize(room, boxSize).width;
  const measured = paper.width !== 0 && available !== 0;
  const scale = measured ? Math.min(1, available / paper.width) : 1;

  return (
    <div ref={setRoom} className="flex justify-center">
      {/* Sized to what the page looks like after scaling, so it takes the room
          it occupies rather than the room it would occupy unscaled. */}
      <div
        className="overflow-hidden shadow-sm ring-1 ring-slate-200"
        style={
          measured
            ? { width: paper.width * scale, height: paper.height * scale }
            : { width: "100%", height: "60vh" }
        }
      >
        <iframe
          ref={frame}
          title={title}
          className="block border-0 bg-white"
          style={{
            width: measured ? paper.width : "100%",
            height: measured ? paper.height : "60vh",
            transform: `scale(${String(scale)})`,
            transformOrigin: "top left",
          }}
        />
      </div>
      {page === null
        ? null
        : createPortal(
            <>
              <style>{styles}</style>
              {children}
            </>,
            page,
          )}
    </div>
  );
}
