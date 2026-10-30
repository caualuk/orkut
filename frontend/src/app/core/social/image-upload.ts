/** Acima disso a Vercel recusa a requisição (limite de 4,5 MB por função). */
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_DIMENSION = 1920;

/**
 * Reduz no navegador as imagens grandes demais para enviar à API (JPEG, até
 * 1920px). Imagens pequenas seguem intactas; se o navegador não conseguir
 * processar, envia o arquivo original e a API decide.
 */
export async function prepareImageUpload(file: File): Promise<File> {
  if (file.size <= MAX_UPLOAD_BYTES) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85),
    );
    return blob ? new File([blob], 'foto.jpg', { type: 'image/jpeg' }) : file;
  } catch {
    return file;
  }
}
