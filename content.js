chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "takeScreenshot") {
    captureFullPage().then(sendResponse);
    return true;
  }
});

async function captureFullPage() {
  const { scrollHeight, clientHeight } = document.documentElement;
  const originalScrollY = window.scrollY;
  const images = [];

  // Hide scrollbars during capture
  const originalOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = "hidden";

  let currentY = 0;

  while (currentY < scrollHeight) {
    window.scrollTo(0, currentY);
    await delay(150);

    const response = await captureViewport();
    if (response.error) {
      console.error("Capture error:", response.error);
      break;
    }

    images.push({
      dataUrl: response.dataUrl,
      y: currentY,
      height: Math.min(clientHeight, scrollHeight - currentY)
    });

    currentY += clientHeight;
  }

  // Restore original state
  document.documentElement.style.overflow = originalOverflow;
  window.scrollTo(0, originalScrollY);

  return { images, totalHeight: scrollHeight, viewportHeight: clientHeight };
}

function captureViewport() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "captureVisibleTab" }, resolve);
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
