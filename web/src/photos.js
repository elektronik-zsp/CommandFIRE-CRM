// Photos are resized in the browser before upload: a full image (max 1600 px) and a thumbnail.
export const MAX_PHOTOS = 8;
export const MAX_PHOTO_BYTES = 4.2 * 1024 * 1024; // all photos of one entry; the API request limit is 6 MB

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Nie można odczytać zdjęcia „${file.name}”. Użyj formatu JPG lub PNG.`)); };
    img.src = url;
  });
}

function toJpeg(img, max, quality) {
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.round(img.naturalWidth * scale);
  const height = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; // transparent PNGs
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return { data: canvas.toDataURL('image/jpeg', quality).split(',')[1], width, height };
}

/** → { filename, data, thumb, width, height, preview, bytes } (data/thumb = base64 JPEG) */
export async function preparePhoto(file) {
  if (!file.type.startsWith('image/')) throw new Error(`„${file.name}” nie jest zdjęciem`);
  const { img, url } = await loadImage(file);
  try {
    const full = toJpeg(img, 1600, 0.82);
    const thumb = toJpeg(img, 360, 0.7);
    return {
      filename: file.name, data: full.data, thumb: thumb.data, width: full.width, height: full.height,
      preview: `data:image/jpeg;base64,${thumb.data}`, bytes: Math.round((full.data.length + thumb.data.length) * 0.75),
    };
  } finally { URL.revokeObjectURL(url); }
}
