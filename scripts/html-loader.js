// Fetches HTML content from a given URL
async function fetchHTML(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load ${url}: ${response.status}`);
    }
    return await response.text();
  } catch (error) {
    console.error(`Error loading HTML from ${url}:`, error);
    return "";
  }
}

// Loads all HTML includes for elements with data-include attribute
async function loadHTMLIncludes(container = document) {
  const elements = container.querySelectorAll("[data-include]");

  const loadPromises = Array.from(elements).map(async (element) => {
    const url = element.getAttribute("data-include");
    if (url) {
      const html = await fetchHTML(url);
      element.innerHTML = html;
      // Remove the data-include attribute after loading
      element.removeAttribute("data-include");

      // Recursively load any nested includes
      await loadHTMLIncludes(element);
    }
  });

  await Promise.all(loadPromises);
}

// Loads sidebar components from the sidebar.html file
async function loadSidebarComponents() {
  // Load combined sidebar container
  const sidebarContainer = document.getElementById("sidebar-container");
  if (sidebarContainer && sidebarContainer.hasAttribute("data-include")) {
    const html = await fetchHTML(sidebarContainer.getAttribute("data-include"));
    sidebarContainer.innerHTML = html;
    sidebarContainer.removeAttribute("data-include");

    // Now load all submenu includes within the sidebar container
    await loadHTMLIncludes(sidebarContainer);
  }
}

// Initializes the HTML loader by loading sidebar and other includes
async function initHTMLLoader() {
  try {
    await loadSidebarComponents();

    // Load all modal and other HTML includes
    await loadHTMLIncludes();

    // Dispatch custom event when all HTML is loaded
    document.dispatchEvent(new CustomEvent("htmlIncludesLoaded"));

    console.log("HTML includes loaded successfully");
  } catch (error) {
    console.error("Error initializing HTML loader:", error);
  }
}

// Export for module usage
export { initHTMLLoader, loadHTMLIncludes, fetchHTML };
