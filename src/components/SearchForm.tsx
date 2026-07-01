'use client';

import { useState } from 'react';
import { SearchParams } from '@/lib/jobs/types';
import { LOCATIONS } from '@/constants/locations';

interface Props {
  onSearch: (params: SearchParams) => void;
  isLoading: boolean;
}

export default function SearchForm({ onSearch, isLoading }: Props) {
  const [keyword,        setKeyword]        = useState('');
  const [location,       setLocation]       = useState('');
  const [career,         setCareer]         = useState('');
  const [employmentType, setEmploymentType] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim()) return;
    onSearch({ keyword: keyword.trim(), location, career, employmentType });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-md p-6 space-y-4">
      {/* 키워드 입력 + 검색 버튼 */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            placeholder="직무, 기술스택, 회사명 입력"
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400"
            required
          />
        </div>
        <button
          type="submit"
          disabled={isLoading || !keyword.trim()}
          className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
        >
          {isLoading ? '검색 중...' : '채용공고 검색'}
        </button>
      </div>

      {/* 필터 */}
      <div className="grid grid-cols-3 gap-3">
        <select
          value={location}
          onChange={e => setLocation(e.target.value)}
          className="py-2.5 px-3 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          {LOCATIONS.map(l => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>

        <select
          value={career}
          onChange={e => setCareer(e.target.value)}
          className="py-2.5 px-3 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">경력 전체</option>
          <option value="new">신입</option>
          <option value="experienced">경력</option>
        </select>

        <select
          value={employmentType}
          onChange={e => setEmploymentType(e.target.value)}
          className="py-2.5 px-3 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">고용형태 전체</option>
          <option value="regular">정규직</option>
          <option value="contract">계약직</option>
          <option value="intern">인턴</option>
          <option value="freelance">프리랜서</option>
        </select>
      </div>
    </form>
  );
}
