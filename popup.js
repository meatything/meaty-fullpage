const captureBtn = document.getElementById("captureBtn");
const status = document.getElementById("status");

captureBtn.addEventListener("click", async () => {
  captureBtn.disabled = true;
  status.textContent = "Capturing...";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Check for restricted URLs
    if (tab.url.startsWith("chrome://") ||
        tab.url.startsWith("chrome-extension://") ||
        tab.url.startsWith("edge://") ||
        tab.url.startsWith("about:")) {
      throw new Error("Cannot capture browser pages");
    }

    // Inject content script if not already loaded
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"]
    });

    await new Promise(r => setTimeout(r, 100));

    const response = await chrome.tabs.sendMessage(tab.id, { action: "takeScreenshot" });

    if (!response || !response.images || response.images.length === 0) {
      throw new Error("No images captured");
    }

    console.log("Received", response.images.length, "images, totalHeight:", response.totalHeight);

    status.textContent = `Stitching ${response.images.length} images...`;
    await stitchAndDownload(response);
    status.textContent = "Done!";
  } catch (error) {
    console.error(error);
    status.textContent = "Error: " + error.message;
  } finally {
    captureBtn.disabled = false;
  }
});

async function stitchAndDownload({ images, totalHeight, viewportHeight }) {
  // Load first image to get actual pixel dimensions
  const firstImg = await loadImage(images[0].dataUrl);
  const imgWidth = firstImg.width;
  const imgHeight = firstImg.height;

  // Calculate scale (captured image pixels per CSS pixel)
  const scale = imgHeight / viewportHeight;

  // Create canvas for full page
  const canvasHeight = Math.round(totalHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = imgWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext("2d");

  console.log("Canvas:", imgWidth, "x", canvasHeight, "scale:", scale);

  // Draw each captured image
  for (let i = 0; i < images.length; i++) {
    const imgData = images[i];
    const img = await loadImage(imgData.dataUrl);

    // Calculate destination Y based on index (simple sequential placement)
    const destY = i * imgHeight;

    if (imgData.isLast) {
      // Last image: only draw the non-overlapping portion
      const yOffsetPixels = Math.round(imgData.yOffset * scale);
      const drawHeight = img.height - yOffsetPixels;
      const srcY = yOffsetPixels;
      const actualDestY = canvasHeight - drawHeight;

      console.log(`Image ${i}: last, srcY=${srcY}, destY=${actualDestY}, height=${drawHeight}`);

      ctx.drawImage(
        img,
        0, srcY, img.width, drawHeight,
        0, actualDestY, img.width, drawHeight
      );
    } else {
      // Regular capture - draw full image
      console.log(`Image ${i}: destY=${destY}`);
      ctx.drawImage(img, 0, destY);
    }
  }

  // Download
  const link = document.createElement("a");
  link.download = `fullpage-${Date.now()}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}
