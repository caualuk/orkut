export type HealthFailure = 'tls' | 'auth' | 'network' | 'timeout' | 'unknown';

/**
 * Categoria da falha do health check, para diagnosticar o deploy sem abrir os
 * logs. Só a categoria é pública: mensagem, host e usuário ficam no log.
 */
export function classifyHealthFailure(error: unknown): HealthFailure {
  const { code, message } = error as { code?: unknown; message?: unknown };
  const text = `${String(code ?? '')} ${String(message ?? '')}`.toLowerCase();

  if (/self.signed|cert|ssl|tls/.test(text)) return 'tls';
  if (/28p01|authentication failed|tenant or user not found/.test(text)) return 'auth';
  if (/timeout|etimedout/.test(text)) return 'timeout';
  if (/enotfound|enetunreach|econnrefused|econnreset|eai_again|ehostunreach/.test(text)) {
    return 'network';
  }
  return 'unknown';
}

/** Tipo de conexão configurada (sem expor o host): na Vercel precisa ser `pooler`. */
export function databaseHostKind(url: string): 'pooler' | 'direta' | 'outra' {
  const { hostname } = new URL(url);
  if (hostname.endsWith('.pooler.supabase.com')) return 'pooler';
  return /^db\..+\.supabase\.co$/.test(hostname) ? 'direta' : 'outra';
}
