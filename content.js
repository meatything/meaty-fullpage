chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "takeScreenshot") {
    captureFullPage().then(sendResponse);
    return true;
  }
});

async function captureFullPage() {
  const originalScrollY = window.scrollY;
  const originalOverflow = document.documentElement.style.overflow;

  // Hide scrollbars during capture
  document.documentElement.style.overflow = "hidden";

  // Get dimensions after hiding scrollbar
  await delay(50);
  const scrollHeight = Math.max(
    document.body.scrollHeight,
    document.documentElement.scrollHeight
  );
  const viewportHeight = window.innerHeight;
  const devicePixelRatio = window.devicePixelRatio || 1;

  const images = [];
  let scrollY = 0;

  // Scroll to top first
  window.scrollTo(0, 0);
  await delay(100);

  while (scrollY < scrollHeight) {
    const response = await captureViewport();
    if (response.error) {
      console.error("Capture error:", response.error);
      break;
    }

    const isLastCapture = scrollY + viewportHeight >= scrollHeight;
    const captureHeight = isLastCapture ? (scrollHeight - scrollY) : viewportHeight;

    images.push({
      dataUrl: response.dataUrl,
      scrollY: scrollY,
      captureHeight: captureHeight,
      isLast: isLastCapture
    });

    if (!isLastCapture) {
      scrollY += viewportHeight;
      window.scrollTo(0, scrollY);
      await delay(150);
    } else {
      break;
    }
  }

  // Restore original state
  document.documentElement.style.overflow = originalOverflow;
  window.scrollTo(0, originalScrollY);

  return {
    images,
    totalHeight: scrollHeight,
    viewportHeight: viewportHeight,
    devicePixelRatio: devicePixelRatio
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
