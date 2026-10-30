import { isYouTubeId, parseYouTubeId, youTubeEmbedUrl, youTubeLink } from './profile-music';

describe('profile-music', () => {
  const ID = 'dQw4w9WgXcQ';

  it('extrai o id dos formatos de link do YouTube', () => {
    for (const link of [
      `https://www.youtube.com/watch?v=${ID}&t=10s`,
      `https://m.youtube.com/watch?v=${ID}`,
      `https://music.youtube.com/watch?v=${ID}`,
      `https://youtu.be/${ID}?si=abc`,
      `https://www.youtube.com/shorts/${ID}`,
      `https://www.youtube.com/embed/${ID}`,
      `https://www.youtube.com/live/${ID}`,
      `  ${youTubeLink(ID)}  `,
    ]) {
      expect(parseYouTubeId(link)).toBe(ID);
    }
  });

  it('recusa links que não são vídeos do YouTube', () => {
    for (const link of [
      '',
      'não é link',
      ID,
      `https://evil.example/watch?v=${ID}`,
      `https://youtube.com.evil.example/watch?v=${ID}`,
      `javascript:alert('https://youtu.be/${ID}')`,
      'https://www.youtube.com/watch?v=curto',
      'https://www.youtube.com/watch?v=%22%3E%3Cscript%3E11',
      'https://www.youtube.com/playlist?list=abc',
    ]) {
      expect(parseYouTubeId(link)).toBeNull();
    }
  });

  it('só monta a URL do player sem cookies de rastreamento', () => {
    expect(isYouTubeId(ID)).toBe(true);
    expect(isYouTubeId('../../evil?')).toBe(false);
    expect(youTubeEmbedUrl(ID)).toBe(
      `https://www.youtube-nocookie.com/embed/${ID}?autoplay=1&rel=0`,
    );
  });
});
