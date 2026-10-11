(() => {
  try {
    const choice = localStorage.getItem("keepcv.theme") || "system";
    if (
      choice === "dark" ||
      (choice === "system" && matchMedia("(prefers-color-scheme: dark)").matches)
    ) {
      document.documentElement.classList.add("dark");
    }
  } catch {
    // Storage denied in private mode leaves the light default.
  }
})();
