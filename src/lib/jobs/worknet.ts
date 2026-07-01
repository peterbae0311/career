import axios from 'axios';
import { Job, SearchParams } from './types';
import { WORKNET_REGION_CODES, LOCATION_LABELS } from '@/constants/locations';
import { serverEnv } from '@/lib/env.server';

const WORKNET_API_URL = 'https://www.work.go.kr/opi/opi/opia/wantedInfolist.do';

const CAREER_CODES: Record<string, string> = {
  new:         '1',
  experienced: '2',
};

const EMP_TYPE_CODES: Record<string, string> = {
  regular:   '10',
  contract:  '20',
  intern:    '50',
  freelance: '40',
};

export async function searchWorknet(params: SearchParams): Promise<Job[]> {
  const apiKey = serverEnv.worknetApiKey;

  if (!apiKey) {
    return getMockJobs(params);
  }

  try {
    const query: Record<string, string> = {
      authKey:    apiKey,
      callTp:     'L',
      returnType: 'JSON',
      pageNum:    '1',
      display:    '20',
      keyword:    params.keyword,
    };

    if (params.location && WORKNET_REGION_CODES[params.location]) {
      query.region = WORKNET_REGION_CODES[params.location];
    }
    if (params.career && CAREER_CODES[params.career]) {
      query.career = CAREER_CODES[params.career];
    }
    if (params.employmentType && EMP_TYPE_CODES[params.employmentType]) {
      query.empTpCd = EMP_TYPE_CODES[params.employmentType];
    }

    const { data } = await axios.get(WORKNET_API_URL, { params: query, timeout: 10000 });
    const list = data?.wantedInfo ?? [];

    return list.map((j: Record<string, string>) => ({
      id:             `worknet-${j.wantedInfoId}`,
      source:         'worknet' as const,
      title:          j.wantedTitle   ?? '',
      company:        j.cmpnyNm       ?? '',
      location:       j.workRegionNm  ?? '',
      career:         j.careerNm      ?? '경력무관',
      employmentType: j.empTypeNm     ?? '',
      salary:         j.salTpNm       || undefined,
      deadline:       j.closingDate   || undefined,
      url:            j.wantedUrl     ?? `https://www.work.go.kr/wantedInfo/${j.wantedInfoId}`,
      postedAt:       j.openDate      || undefined,
    }));
  } catch (err) {
    console.error('[worknet]', err);
    throw err;
  }
}

function getMockJobs(params: SearchParams): Job[] {
  const loc = params.location ? (LOCATION_LABELS[params.location] ?? '서울') : '서울';
  const kw  = params.keyword  || '개발자';

  return [
    {
      id:             'worknet-mock-1',
      source:         'worknet',
      title:          `${kw} (정규직)`,
      company:        '공공기관 IT센터',
      location:       `${loc} 중구`,
      career:         '경력 2년 이상',
      employmentType: '정규직',
      salary:         '3,500~5,000만원',
      deadline:       '2025-07-31',
      url:            'https://www.work.go.kr',
      postedAt:       '2025-06-20',
    },
    {
      id:             'worknet-mock-2',
      source:         'worknet',
      title:          `${kw} 신입 채용`,
      company:        '이노테크(주)',
      location:       `${loc} 강남구`,
      career:         '신입',
      employmentType: '정규직',
      salary:         '2,800~3,500만원',
      deadline:       '2025-08-15',
      url:            'https://www.work.go.kr',
      postedAt:       '2025-06-22',
    },
    {
      id:             'worknet-mock-3',
      source:         'worknet',
      title:          `시니어 ${kw}`,
      company:        '테크스타트업(주)',
      location:       `${loc} 마포구`,
      career:         '경력 5년 이상',
      employmentType: '정규직',
      salary:         '5,000~7,000만원',
      deadline:       '2025-07-20',
      url:            'https://www.work.go.kr',
      postedAt:       '2025-06-18',
    },
  ];
}
