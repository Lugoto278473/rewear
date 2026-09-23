import { supabase, isDemo } from './supabaseClient';

export const BUCKET = 'listing-images';
export const MAX_PHOTOS = 4;

// Demo mode keeps photos in localStorage, which caps out around 5 MB, so it
// gets a smaller size.
const MAX_EDGE = isDemo ? 800 : 1400;

/** Downscale and re-encode to JPEG, so phone photos don't upload at 5+ MB. */
export async function compressImage(file, maxEdge = MAX_EDGE, quality = 0.82) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(`Couldn't read "${file.name}". Try a JPEG or PNG.`);
  }

  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not process image.'))),
      'image/jpeg',
      quality
    )
  );
}

/** Uploads to `<userId>/…` (the storage policy requires it) and returns public URLs in order. */
export function uploadListingPhotos(userId, files) {
  const stamp = Date.now();
  return Promise.all(
    files.map(async (file, i) => {
      const blob = await compressImage(file);
      const path = `${userId}/${stamp}-${i}.jpg`;
      const bucket = supabase.storage.from(BUCKET);
      const { error } = await bucket.upload(path, blob, { contentType: 'image/jpeg' });
      if (error) throw error;
      return bucket.getPublicUrl(path).data.publicUrl;
    })
  );
}
