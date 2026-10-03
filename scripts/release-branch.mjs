import assert from "node:assert/strict";

export function releaseVersion(ref, version) {
  const match = /^refs\/heads\/release\/((0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*))$/.exec(ref);
  assert(match, "Select a release/<version> branch with a stable version");
  assert.equal(version, match[1], "Release branch and launcher versions differ");
  return version;
}
