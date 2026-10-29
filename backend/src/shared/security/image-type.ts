/** Tipos de imagem aceitos no upload (fotos de perfil e de álbum). */
export type ImageMimeType = 'image/jpeg' | 'image/png';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Identifica a imagem pelos bytes iniciais (magic bytes), sem confiar no
 * Content-Type enviado pelo cliente. Retorna `null` se não for JPEG nem PNG.
 */
export function detectImageType(data: Buffer): ImageMimeType | null {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return 'image/jpeg';
  }
  if (data.length >= PNG_SIGNATURE.length && data.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return 'image/png';
  }
  return null;
}
