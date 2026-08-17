const STORAGE_KEY = "keepcv.session";
const FRAGMENT_KEY = "token";

// The fragment is never sent to a server. Read once, kept for the tab, and
// cleared from the address bar so a screenshot or a pasted URL does not carry it.
export function claimSessionToken(location: Location, storage: Storage): string | undefined {
  const fromFragment = new URLSearchParams(location.hash.replace(/^#/, "")).get(FRAGMENT_KEY);
  if (fromFragment !== null && fromFragment !== "") {
    storage.setItem(STORAGE_KEY, fromFragment);
    history.replaceState(null, "", `${location.pathname}${location.search}`);
    return fromFragment;
  }
  return storage.getItem(STORAGE_KEY) ?? undefined;
}

export function forgetSessionToken(storage: Storage): void {
  storage.removeItem(STORAGE_KEY);
}
