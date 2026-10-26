/// <reference types="vite/client" />
/**
 * Cliente Supabase do VitrineX.
 * Analogia: a URL é o endereço da loja; a anon key é a chave da vitrine (pública).
 * A RLS no Postgres é o segurança — cada usuário só vê as próprias prateleiras.
 *
 * Docs: https://supabase.com/docs/reference/javascript/initializing
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const rawUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const rawKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

const looksLikePlaceholder =
  !rawUrl ||
  !rawKey ||
  rawUrl.includes('sua-url') ||
  rawUrl.includes('placeholder') ||
  rawKey.includes('sua-chave') ||
  rawKey.includes('placeholder');

export const isSupabaseConfigured = !looksLikePlaceholder;

const supabaseUrl = isSupabaseConfigured ? rawUrl : 'https://placeholder.supabase.co';
const supabaseAnonKey = isSupabaseConfigured ? rawKey : 'placeholder-key';

const authRedirect =
  (import.meta.env.VITE_AUTH_REDIRECT_URI || '').trim() ||
  (typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1:8080');

if (!isSupabaseConfigured) {
  console.warn('⚠️ SUPABASE NÃO CONFIGURADO');
  console.warn('📋 Guia: docs/SUPABASE_SETUP.md');
  console.warn('   VITE_SUPABASE_URL=https://xxxxx.supabase.co');
  console.warn('   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...');
  console.warn('🔒 App em modo demonstração (login mock).');
} else {
  console.log('✅ Supabase configurado:', supabaseUrl);
}

export const supabase: SupabaseClient<Database> = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'implicit',
    },
  }
);

export const getAuthRedirectTo = (): string => authRedirect;

/** Testa se a API responde (útil em Configurações). */
export async function probeSupabase(): Promise<{ ok: boolean; detail: string }> {
  if (!isSupabaseConfigured) {
    return { ok: false, detail: 'Variáveis VITE_SUPABASE_* ausentes no .env' };
  }
  try {
    const { error } = await supabase.from('users').select('id', { count: 'exact', head: true });
    // Sem sessão, RLS pode negar — mas 401/PGRST ≠ rede caída
    if (error && /Failed to fetch|NetworkError|ENOTFOUND/i.test(error.message)) {
      return { ok: false, detail: error.message };
    }
    return {
      ok: true,
      detail: error
        ? `API ok (${error.code || 'RLS/auth'}): rode o SQL e faça login`
        : 'API e tabela users acessíveis',
    };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}
