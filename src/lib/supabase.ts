import { createClient } from '@supabase/supabase-js';
import { clientEnv } from './env.client';

export const supabase = createClient(clientEnv.supabaseUrl, clientEnv.supabaseAnonKey);

// ── 타입 정의 ──────────────────────────────────────────────

export interface CoverLetterRef {
  id: string;
  company_name: string;
  recruitment_notice: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CoverLetterRefUrl {
  id: string;
  ref_id: string;
  title: string;
  url: string;
  sort_order: number;
  created_at: string;
}

export interface CoverLetterQuestion {
  id: string;
  ref_id: string;
  question: string;
  char_limit: number | null;
  answer: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}
