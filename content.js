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

  // Scroll to top first and wait for any lazy content
  window.scrollTo(0, 0);
  await delay(300);

  // Find and track fixed/sticky elements
  const fixedElements = findFixedElements();
  const originalStyles = new Map();

  // Store original styles
  fixedElements.forEach(el => {
    originalStyles.set(el, {
      visibility: el.style.visibility,
      position: el.style.position
    });
  });

  // Get dimensions after settling
  const viewportHeight = window.innerHeight;

  // Get full scroll height
  const scrollHeight = Math.max(
    document.body.scrollHeight,
    document.body.offsetHeight,
    document.documentElement.scrollHeight,
    document.documentElement.offsetHeight
  );

  console.log("Capture params:", { viewportHeight, scrollHeight, fixedElements: fixedElements.length });

  const images = [];
  const numCaptures = Math.ceil(scrollHeight / viewportHeight);

  for (let i = 0; i < numCaptures; i++) {
    // Hide fixed elements before second capture (first capture keeps header)
    if (i === 1) {
      fixedElements.forEach(el => {
        el.style.visibility = "hidden";
      });
      await delay(50);
    }

    const scrollY = i * viewportHeight;

    // Don't scroll past the maximum
    const actualScrollY = Math.min(scrollY, scrollHeight - viewportHeight);
    window.scrollTo(0, actualScrollY);
    await delay(150);

    const response = await captureViewport();
    if (response.error) {
      console.error("Capture error at scroll", scrollY, ":", response.error);
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

    console.log(`Captured ${i + 1}/${numCaptures} at scrollY=${actualScrollY}`);
  }

  // Restore fixed elements
  fixedElements.forEach(el => {
    const orig = originalStyles.get(el);
    if (orig) {
      el.style.visibility = orig.visibility;
    }
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
    const rect = el.getBoundingClientRect();

    // Find elements that are fixed or sticky and near the top
    if ((position === "fixed" || position === "sticky") && rect.top < 100 && rect.height > 20) {
      fixed.push(el);
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
