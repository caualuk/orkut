import { describe, expect, it } from 'vitest';
import { classifyHealthFailure, databaseHostKind } from '../../src/shared/http/health-failure.js';

describe('classifyHealthFailure', () => {
  it.each([
    [{ code: 'SELF_SIGNED_CERT_IN_CHAIN', message: 'self-signed certificate' }, 'tls'],
    [{ code: '28P01', message: 'password authentication failed for user "postgres"' }, 'auth'],
    [{ code: 'XX000', message: 'Tenant or user not found' }, 'auth'],
    [{ code: 'ENETUNREACH', message: 'connect ENETUNREACH 2600:1f18::1:5432' }, 'network'],
    [{ code: 'ENOTFOUND', message: 'getaddrinfo ENOTFOUND host' }, 'network'],
    [new Error('timeout exceeded when trying to connect'), 'timeout'],
    [new Error('algo inesperado'), 'unknown'],
  ])('classifica %j como %s', (error, expected) => {
    expect(classifyHealthFailure(error)).toBe(expected);
  });
});

describe('databaseHostKind', () => {
  it.each([
    ['postgresql://u:p@aws-1-sa-east-1.pooler.supabase.com:6543/postgres', 'pooler'],
    ['postgresql://postgres:p@db.abc.supabase.co:5432/postgres', 'direta'],
    ['postgresql://u:p@localhost:5432/test', 'outra'],
  ])('identifica %s', (url, expected) => {
    expect(databaseHostKind(url)).toBe(expected);
  });
});
