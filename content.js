chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "takeScreenshot") {
    captureFullPage().then(sendResponse).catch(err => {
      console.error("Capture failed:", err);
      sendResponse({ error: err.message });
    });
    return true;
  }
});

async function captureFullPage() {
  const originalScrollY = window.scrollY;
  const originalOverflow = document.documentElement.style.overflow;
  const originalScrollBehavior = document.documentElement.style.scrollBehavior;

  // Disable smooth scrolling and hide scrollbars
  document.documentElement.style.scrollBehavior = "auto";
  document.documentElement.style.overflow = "hidden";
  document.body.style.scrollBehavior = "auto";

  // Scroll to top first
  window.scrollTo(0, 0);
  await delay(300);

  const viewportHeight = window.innerHeight;
  const scrollHeight = Math.max(
    document.body.scrollHeight,
    document.body.offsetHeight,
    document.documentElement.scrollHeight,
    document.documentElement.offsetHeight
  );

  const images = [];
  const numCaptures = Math.ceil(scrollHeight / viewportHeight);
  const hiddenElements = [];

  console.log("Capture params:", { viewportHeight, scrollHeight, numCaptures });

  for (let i = 0; i < numCaptures; i++) {
    const scrollY = i * viewportHeight;
    const actualScrollY = Math.min(scrollY, scrollHeight - viewportHeight);

    window.scrollTo(0, actualScrollY);
    await delay(150);

    // After first capture, find and hide ALL fixed/sticky elements
    if (i === 1) {
      const fixed = findFixedElements();
      console.log("Found fixed elements:", fixed.length);

      fixed.forEach(el => {
        // Store original display
        hiddenElements.push({ el, display: el.style.display });
        // Use display:none to completely remove from layout
        el.style.setProperty("display", "none", "important");
      });
      await delay(100);
    }

    const response = await captureViewport();
    if (response.error) {
      console.error("Capture error:", response.error);
      continue;
    }

    const isLast = (i === numCaptures - 1);
    let yOffset = 0;
    if (isLast && actualScrollY !== scrollY) {
      yOffset = scrollY - actualScrollY;
    }

    images.push({
      dataUrl: response.dataUrl,
      index: i,
      scrollY: actualScrollY,
      yOffset: yOffset,
      isLast: isLast
    });

    console.log(`Captured ${i + 1}/${numCaptures}`);
  }

  // Restore hidden elements
  hiddenElements.forEach(({ el, display }) => {
    el.style.display = display;
  });

  // Restore original state
  document.documentElement.style.overflow = originalOverflow;
  document.documentElement.style.scrollBehavior = originalScrollBehavior;
  document.body.style.scrollBehavior = "";
  window.scrollTo(0, originalScrollY);

  return {
    images,
    totalHeight: scrollHeight,
    viewportHeight: viewportHeight,
    numCaptures: numCaptures
  };
}

function findFixedElements() {
  const fixed = [];
  const all = document.querySelectorAll("*");

  for (const el of all) {
    const style = window.getComputedStyle(el);
    const position = style.position;

    if (position === "fixed" || position === "sticky") {
      const rect = el.getBoundingClientRect();
      // Elements at top of viewport (headers, nav bars, banners)
      if (rect.top < 200 && rect.height > 10 && rect.width > 100) {
        fixed.push(el);
        console.log("Fixed element:", el.tagName, el.className, rect.top, rect.height);
      }
    }
  }

  return fixed;
}

function captureViewport() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "captureVisibleTab" }, resolve);
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
