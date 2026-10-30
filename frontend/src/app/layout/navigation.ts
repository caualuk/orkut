/**
 * Itens de navegação das telas internas, compartilhados entre Top App Bar,
 * Navigation Rail, Navigation Bar, menu lateral e Navigation Drawer.
 */
export interface NavItem {
  label: string;
  link: string;
  icon: string;
  /** Contador exibido no item (recados/mensagens não lidos, fotos…). */
  counter?: 'scraps' | 'messages' | 'photos';
  exact?: boolean;
}

/** Navegação principal (Top App Bar em pílulas, desktop). */
export const PRIMARY_NAV: NavItem[] = [
  { label: 'Início', link: '/home', icon: 'home', exact: true },
  { label: 'Perfil', link: '/perfil/editar', icon: 'person' },
  { label: 'Recados', link: '/recados', icon: 'mail' },
  { label: 'Amigos', link: '/amigos', icon: 'sentiment_satisfied' },
  { label: 'Comunidades', link: '/comunidades', icon: 'auto_awesome' },
];

/** Menu do perfil (coluna lateral no desktop, drawer no tablet/mobile). */
export const PROFILE_MENU: NavItem[][] = [
  [
    { label: 'Perfil', link: '/home', icon: 'person', exact: true },
    { label: 'Recados', link: '/recados', icon: 'mail', counter: 'scraps' },
    { label: 'Álbum', link: '/album', icon: 'photo_library', counter: 'photos' },
  ],
  [
    { label: 'Feeds', link: '/feeds', icon: 'menu' },
    { label: 'Mensagens', link: '/mensagens', icon: 'auto_awesome', counter: 'messages' },
    { label: 'Depoimentos', link: '/depoimentos', icon: 'favorite' },
    { label: 'Configurações', link: '/configuracoes', icon: 'settings' },
  ],
];

/** Navigation Rail (tablet). "Mais" abre o drawer com o restante do menu. */
export const RAIL_NAV: NavItem[] = [
  { label: 'Início', link: '/home', icon: 'home', exact: true },
  { label: 'Recados', link: '/recados', icon: 'mail', counter: 'scraps' },
  { label: 'Amigos', link: '/amigos', icon: 'sentiment_satisfied' },
  { label: 'Grupos', link: '/comunidades', icon: 'auto_awesome' },
  { label: 'Mensagens', link: '/mensagens', icon: 'chat_bubble', counter: 'messages' },
];

/** Navigation Bar inferior (mobile). "Menu" abre o drawer. */
export const BOTTOM_NAV: NavItem[] = [
  { label: 'Início', link: '/home', icon: 'home', exact: true },
  { label: 'Recados', link: '/recados', icon: 'mail', counter: 'scraps' },
  { label: 'Amigos', link: '/amigos', icon: 'sentiment_satisfied' },
  { label: 'Comunidades', link: '/comunidades', icon: 'auto_awesome' },
];

export const FOOTER_LINKS = [
  'Sobre o orkut',
  'Novidades',
  'Centro de segurança',
  'Privacidade',
  'Termos de uso',
  'Ajuda',
];
