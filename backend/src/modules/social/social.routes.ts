import express, { Router, type Request, type RequestHandler, type Response } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../../shared/errors/app-error.js';
import { validateBody } from '../../shared/http/validate.js';
import { detectImageType, MAX_IMAGE_BYTES } from '../../shared/security/image-type.js';
import type { PublicUser } from '../auth/auth.types.js';
import type { ActionResult, PgSocialRepository, StoredImage } from './social.repository.js';
import {
  albumSchema,
  bestFriendSchema,
  communitySchema,
  eventSchema,
  fanSchema,
  feedCommentSchema,
  feedItemSchema,
  messageSchema,
  pollSchema,
  profileSchema,
  replySchema,
  scrapSchema,
  searchSchema,
  settingsSchema,
  slugify,
  statusSchema,
  testimonialSchema,
  topicSchema,
  userTargetSchema,
  uuid,
  voteSchema,
} from './social.schemas.js';
import type { SettingsDto } from './social.types.js';

export interface SocialRouterDeps {
  repository: PgSocialRepository;
  /** Exige sessão e preenche `res.locals.user`. */
  requireAuth: RequestHandler;
}

type Body<T> = T extends ZodType<infer O> ? O : never;

/**
 * API social (todas as rotas exigem sessão). Ações usam POST, como o restante
 * da API (CORS libera só GET/POST); respostas de escrita são 204 e o frontend
 * recarrega o estado com GET /state.
 */
export function createSocialRouter({ repository, requireAuth }: SocialRouterDeps): Router {
  const router = Router();
  router.use(requireAuth);

  const me = (res: Response): string => (res.locals.user as PublicUser).id;
  const done = (res: Response, result: ActionResult = 'ok') => {
    if (result === 'ok') return void res.status(204).end();
    if (result === 'not-found') throw AppError.notFound();
    if (result === 'forbidden') throw AppError.forbidden('Ação disponível apenas entre amigos.');
    throw new AppError(409, 'CONFLICT', 'Isso já foi feito.');
  };
  const param = (req: Request, name: string): string => {
    const parsed = uuid.safeParse(req.params[name]);
    if (!parsed.success) throw AppError.notFound();
    return parsed.data;
  };
  const image = express.raw({ type: ['image/jpeg', 'image/png'], limit: MAX_IMAGE_BYTES });
  const readImage = (req: Request): StoredImage => {
    const data = req.body as unknown;
    if (!Buffer.isBuffer(data) || data.length === 0) {
      throw AppError.badRequest('Envie uma imagem JPG ou PNG de até 5 MB.');
    }
    const mimeType = detectImageType(data);
    if (!mimeType) throw AppError.badRequest('Envie uma imagem JPG ou PNG de até 5 MB.');
    return { mimeType, data };
  };
  const sendImage = (res: Response, stored: StoredImage | null) => {
    if (!stored) throw AppError.notFound();
    res.setHeader('Content-Type', stored.mimeType);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('Content-Disposition', 'inline');
    res.send(stored.data);
  };

  // ── Estado ────────────────────────────────────────────────────────────────
  router.get('/state', async (_req, res) => {
    res.json(await repository.getState(me(res)));
  });

  // ── Perfil ────────────────────────────────────────────────────────────────
  router.post('/profile', validateBody(profileSchema), async (req, res) => {
    await repository.updateProfile(me(res), req.body as Body<typeof profileSchema>);
    done(res);
  });
  router.post('/profile/photo', image, async (req, res) => {
    await repository.setProfilePhoto(me(res), readImage(req));
    done(res);
  });
  router.post('/profile/photo/remove', async (_req, res) => {
    await repository.removeProfilePhoto(me(res));
    done(res);
  });
  router.get('/users/:id/photo', async (req, res) => {
    sendImage(res, await repository.getProfilePhoto(param(req, 'id')));
  });

  router.post('/settings', validateBody(settingsSchema), async (req, res) => {
    const changes = req.body as Body<typeof settingsSchema>;
    const current = await repository.getSettings(me(res));
    const next: SettingsDto = {
      ...current,
      ...changes,
      notifications: { ...current.notifications, ...changes.notifications },
    };
    await repository.updateSettings(me(res), next);
    done(res);
  });

  // ── Pessoas e amizades ────────────────────────────────────────────────────
  router.post('/people/search', validateBody(searchSchema), async (req, res) => {
    const { q } = req.body as Body<typeof searchSchema>;
    res.json({ people: q ? await repository.searchPeople(me(res), q) : [] });
  });
  router.post('/friends/request', validateBody(userTargetSchema), async (req, res) => {
    const { userId } = req.body as Body<typeof userTargetSchema>;
    done(res, await repository.requestFriendship(me(res), userId));
  });
  router.post('/friends/cancel', validateBody(userTargetSchema), async (req, res) => {
    const { userId } = req.body as Body<typeof userTargetSchema>;
    await repository.cancelFriendRequest(me(res), userId);
    done(res);
  });
  router.post('/friends/accept', validateBody(userTargetSchema), async (req, res) => {
    const { userId } = req.body as Body<typeof userTargetSchema>;
    done(res, await repository.acceptFriendRequest(me(res), userId));
  });
  router.post('/friends/reject', validateBody(userTargetSchema), async (req, res) => {
    const { userId } = req.body as Body<typeof userTargetSchema>;
    await repository.rejectFriendRequest(me(res), userId);
    done(res);
  });
  router.post('/friends/remove', validateBody(userTargetSchema), async (req, res) => {
    const { userId } = req.body as Body<typeof userTargetSchema>;
    await repository.removeFriend(me(res), userId);
    done(res);
  });
  router.post('/friends/best', validateBody(bestFriendSchema), async (req, res) => {
    const { userId, best } = req.body as Body<typeof bestFriendSchema>;
    done(res, await repository.setBestFriend(me(res), userId, best));
  });
  router.post('/friends/fan', validateBody(fanSchema), async (req, res) => {
    const { userId, fan } = req.body as Body<typeof fanSchema>;
    done(res, await repository.setFan(me(res), userId, fan));
  });

  // ── Recados ───────────────────────────────────────────────────────────────
  router.post('/scraps', validateBody(scrapSchema), async (req, res) => {
    const { to, text } = req.body as Body<typeof scrapSchema>;
    done(res, await repository.createScrap(me(res), to, text));
  });
  router.post('/scraps/:id/reply', validateBody(replySchema), async (req, res) => {
    const { text } = req.body as Body<typeof replySchema>;
    done(res, await repository.replyToScrap(me(res), param(req, 'id'), text));
  });
  router.post('/scraps/:id/like', async (req, res) => {
    done(res, await repository.toggleScrapLike(me(res), param(req, 'id')));
  });
  router.post('/scraps/:id/read', async (req, res) => {
    await repository.markScrapRead(me(res), param(req, 'id'));
    done(res);
  });
  router.post('/scraps/:id/delete', async (req, res) => {
    done(res, await repository.deleteScrap(me(res), param(req, 'id')));
  });

  // ── Mensagens ─────────────────────────────────────────────────────────────
  router.post('/conversations/:id/messages', validateBody(messageSchema), async (req, res) => {
    const { text } = req.body as Body<typeof messageSchema>;
    done(res, await repository.sendMessage(me(res), param(req, 'id'), text));
  });
  router.post('/conversations/:id/read', async (req, res) => {
    await repository.markConversationRead(me(res), param(req, 'id'));
    done(res);
  });

  // ── Depoimentos ───────────────────────────────────────────────────────────
  router.post('/testimonials', validateBody(testimonialSchema), async (req, res) => {
    const { to, text } = req.body as Body<typeof testimonialSchema>;
    done(res, await repository.writeTestimonial(me(res), to, text));
  });
  router.post('/testimonials/:id/approve', async (req, res) => {
    done(res, await repository.approveTestimonial(me(res), param(req, 'id')));
  });
  router.post('/testimonials/:id/delete', async (req, res) => {
    done(res, await repository.deleteTestimonial(me(res), param(req, 'id')));
  });
  router.post('/testimonials/:id/like', async (req, res) => {
    done(res, await repository.toggleTestimonialLike(me(res), param(req, 'id')));
  });

  // ── Álbuns e fotos ────────────────────────────────────────────────────────
  router.post('/albums', validateBody(albumSchema), async (req, res) => {
    const { title, visibility } = req.body as Body<typeof albumSchema>;
    res.status(201).json({ id: await repository.createAlbum(me(res), title, visibility) });
  });
  router.post('/albums/:id/delete', async (req, res) => {
    done(res, await repository.deleteAlbum(me(res), param(req, 'id')));
  });
  router.post('/albums/:id/photos', image, async (req, res) => {
    done(res, await repository.addPhoto(me(res), param(req, 'id'), readImage(req), ''));
  });
  router.get('/photos/:id', async (req, res) => {
    sendImage(res, await repository.getPhoto(me(res), param(req, 'id')));
  });
  router.post('/photos/:id/delete', async (req, res) => {
    done(res, await repository.deletePhoto(me(res), param(req, 'id')));
  });

  // ── Status e feed ─────────────────────────────────────────────────────────
  router.post('/status', validateBody(statusSchema), async (req, res) => {
    await repository.postStatus(me(res), (req.body as Body<typeof statusSchema>).text);
    done(res);
  });
  router.post('/feed/like', validateBody(feedItemSchema), async (req, res) => {
    await repository.toggleFeedLike(me(res), (req.body as Body<typeof feedItemSchema>).item);
    done(res);
  });
  router.post('/feed/comment', validateBody(feedCommentSchema), async (req, res) => {
    const { item, text } = req.body as Body<typeof feedCommentSchema>;
    await repository.commentOnFeed(me(res), item, text);
    done(res);
  });

  // ── Comunidades ───────────────────────────────────────────────────────────
  router.post('/communities/search', validateBody(searchSchema), async (req, res) => {
    const { q } = req.body as Body<typeof searchSchema>;
    res.json({ communities: await repository.listCommunities(me(res), q) });
  });
  router.post('/communities', validateBody(communitySchema), async (req, res) => {
    const data = req.body as Body<typeof communitySchema>;
    const base = slugify(data.name);
    if (!base) throw AppError.badRequest('Escolha um nome com letras ou números.');
    // Nomes repetidos ganham sufixo numérico até encontrar um slug livre.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const slug = attempt ? `${base}-${attempt + 1}` : base;
      const created = await repository.createCommunity(me(res), { ...data, slug });
      if (created) return void res.status(201).json({ slug: created });
    }
    throw new AppError(409, 'CONFLICT', 'Já existe uma comunidade com esse nome.');
  });
  router.get('/communities/:slug', async (req, res) => {
    const slug = String(req.params.slug);
    if (!/^[a-z0-9-]{1,80}$/.test(slug)) throw AppError.notFound();
    const community = await repository.getCommunity(me(res), slug);
    if (!community) throw AppError.notFound('Comunidade não encontrada.');
    res.json(community);
  });
  router.post('/communities/:id/photo', image, async (req, res) => {
    const result = await repository.setCommunityPhoto(me(res), param(req, 'id'), readImage(req));
    if (result === 'forbidden') throw AppError.forbidden('Só o dono pode trocar a foto.');
    done(res, result);
  });
  router.post('/communities/:id/photo/remove', async (req, res) => {
    const result = await repository.removeCommunityPhoto(me(res), param(req, 'id'));
    if (result === 'forbidden') throw AppError.forbidden('Só o dono pode remover a foto.');
    done(res, result);
  });
  router.get('/communities/:id/photo', async (req, res) => {
    sendImage(res, await repository.getCommunityPhoto(param(req, 'id')));
  });
  router.post('/communities/:id/join', async (req, res) => {
    done(res, await repository.joinCommunity(me(res), param(req, 'id')));
  });
  router.post('/communities/:id/leave', async (req, res) => {
    const result = await repository.leaveCommunity(me(res), param(req, 'id'));
    if (result === 'forbidden') throw AppError.forbidden('O dono não pode sair da comunidade.');
    done(res, result);
  });
  router.post('/communities/:id/topics', validateBody(topicSchema), async (req, res) => {
    const { title } = req.body as Body<typeof topicSchema>;
    const result = await repository.createTopic(me(res), param(req, 'id'), title);
    if (result === 'forbidden') throw AppError.forbidden('Participe da comunidade para publicar.');
    done(res, result);
  });
  router.post('/communities/:id/polls', validateBody(pollSchema), async (req, res) => {
    const { question, options } = req.body as Body<typeof pollSchema>;
    const result = await repository.createPoll(me(res), param(req, 'id'), question, options);
    if (result === 'forbidden') throw AppError.forbidden('Participe da comunidade para publicar.');
    done(res, result);
  });
  router.post('/polls/:id/vote', validateBody(voteSchema), async (req, res) => {
    const { optionIndex } = req.body as Body<typeof voteSchema>;
    const result = await repository.vote(me(res), param(req, 'id'), optionIndex);
    if (result === 'forbidden') throw AppError.forbidden('Participe da comunidade para votar.');
    done(res, result);
  });
  router.post('/communities/:id/events', validateBody(eventSchema), async (req, res) => {
    const data = req.body as Body<typeof eventSchema>;
    const result = await repository.createEvent(me(res), param(req, 'id'), data);
    if (result === 'forbidden') throw AppError.forbidden('Participe da comunidade para publicar.');
    done(res, result);
  });
  router.post('/events/:id/attend', async (req, res) => {
    const result = await repository.toggleEventAttendance(me(res), param(req, 'id'));
    if (result === 'forbidden') throw AppError.forbidden('Participe da comunidade primeiro.');
    done(res, result);
  });

  return router;
}
