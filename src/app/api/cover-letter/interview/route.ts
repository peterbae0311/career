import { NextRequest, NextResponse } from 'next/server';
import { serverEnv } from '@/lib/env.server';
import { supabase } from '@/lib/supabase';

const OR_URL   = 'https://openrouter.ai/api/v1/chat/completions';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const OR_MODELS = [
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'openai/gpt-oss-120b:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'nousresearch/hermes-3-llama-3.1-405b:free',
];
const GROQ_MODEL = 'llama-3.3-70b-versatile';

type Difficulty = 'high' | 'medium' | 'low';

// 난이도별 sort_order 오프셋 (high→0, medium→10, low→20)
const DIFF_OFFSET: Record<Difficulty, number> = { high: 0, medium: 10, low: 20 };

const DIFF_LABEL: Record<Difficulty, string> = {
  high:   '상(고급) — 심층 직무·기술·전략 질문',
  medium: '중(중급) — 경험·역량·직무이해 질문',
  low:    '하(기초) — 자기소개·지원동기·기본인성 질문',
};

function extractJson(text: string): unknown[] | null {
  const cleaned = text.replace(/```(?:json)?\n?/g, '').replace(/```/g, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { return null; }
    }
    return null;
  }
}

async function fetchText(url: string, headers: Record<string, string>, body: object): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.choices?.[0]?.message?.content ?? '').trim() || null;
  } catch {
    return null;
  }
}

function toStrArr(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String) : [];
}

function mapRaw(q: Record<string, unknown>, diff: Difficulty, i: number) {
  return {
    difficulty:    diff,
    sort_order:    DIFF_OFFSET[diff] + i,
    question:      String(q.question ?? ''),
    follow_ups:    toStrArr(q.follow_ups),
    purpose:       String(q.purpose ?? ''),
    competency:    String(q.competency ?? ''),
    intent:        String(q.intent ?? ''),
    good_points:   toStrArr(q.good_points),
    avoid:         toStrArr(q.avoid),
    mistakes:      toStrArr(q.mistakes),
    sample_answer: String(q.sample_answer ?? ''),
  };
}

async function generateForDifficulty(
  diff: Difficulty,
  messages: { role: string; content: string }[],
): Promise<ReturnType<typeof mapRaw>[]> {
  let text: string | null = null;

  if (serverEnv.openrouterApiKey) {
    for (const model of OR_MODELS) {
      text = await fetchText(OR_URL, { Authorization: `Bearer ${serverEnv.openrouterApiKey}` }, {
        model, max_tokens: 4000, messages,
      });
      if (text) break;
    }
  }

  if (!text && serverEnv.groqApiKey) {
    text = await fetchText(GROQ_URL, { Authorization: `Bearer ${serverEnv.groqApiKey}` }, {
      model: GROQ_MODEL, max_tokens: 4000, temperature: 0.7, messages,
    });
  }

  if (!text) return [];
  const raw = extractJson(text);
  if (!raw) return [];

  return (raw as Record<string, unknown>[]).slice(0, 10).map((q, i) => mapRaw(q, diff, i));
}

export async function POST(request: NextRequest) {
  if (!serverEnv.openrouterApiKey && !serverEnv.groqApiKey) {
    return NextResponse.json({ error: 'AI 기능을 사용하려면 .env에 API 키를 설정해주세요.' }, { status: 501 });
  }

  const {
    ref_id,
    company_name,
    recruitment_notice,
    notes,
    urls,
    cover_letter_questions,
    difficulty,
  } = await request.json();

  const contextParts: string[] = [];
  if (company_name)       contextParts.push(`회사/기관명: ${company_name}`);
  if (recruitment_notice) contextParts.push(`모집 요강:\n${recruitment_notice}`);
  if (notes)              contextParts.push(`기타 사항:\n${notes}`);
  if (urls?.length)       contextParts.push(`참고 URL:\n${(urls as { title: string; url: string }[]).map(u => `- ${u.title}: ${u.url}`).join('\n')}`);
  if (cover_letter_questions?.length) {
    contextParts.push(`자기소개서 문항:\n${(cover_letter_questions as string[]).map((q, i) => `${i + 1}. ${q}`).join('\n')}`);
  }

  const systemPrompt = `당신은 수천 건의 실제 면접 사례와 채용 프로세스를 분석한 전문 면접관입니다.
사용자가 제공하는 정보를 기반으로 실제 기업 면접에서 나올 가능성이 높은 질문을 생성합니다.
반드시 순수 JSON 배열만 출력합니다. 마크다운·설명·코드블록 없이 JSON 배열만 반환하세요.
오직 한국어로만 작성합니다.`;

  const makeMessages = (diff: Difficulty) => [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `다음 정보를 바탕으로 난이도 "${DIFF_LABEL[diff]}" 면접 예상 질문 10개를 생성하세요.

## 회사/기관 정보
${contextParts.join('\n\n') || '(정보 없음)'}

## 질문 유형 (균형 있게 포함)
자기소개, 지원동기, 인성, 직무, 기술, 상황(Situational), 행동(Behavioral), STAR기반, 문제해결, 리더십, 협업, 갈등해결, 커뮤니케이션, 실패경험, 성과경험, 가치관, 기업이해, 최신산업이슈, 압박면접

## 수행 원칙
- 실제 면접관이 사용할 법한 자연스러운 표현을 사용합니다.
- 추상적이거나 중복되는 질문은 피합니다.
- 입력 정보와 관련성이 높은 질문을 우선합니다.
- 단순 암기형보다 사고력·경험을 평가하는 질문을 우선합니다.
- sample_answer는 반드시 4문장 이상으로 작성하며, STAR 기법(상황·과제·행동·결과)을 자연스럽게 녹여 구체적이고 진정성 있게 작성합니다.

## 출력 형식 (JSON 배열만)
[
  {
    "question": "질문 내용",
    "follow_ups": ["꼬리질문1", "꼬리질문2", "꼬리질문3"],
    "purpose": "이 질문의 목적",
    "competency": "평가 역량",
    "intent": "면접관의 의도",
    "good_points": ["좋은 답변 포인트1", "좋은 답변 포인트2"],
    "avoid": ["피해야 할 답변1"],
    "mistakes": ["자주 하는 실수1"],
    "sample_answer": "모범 답변 예시 (최소 4문장 이상, STAR 기법 포함)"
  }
]`,
    },
  ];

  const difficulties: Difficulty[] = difficulty === 'all' ? ['high', 'medium', 'low'] : [difficulty as Difficulty];

  // AI 생성 — 순차 실행 (병렬 시 Groq TPM 한도 초과로 중간 난이도 누락 방지)
  const generated: ReturnType<typeof mapRaw>[] = [];
  for (const diff of difficulties) {
    const result = await generateForDifficulty(diff, makeMessages(diff));
    generated.push(...result);
  }

  if (!ref_id || generated.length === 0) {
    return NextResponse.json({ questions: generated.map((q, i) => ({ ...q, id: `tmp-${i}` })) });
  }

  // DB 저장: 해당 난이도 기존 데이터 삭제 후 신규 삽입
  // Supabase 쿼리 빌더는 immutable — 분기별로 별도 체인 사용
  if (difficulty === 'all') {
    await supabase.from('interview_questions').delete().eq('ref_id', ref_id);
  } else {
    await supabase.from('interview_questions').delete().eq('ref_id', ref_id).eq('difficulty', difficulty);
  }

  const toInsert = generated.map(q => ({ ref_id, ...q }));
  const { data: saved, error } = await supabase
    .from('interview_questions')
    .insert(toInsert)
    .select();

  if (error || !saved) {
    console.error('[interview] DB 저장 오류:', error);
    return NextResponse.json({ questions: generated.map((q, i) => ({ ...q, id: `tmp-${i}` })) });
  }

  return NextResponse.json({ questions: saved });
}
