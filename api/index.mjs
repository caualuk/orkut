/**
 * Serverless Function da Vercel: serve toda a API (`/api/*`, ver `vercel.json`).
 *
 * Reaproveita a app Express compilada pelo build do backend (`backend/dist`); a
 * instância e o pool de conexões ficam vivos entre invocações da mesma função.
 */
import { bootstrap } from '../backend/dist/bootstrap.js';

const { app } = bootstrap();

export default app;
