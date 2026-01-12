const captureBtn = document.getElementById("captureBtn");
const status = document.getElementById("status");

captureBtn.addEventListener("click", async () => {
  captureBtn.disabled = true;
  status.textContent = "Capturing...";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

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

async function stitchAndDownload({ images, totalHeight, viewportHeight }) {
  const firstImg = await loadImage(images[0].dataUrl);
  const width = firstImg.width;
  const scale = firstImg.height / viewportHeight;
  const height = Math.ceil(totalHeight * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  for (const img of images) {
    const image = await loadImage(img.dataUrl);
    const y = Math.round(img.y * scale);
    const drawHeight = Math.round(img.height * scale);
    ctx.drawImage(image, 0, 0, width, drawHeight, 0, y, width, drawHeight);
  }

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
