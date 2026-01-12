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

  // Get dimensions after settling
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;

  // Get full scroll height
  const scrollHeight = Math.max(
    document.body.scrollHeight,
    document.body.offsetHeight,
    document.documentElement.scrollHeight,
    document.documentElement.offsetHeight
  );

  console.log("Capture params:", { viewportHeight, scrollHeight, ratio: scrollHeight / viewportHeight });

  const images = [];
  const numCaptures = Math.ceil(scrollHeight / viewportHeight);

  for (let i = 0; i < numCaptures; i++) {
    const scrollY = i * viewportHeight;

    // Don't scroll past the maximum
    const actualScrollY = Math.min(scrollY, scrollHeight - viewportHeight);
    window.scrollTo(0, actualScrollY);
    await delay(200);

    // Wait for any lazy-loaded content
    await delay(100);

    const response = await captureViewport();
    if (response.error) {
      console.error("Capture error at scroll", scrollY, ":", response.error);
      continue;
    }

    const isLast = (i === numCaptures - 1);

    // For the last capture, we might have scrolled less than a full viewport
    // Calculate how much of this capture is "new" content
    let yOffset = 0;
    if (isLast && actualScrollY !== scrollY) {
      // We couldn't scroll as far as we wanted, so part of this image overlaps
      yOffset = scrollY - actualScrollY;
    }

    images.push({
      dataUrl: response.dataUrl,
      index: i,
      scrollY: actualScrollY,
      yOffset: yOffset,
      isLast: isLast
    });

    console.log(`Captured ${i + 1}/${numCaptures} at scrollY=${actualScrollY}, yOffset=${yOffset}`);
  }

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

function captureViewport() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "captureVisibleTab" }, resolve);
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
