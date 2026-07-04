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

export async function POST(request: NextRequest) {
  if (!serverEnv.openrouterApiKey && !serverEnv.groqApiKey) {
    return NextResponse.json({ error: 'AI 기능을 사용하려면 .env에 API 키를 설정해주세요.' }, { status: 501 });
  }

  const { question_id, question, company_name, recruitment_notice, notes, urls } = await request.json();

  if (!question?.trim()) {
    return NextResponse.json({ error: '질문 내용이 없습니다.' }, { status: 400 });
  }

  const contextParts: string[] = [];
  if (company_name)       contextParts.push(`회사/기관명: ${company_name}`);
  if (recruitment_notice) contextParts.push(`모집 요강:\n${recruitment_notice}`);
  if (notes)              contextParts.push(`기타 사항:\n${notes}`);
  if (urls?.length)       contextParts.push(`참고 URL:\n${(urls as { title: string; url: string }[]).map(u => `- ${u.title}: ${u.url}`).join('\n')}`);

  const messages = [
    {
      role: 'system',
      content: `당신은 수천 건의 실제 면접 사례를 분석한 전문 면접 코치입니다.
지원자의 입장에서 면접 질문에 대한 모범 답변을 작성합니다.
오직 한국어로만 작성하고, 답변 내용만 출력합니다 (설명·머리말 없이).`,
    },
    {
      role: 'user',
      content: `다음 면접 질문에 대한 모범 답변을 새롭게 작성해주세요.

## 회사/기관 정보
${contextParts.join('\n\n') || '(정보 없음)'}

## 면접 질문
${question}

## 작성 조건
- 4~6문장으로 구체적이고 진정성 있게 작성합니다.
- STAR 기법(상황·과제·행동·결과)을 자연스럽게 녹여냅니다.
- 지원자의 강점과 역량이 드러나도록 작성합니다.
- 답변 내용만 출력합니다.`,
    },
  ];

  let sample_answer: string | null = null;

  if (serverEnv.openrouterApiKey) {
    for (const model of OR_MODELS) {
      sample_answer = await fetchText(OR_URL, { Authorization: `Bearer ${serverEnv.openrouterApiKey}` }, {
        model, max_tokens: 1000, messages,
      });
      if (sample_answer) break;
    }
  }

  if (!sample_answer && serverEnv.groqApiKey) {
    sample_answer = await fetchText(GROQ_URL, { Authorization: `Bearer ${serverEnv.groqApiKey}` }, {
      model: GROQ_MODEL, max_tokens: 1000, temperature: 0.85, messages,
    });
  }

  if (!sample_answer) {
    return NextResponse.json({ error: 'AI 답변 생성에 실패했습니다.' }, { status: 500 });
  }

  // DB 업데이트
  if (question_id && !question_id.startsWith('tmp-')) {
    await supabase
      .from('interview_questions')
      .update({ sample_answer })
      .eq('id', question_id);
  }

  return NextResponse.json({ sample_answer });
}
