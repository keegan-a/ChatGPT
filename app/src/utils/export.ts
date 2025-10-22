export async function exportPreviewAsPng(canvasId: string) {
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
  if (!canvas) {
    throw new Error(`Canvas with id "${canvasId}" not found`);
  }

  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = `${canvasId}-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
  link.click();
}
