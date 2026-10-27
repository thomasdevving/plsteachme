/** Resize and strip metadata locally before an optional profile photo leaves the browser. */
export async function prepareProfilePhoto(file: File): Promise<Blob> {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 5 * 1024 * 1024
  )
    throw new Error("Choose a JPG, PNG or WebP photo up to 5 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (
      !image.naturalWidth ||
      !image.naturalHeight ||
      image.naturalWidth * image.naturalHeight > 25_000_000
    )
      throw new Error("Please choose a smaller photo.");
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser could not prepare this photo.");
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    context.fillStyle = "#faf7f2";
    context.fillRect(0, 0, 256, 256);
    context.drawImage(
      image,
      (image.naturalWidth - side) / 2,
      (image.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      256,
      256,
    );
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(new Error("Please choose another photo.")),
        "image/jpeg",
        0.85,
      ),
    );
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error("Your photo could not be opened.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
