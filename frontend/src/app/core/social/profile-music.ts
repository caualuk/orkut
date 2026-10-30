/** Id de vídeo do YouTube: 11 caracteres de URL segura. */
const VIDEO_ID = /^[\w-]{11}$/;
const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

/**
 * Extrai o id do vídeo de um link do YouTube (`watch?v=`, `youtu.be/`, `shorts/`,
 * `embed/`, `live/`). Devolve `null` para qualquer outra coisa: só esse id validado
 * entra na URL do player.
 */
export function parseYouTubeId(link: string): string | null {
  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

  const [first, second] = url.pathname.split('/').filter(Boolean);
  const id =
    url.hostname === 'youtu.be'
      ? first
      : !YOUTUBE_HOSTS.has(url.hostname)
        ? undefined
        : first === 'watch'
          ? url.searchParams.get('v')
          : first && ['shorts', 'embed', 'live'].includes(first)
            ? second
            : undefined;
  return id && VIDEO_ID.test(id) ? id : null;
}

export const isYouTubeId = (value: string): boolean => VIDEO_ID.test(value);

export const youTubeLink = (videoId: string): string => `https://youtu.be/${videoId}`;

/** Player sem cookies de rastreamento, começando a tocar (só após o clique do usuário). */
export const youTubeEmbedUrl = (videoId: string): string =>
  `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0`;
