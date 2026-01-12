const captureBtn = document.getElementById("captureBtn");
const status = document.getElementById("status");

captureBtn.addEventListener("click", async () => {
  captureBtn.disabled = true;
  status.textContent = "Capturing...";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

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

    status.textContent = "Stitching...";
    await stitchAndDownload(response);
    status.textContent = "Done!";
  } catch (error) {
    console.error(error);
    status.textContent = "Error: " + error.message;
  } finally {
    captureBtn.disabled = false;
  }
});

async function stitchAndDownload({ images, totalHeight, viewportHeight, devicePixelRatio }) {
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

  // Draw each captured image
  for (let i = 0; i < images.length; i++) {
    const imgData = images[i];
    const img = await loadImage(imgData.dataUrl);

    const destY = Math.round(imgData.scrollY * scale);

    if (imgData.isLast) {
      // Last image: only draw the portion we need (from bottom of image)
      const neededHeight = Math.round(imgData.captureHeight * scale);
      const srcY = img.height - neededHeight;

      ctx.drawImage(
        img,
        0, srcY, img.width, neededHeight,  // source
        0, destY, img.width, neededHeight   // destination
      );
    } else {
      // Full viewport capture - draw entire image
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
