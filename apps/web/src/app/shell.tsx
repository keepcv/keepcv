import type { Store } from "@keepcv/schema";
import { Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Icon } from "../components/icon/icon.js";
import { Button } from "../components/ui/button.js";
import { Kbd } from "../components/ui/kbd.js";
import { ToastRegion } from "../components/ui/toast.js";
import { CommandPalette } from "../features/search/ui/command-palette.js";
import { cn } from "../lib/cn.js";
import { useTheme } from "../lib/theme.js";
import { Brand, Navigation } from "./navigation.js";
import { ThemeToggle } from "./theme-toggle.js";

const RAIL_KEY = "keepcv.rail";

function isMac(): boolean {
  return typeof navigator !== "undefined" && navigator.platform.startsWith("Mac");
}

function PaletteTrigger({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-8 w-full max-w-md items-center gap-2 rounded-lg border border-line bg-surface-sunken px-2.5 text-sm text-text-subtle transition-colors hover:border-line-strong hover:text-text-muted"
    >
      <Icon name="search" size="sm" />
      <span className="flex-1 text-left">Search or jump to...</span>
      <Kbd>{isMac() ? "cmd K" : "ctrl K"}</Kbd>
    </button>
  );
}

export function Shell({ store }: { store: Store }) {
  const path = useRouterState({ select: (state) => state.location.pathname });
  const [palette, setPalette] = useState(false);
  // Keyed by the path it was opened on rather than closed by an effect watching
  // one: reaching a destination is what closes it, and that is a derivation.
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const drawer = openedAt === path;
  const { choice, choose } = useTheme();
  const [collapsed, setCollapsed] = useState(
    () => globalThis.localStorage?.getItem(RAIL_KEY) === "collapsed",
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";

      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setPalette(true);
        return;
      }
      // `/` is the older habit and still works, but not while typing into a field.
      if (event.key === "/" && !typing) {
        event.preventDefault();
        setPalette(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  function toggleRail(): void {
    const next = !collapsed;
    setCollapsed(next);
    globalThis.localStorage?.setItem(RAIL_KEY, next ? "collapsed" : "open");
  }

  return (
    <ToastRegion>
      <div className="flex min-h-screen bg-canvas text-text">
        <aside
          className={cn(
            "hidden shrink-0 flex-col gap-4 border-r border-line bg-surface px-3 py-4 lg:flex",
            collapsed ? "w-16 items-center" : "w-64",
          )}
        >
          <div
            className={cn("flex items-center", collapsed ? "justify-center" : "justify-between")}
          >
            <Brand collapsed={collapsed} />
            {collapsed ? null : (
              <Button
                tone="ghost"
                size="sm"
                icon="collapse"
                label="Collapse the navigation"
                onClick={toggleRail}
              />
            )}
          </div>
          {collapsed ? (
            <Button
              tone="ghost"
              size="sm"
              icon="expand"
              label="Expand the navigation"
              onClick={toggleRail}
            />
          ) : null}
          <div className="min-h-0 flex-1 overflow-y-auto">
            <Navigation store={store} collapsed={collapsed} />
          </div>
          {collapsed ? null : <ThemeToggle choice={choice} choose={choose} />}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-line bg-surface/85 backdrop-blur">
            <div className="flex h-14 w-full items-center gap-3 px-4 lg:px-6">
              <Button
                tone="ghost"
                icon="menu"
                label="Browse"
                className="lg:hidden"
                onClick={() => {
                  setOpenedAt(path);
                }}
              />
              <span className="lg:hidden">
                <Brand />
              </span>
              <PaletteTrigger
                onOpen={() => {
                  setPalette(true);
                }}
              />
              <span className="ml-auto lg:hidden">
                <ThemeToggle choice={choice} choose={choose} />
              </span>
            </div>
          </header>

          <main className="w-full flex-1 px-4 py-6 lg:px-6">
            <Outlet />
          </main>
        </div>

        {/* A sheet rather than a disclosure above the content: at 390px the rail
            costs more than the content does, and pushing the page down to browse
            hides what was being browsed. */}
        {drawer ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              aria-label="Close the navigation"
              onClick={() => {
                setOpenedAt(null);
              }}
              className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm"
            />
            <div className="absolute inset-y-0 left-0 flex w-72 flex-col gap-4 border-r border-line bg-surface px-3 py-4 shadow-overlay">
              <div className="flex items-center justify-between">
                <Brand />
                <Button
                  tone="ghost"
                  size="sm"
                  icon="close"
                  label="Close the navigation"
                  onClick={() => {
                    setOpenedAt(null);
                  }}
                />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <Navigation store={store} />
              </div>
              <ThemeToggle choice={choice} choose={choose} />
            </div>
          </div>
        ) : null}

        {palette ? (
          <CommandPalette
            store={store}
            onClose={() => {
              setPalette(false);
            }}
          />
        ) : null}
      </div>
    </ToastRegion>
  );
}
