const STORAGE_KEY = "keepcv.session";
const FRAGMENT_KEY = "token";

// The launcher prints a URL carrying the token in the fragment, which the
// browser never sends to any server: a page on another origin that fetches this
// one gets HTML with no token in it, and nothing lands in a proxy log. It is read
// once, kept for the tab, and removed from the address bar so a screenshot or a
// pasted URL does not carry it.
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
