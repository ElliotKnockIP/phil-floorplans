let GOOGLE_MAPS_API_KEY;

// Check if on GitHub Pages first
const hostname = window.location.hostname;
const isGitHubPages = hostname.includes("github.io") || hostname.includes("github.com");

try {
  if (isGitHubPages) {
    // On GitHub Pages, always use production config
    const prod = await import("./config.js");
    GOOGLE_MAPS_API_KEY = prod.GOOGLE_MAPS_API_KEY;

    // Check if key is still placeholder
    if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY === "PLACEHOLDER") {
      console.error("[Config Loader] ERROR: API key is still PLACEHOLDER GitHub Actions workflow did not replace it.");
      throw new Error("API key not configured. Check GitHub Actions workflow.");
    }
  } else {
    // Only try to load local config when running locally
    const isLocal = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "" || hostname.startsWith("192.168.") || hostname.startsWith("10.") || hostname.startsWith("172.");

    if (isLocal) {
      try {
        const local = await import("./config.local.js");
        GOOGLE_MAPS_API_KEY = local.GOOGLE_MAPS_API_KEY;
      } catch (e) {
        // Fall back to production config if local config doesn't exist
        const prod = await import("./config.js");
        GOOGLE_MAPS_API_KEY = prod.GOOGLE_MAPS_API_KEY;
      }
    } else {
      // Not local and not GitHub Pages, use production config
      const prod = await import("./config.js");
      GOOGLE_MAPS_API_KEY = prod.GOOGLE_MAPS_API_KEY;
    }
  }
} catch (error) {
  throw error;
}

export { GOOGLE_MAPS_API_KEY };
