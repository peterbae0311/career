'use client';

import { useState, useEffect } from 'react';
import { supabase, CoverLetterRef, CoverLetterQuestion } from '@/lib/supabase';

type DraftUrl = { id?: string; title: string; url: string; sort_order: number };

const NAV_H = 'h-[calc(100vh-56px)]';

function Icon({ d, className = 'w-5 h-5' }: { d: string; className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
    </svg>
  );
}

export default function CoverLetterPage() {
  const [refs,       setRefs]       = useState<CoverLetterRef[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab,        setTab]        = useState<'ref' | 'questions'>('ref');

  const [refForm, setRefForm] = useState({ company_name: '', recruitment_notice: '', notes: '' });
  const [urls,    setUrls]    = useState<DraftUrl[]>([]);

  const [questions,     setQuestions]     = useState<CoverLetterQuestion[]>([]);
  const [selectedQId,   setSelectedQId]   = useState<string | null>(null);
  const [savingRef,     setSavingRef]     = useState(false);
  const [savingQId,     setSavingQId]     = useState<string | null>(null);
  const [generatingQId, setGeneratingQId] = useState<string | null>(null);

  const selectedRef = refs.find(r => r.id === selectedId) ?? null;
  const selectedQ   = questions.find(q => q.id === selectedQId) ?? null;

  useEffect(() => { fetchRefs(); }, []);

  useEffect(() => {
    if (!selectedId) return;
    fetchUrls(selectedId);
    fetchQuestions(selectedId);
    setSelectedQId(null);
  }, [selectedId]);

  useEffect(() => {
    if (selectedRef) {
      setRefForm({
        company_name:       selectedRef.company_name,
        recruitment_notice: selectedRef.recruitment_notice ?? '',
        notes:              selectedRef.notes ?? '',
      });
    }
  }, [selectedRef]);

  async function fetchRefs() {
    const { data } = await supabase.from('cover_letter_refs').select('*').order('created_at', { ascending: false });
    if (data) {
      setRefs(data as CoverLetterRef[]);
      if (data.length > 0) setSelectedId(data[0].id);
    }
  }

  async function fetchUrls(refId: string) {
    const { data } = await supabase.from('cover_letter_ref_urls').select('*').eq('ref_id', refId).order('sort_order');
    setUrls((data ?? []) as DraftUrl[]);
  }

  async function createRef() {
    const { data } = await supabase.from('cover_letter_refs').insert({ company_name: '새 회사' }).select().single();
    if (data) {
      setRefs([data as CoverLetterRef, ...refs]);
      setSelectedId(data.id);
      setTab('ref');
      setUrls([]);
      setQuestions([]);
    }
  }

  async function saveRef() {
    if (!selectedId || !refForm.company_name.trim()) return;
    setSavingRef(true);
    const { data: updated } = await supabase
      .from('cover_letter_refs')
      .update({ company_name: refForm.company_name.trim(), recruitment_notice: refForm.recruitment_notice || null, notes: refForm.notes || null })
      .eq('id', selectedId).select().single();
    if (updated) setRefs(refs.map(r => r.id === selectedId ? updated as CoverLetterRef : r));

    await supabase.from('cover_letter_ref_urls').delete().eq('ref_id', selectedId);
    const validUrls = urls.filter(u => u.title.trim() || u.url.trim());
    if (validUrls.length > 0) {
      const { data: savedUrls } = await supabase
        .from('cover_letter_ref_urls')
        .insert(validUrls.map((u, i) => ({ ref_id: selectedId, title: u.title, url: u.url, sort_order: i })))
        .select();
      setUrls((savedUrls ?? []) as DraftUrl[]);
    } else {
      setUrls([]);
    }
    setSavingRef(false);
  }

  async function deleteRef() {
    if (!selectedId) return;
    if (!confirm(`"${selectedRef?.company_name}" 자기소개서를 삭제하시겠습니까?\n(참고 URL, 문항 답변 모두 삭제됩니다)`)) return;
    await supabase.from('cover_letter_refs').delete().eq('id', selectedId);
    setRefs(refs.filter(r => r.id !== selectedId));
    setSelectedId(null);
    setUrls([]);
    setQuestions([]);
  }

  async function fetchQuestions(refId: string) {
    const { data } = await supabase.from('cover_letter_questions').select('*').eq('ref_id', refId).order('sort_order');
    setQuestions((data ?? []) as CoverLetterQuestion[]);
  }

  async function addQuestion() {
    if (!selectedId) return;
    const { data } = await supabase
      .from('cover_letter_questions')
      .insert({ ref_id: selectedId, question: '', char_limit: null, answer: null, sort_order: questions.length })
      .select().single();
    if (data) {
      const newQ = data as CoverLetterQuestion;
      setQuestions(prev => [...prev, newQ]);
      setSelectedQId(newQ.id);
    }
  }

  function updateQuestionLocal(id: string, changes: Partial<CoverLetterQuestion>) {
    setQuestions(qs => qs.map(q => q.id === id ? { ...q, ...changes } : q));
  }

  async function saveQuestion(q: CoverLetterQuestion) {
    setSavingQId(q.id);
    await supabase.from('cover_letter_questions')
      .update({ question: q.question, char_limit: q.char_limit, answer: q.answer })
      .eq('id', q.id);
    setSavingQId(null);
  }

  async function deleteQuestion(id: string) {
    if (!confirm('이 문항을 삭제하시겠습니까?')) return;
    await supabase.from('cover_letter_questions').delete().eq('id', id);
    setQuestions(qs => qs.filter(q => q.id !== id));
    if (selectedQId === id) setSelectedQId(null);
  }

  async function generateAnswer() {
    if (!selectedQ) { alert('문항을 선택해주세요.'); return; }
    if (!selectedQ.question.trim()) { alert('문항을 먼저 입력해주세요.'); return; }
    setGeneratingQId(selectedQ.id);
    try {
      const res = await fetch('/api/cover-letter/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name:       selectedRef?.company_name,
          recruitment_notice: selectedRef?.recruitment_notice,
          notes:              selectedRef?.notes,
          urls:               urls.map(u => ({ title: u.title, url: u.url })),
          question:           selectedQ.question,
          char_limit:         selectedQ.char_limit,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const updated = { ...selectedQ, answer: data.answer };
      updateQuestionLocal(selectedQ.id, { answer: data.answer });
      await saveQuestion(updated);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'AI 생성 중 오류가 발생했습니다.');
    } finally {
      setGeneratingQId(null);
    }
  }

  const answerLen  = selectedQ?.answer?.length ?? 0;
  const answerOver = !!(selectedQ?.char_limit && answerLen > selectedQ.char_limit);

  return (
    <div className={`flex ${NAV_H}`}>

      {/* ── 왼쪽: 회사 목록 ──────────────────────────────────────── */}
      <aside className="w-[20%] shrink-0 border-r border-gray-200 bg-white flex flex-col">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-800">회사</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={createRef}
              className="text-xs text-gray-600 border border-gray-300 rounded px-2 py-0.5 hover:border-blue-400 hover:text-blue-600 transition-colors"
            >
              + 추가
            </button>
            <button
              onClick={deleteRef}
              disabled={!selectedId}
              className="text-xs text-gray-600 border border-gray-300 rounded px-2 py-0.5 hover:border-red-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              삭제
            </button>
          </div>
        </div>
        <ul className="flex-1 overflow-y-auto">
          {refs.length === 0 && (
            <li className="text-center text-gray-400 text-xs py-10 px-4">
              + 추가 버튼으로<br />첫 회사를 등록하세요
            </li>
          )}
          {refs.map(ref => (
            <li key={ref.id}>
              <button
                onClick={() => { setSelectedId(ref.id); setTab('ref'); }}
                className={`w-full text-left pr-4 pl-3 py-2.5 border-b border-gray-100 border-l-4 text-sm truncate transition-colors ${
                  selectedId === ref.id
                    ? 'bg-blue-100 border-l-blue-500 text-blue-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50 border-l-transparent'
                }`}
              >
                {ref.company_name}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* ── 오른쪽: 상세 영역 ─────────────────────────────────────── */}
      <section className="flex-1 flex flex-col overflow-hidden bg-white">
        {!selectedId ? (
          <div className="flex flex-col items-center justify-center flex-1 text-gray-400 gap-3">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center">
              <Icon d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-sm">왼쪽에서 회사를 선택하거나 추가하세요</p>
          </div>
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden">

            {/* ── 탭 헤더 ────────────────────────────────────────── */}
            <div className="shrink-0 border-b border-gray-200 flex">
              {([['ref', '기본 정보'], ['questions', '질의 문항']] as const).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`px-12 py-3 text-sm border-b-2 transition-colors ${
                    tab === id
                      ? 'border-blue-500 text-blue-700 font-medium'
                      : 'border-transparent text-gray-400 hover:text-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* ── 탭: 기본 정보 ──────────────────────────────────── */}
            {tab === 'ref' && (
              <div className="flex-1 overflow-y-auto">
                <table className="w-full border-collapse text-sm">
                  <colgroup>
                    <col style={{ width: '7rem' }} />
                    <col />
                  </colgroup>
                  <tbody>
                    {/* 모집 요강 */}
                    <tr className="bg-white">
                      <td className="pl-4 pr-3 py-4 text-right text-sm font-semibold text-gray-700 whitespace-nowrap align-top pt-5">
                        모집 요강 <span className="text-red-500">*</span>
                      </td>
                      <td className="pl-3 py-4 pr-8">
                        <textarea
                          value={refForm.recruitment_notice}
                          onChange={e => setRefForm(f => ({ ...f, recruitment_notice: e.target.value }))}
                          rows={17}
                          className="w-full px-3 py-2 border border-gray-200 rounded text-sm text-gray-700 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 resize-y"
                          placeholder="모집 직무, 자격 요건, 우대 사항 등을 입력하세요"
                        />
                      </td>
                    </tr>

                    {/* 참고 URL */}
                    <tr className="bg-gray-50">
                      <td className="pl-4 pr-3 py-4 text-right text-sm font-semibold text-gray-700 whitespace-nowrap align-top pt-5">
                        참고 URL
                      </td>
                      <td className="pl-3 py-4 pr-8">
                        <div className="border border-gray-200 rounded text-sm">
                          {/* 헤더 */}
                          <div className="flex bg-blue-50 border-b border-blue-100 rounded-t">
                            <div className="w-44 shrink-0 px-4 py-2 text-center font-medium text-blue-700 border-r border-blue-100">명칭</div>
                            <div className="flex-1 px-4 py-2 text-center font-medium text-blue-700 border-r border-blue-100">URL</div>
                            <div className="w-20 shrink-0 px-3 py-2 text-center font-medium text-blue-700 whitespace-nowrap">추가/삭제</div>
                          </div>
                          {/* 행 목록 — 3행 초과 시 스크롤 */}
                          <div className="overflow-y-auto" style={{ maxHeight: '108px' }}>
                            {urls.map((u, i) => (
                              <div key={i} className="flex border-b border-gray-100 last:border-0">
                                <div className="w-44 shrink-0 px-2 py-1 border-r border-gray-200">
                                  <input
                                    value={u.title}
                                    onChange={e => setUrls(us => us.map((x, j) => j === i ? { ...x, title: e.target.value } : x))}
                                    className="w-full px-2 py-1 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400 rounded"
                                    placeholder="명칭"
                                  />
                                </div>
                                <div className="flex-1 px-2 py-1 border-r border-gray-200 flex items-center gap-1">
                                  <input
                                    value={u.url}
                                    onChange={e => setUrls(us => us.map((x, j) => j === i ? { ...x, url: e.target.value } : x))}
                                    className="flex-1 px-2 py-1 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400 rounded"
                                    placeholder="https://..."
                                  />
                                  {u.url && (
                                    <a
                                      href={u.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="shrink-0 text-gray-400 hover:text-blue-500 transition-colors"
                                      title="새 탭에서 열기"
                                      onClick={e => e.stopPropagation()}
                                    >
                                      <Icon d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" className="w-3.5 h-3.5" />
                                    </a>
                                  )}
                                </div>
                                <div className="w-20 shrink-0 px-2 py-1 text-center whitespace-nowrap flex items-center justify-center gap-0.5">
                                  <button
                                    onClick={() => setUrls(us => [...us, { title: '', url: '', sort_order: us.length }])}
                                    className="text-gray-500 hover:text-blue-600 text-lg leading-none p-1.5 rounded hover:bg-blue-50 transition-colors"
                                    title="행 추가"
                                  >⊕</button>
                                  <button
                                    onClick={() => setUrls(us => us.filter((_, j) => j !== i))}
                                    className="text-gray-500 hover:text-red-500 text-lg leading-none p-1.5 rounded hover:bg-red-50 transition-colors"
                                    title="행 삭제"
                                  >⊖</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>

                    {/* 특이 사항 */}
                    <tr className="bg-white">
                      <td className="pl-4 pr-3 py-4 text-right text-sm font-semibold text-gray-700 whitespace-nowrap align-top pt-5">
                        특이 사항
                      </td>
                      <td className="pl-3 py-4 pr-8">
                        <textarea
                          value={refForm.notes}
                          onChange={e => setRefForm(f => ({ ...f, notes: e.target.value }))}
                          rows={5}
                          className="w-full px-3 py-2 border border-gray-200 rounded text-sm text-gray-700 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 resize-y"
                          placeholder="지원 동기, 추가 메모 등"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* 저장 버튼 */}
                <div className="flex justify-end px-8 py-5 border-t border-gray-200">
                  <button
                    onClick={saveRef}
                    disabled={savingRef || !refForm.company_name.trim()}
                    className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {savingRef ? '저장 중...' : '저장'}
                  </button>
                </div>
              </div>
            )}

            {/* ── 탭: 질의 문항 ──────────────────────────────────── */}
            {tab === 'questions' && (
              <div className="flex flex-col flex-1 overflow-hidden">

                {/* AI 작성 버튼 */}
                <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 border-b border-gray-200 bg-gray-50">
                  <button
                    onClick={generateAnswer}
                    disabled={!selectedQId || generatingQId !== null}
                    className="shrink-0 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {generatingQId ? (
                      <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />AI 작성 중...</>
                    ) : 'AI 작성'}
                  </button>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    기본 정보(모집 요강·특이사항·참고 URL)와 문항을 바탕으로 AI가 한국어 답변을 생성합니다.
                    <br />글자수 제한이 있으면 98% 이상 채우며, 미달 시 자동으로 보완 재생성합니다.
                  </p>
                </div>

                {/* 문항 테이블 */}
                <div className="shrink-0 overflow-y-auto" style={{ maxHeight: '45%' }}>
                  <table className="w-full border-collapse text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-blue-50 border-b border-blue-100">
                        <th className="w-10 px-3 py-2 border-r border-blue-100">
                          <span className="sr-only">선택</span>
                        </th>
                        <th className="px-4 py-2 text-center font-medium text-blue-700 border-r border-blue-100">
                          질의 문항
                        </th>
                        <th className="w-28 px-3 py-2 text-center font-medium text-blue-700 border-r border-blue-100">
                          글자수 제한
                        </th>
                        <th className="w-24 px-3 py-2 text-center font-medium text-blue-700 whitespace-nowrap">
                          추가/삭제
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {questions.map((q) => (
                        <tr
                          key={q.id}
                          onClick={() => setSelectedQId(q.id)}
                          className={`border-b border-gray-200 cursor-pointer transition-colors ${
                            selectedQId === q.id ? 'bg-yellow-50' : 'hover:bg-gray-50'
                          }`}
                        >
                          <td className="px-3 py-2 text-center border-r border-gray-200" onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedQId === q.id}
                              onChange={() => setSelectedQId(selectedQId === q.id ? null : q.id)}
                              className="w-4 h-4 accent-blue-600"
                            />
                          </td>
                          <td className="px-4 py-2 border-r border-gray-200" onClick={e => e.stopPropagation()}>
                            <input
                              value={q.question}
                              onChange={e => updateQuestionLocal(q.id, { question: e.target.value })}
                              onBlur={() => {
                                const latest = questions.find(x => x.id === q.id);
                                if (latest) saveQuestion(latest);
                              }}
                              className="w-full bg-transparent text-sm text-gray-700 focus:outline-none"
                              placeholder="자기소개서 문항을 입력하세요"
                            />
                          </td>
                          <td className="px-3 py-2 text-center border-r border-gray-200" onClick={e => e.stopPropagation()}>
                            <input
                              type="number"
                              value={q.char_limit ?? ''}
                              onChange={e => updateQuestionLocal(q.id, { char_limit: e.target.value ? Number(e.target.value) : null })}
                              onBlur={() => {
                                const latest = questions.find(x => x.id === q.id);
                                if (latest) saveQuestion(latest);
                              }}
                              min={0}
                              className="w-16 px-2 py-0.5 border border-gray-200 rounded text-sm text-center text-gray-700 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                              placeholder="없음"
                            />
                          </td>
                          <td className="px-3 py-2 text-center" onClick={e => e.stopPropagation()}>
                            <button onClick={addQuestion} className="text-gray-500 hover:text-blue-600 text-lg leading-none p-1.5 rounded hover:bg-blue-50 transition-colors" title="행 추가">⊕</button>
                            <button onClick={() => deleteQuestion(q.id)} className="text-gray-500 hover:text-red-500 text-lg leading-none p-1.5 rounded hover:bg-red-50 transition-colors" title="삭제">⊖</button>
                          </td>
                        </tr>
                      ))}
                      {/* 하단 빈 행 */}
                      <tr className="border-b border-gray-100">
                        <td className="px-3 py-2 border-r border-gray-200" />
                        <td className="px-4 py-2 border-r border-gray-200 text-gray-400 text-xs">
                          {questions.length === 0 && '오른쪽 ⊕ 버튼으로 문항을 추가하세요'}
                        </td>
                        <td className="px-3 py-2 border-r border-gray-200" />
                        <td className="px-3 py-2 text-center">
                          <button onClick={addQuestion} className="text-gray-500 hover:text-blue-600 text-lg leading-none p-1.5 rounded hover:bg-blue-50 transition-colors" title="행 추가">⊕</button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 구분선 */}
                <div className="shrink-0 border-t border-gray-200" />

                {/* 질의 답변 패널 */}
                <div className="flex-1 flex flex-col px-6 py-4 overflow-hidden min-h-0">
                  <div className="shrink-0 flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-gray-700">답변 내용</span>
                    <button
                      onClick={async () => {
                        if (selectedQ?.answer) await navigator.clipboard.writeText(selectedQ.answer);
                      }}
                      disabled={!selectedQ?.answer}
                      className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 transition-colors rounded"
                      title="복사"
                    >
                      <Icon d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" className="w-4 h-4" />
                    </button>
                  </div>

                  {selectedQ ? (
                    <div className="flex flex-col flex-1 min-h-0">
                      <textarea
                        value={selectedQ.answer ?? ''}
                        onChange={e => updateQuestionLocal(selectedQ.id, { answer: e.target.value })}
                        onBlur={() => {
                          const latest = questions.find(x => x.id === selectedQ.id);
                          if (latest) saveQuestion(latest);
                        }}
                        className={`flex-1 w-full px-4 py-3 border rounded text-base text-gray-800 focus:outline-none focus:ring-1 resize-none ${
                          answerOver
                            ? 'border-red-300 focus:ring-red-400 bg-red-50'
                            : 'border-gray-200 focus:border-blue-400 focus:ring-blue-400 bg-blue-50/30'
                        }`}
                        placeholder="답변을 직접 입력하거나 위 AI 작성 버튼을 클릭하세요"
                      />
                      {selectedQ.char_limit && (
                        <div className={`shrink-0 text-right text-xs mt-1.5 ${answerOver ? 'text-red-500' : 'text-gray-400'}`}>
                          {answerLen.toLocaleString()} / {selectedQ.char_limit.toLocaleString()}자
                          {answerOver && ' (초과)'}
                          {savingQId === selectedQ.id && <span className="ml-2 text-gray-300">저장 중...</span>}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="min-h-[100px] border border-gray-200 rounded flex items-center justify-center text-gray-400 text-sm">
                      위 목록에서 문항을 선택하세요
                    </div>
                  )}
                </div>

              </div>
            )}

          </div>
        )}
      </section>
    </div>
  );
}
