// Default grading rubric data and presets (4 areas: 내용, 구성, 언어, 문법)

export const DEFAULT_RUBRIC = {
  id: 'default',
  name: '영어 에세이 표준 루브릭',
  totalPoints: 100,
  criteria: [
    {
      id: 'content',
      name: '내용 (Content)',
      description: '주제 관련성, 주장의 명확성, 근거의 타당성 및 탐구 질문 반영도',
      maxPoints: 25,
      levels: [
        { label: '상', desc: '주제에 정확히 부합하고 구체적 근거로 깊이 있게 전개함' },
        { label: '중상', desc: '주제를 잘 다루며 적절한 이유와 예시를 포함함' },
        { label: '중', desc: '주제와 관련 있으나 근거나 설명이 부족함' },
        { label: '하', desc: '주제에서 벗어나거나 분량이 현저히 부족함' },
      ],
    },
    {
      id: 'organization',
      name: '구성 (Organization)',
      description: '도입-전개-마무리 구조, 문장 간 논리적 흐름, 연결어 활용',
      maxPoints: 25,
      levels: [
        { label: '상', desc: '서론과 본론, 결론이 뚜렷하고 전환 표현이 자연스러움' },
        { label: '중상', desc: '기본 구조를 갖추고 전반적인 흐름이 논리적임' },
        { label: '중', desc: '문장 연결이 다소 어색하거나 구조가 불분명함' },
        { label: '하', desc: '구성이 잡히지 않고 문장이 단편적으로 나열됨' },
      ],
    },
    {
      id: 'language',
      name: '언어 (Language)',
      description: '어휘의 다양성과 문맥 적절성, 과제 핵심 표현 및 키워드 활용도',
      maxPoints: 25,
      levels: [
        { label: '상', desc: '풍부하고 정확한 어휘를 구사하며 핵심 키워드를 자연스럽게 활용함' },
        { label: '중상', desc: '문맥에 맞는 어휘를 사용하고 키워드를 대부분 반영함' },
        { label: '중', desc: '기초 어휘 반복이 잦고 키워드 활용이 제한적임' },
        { label: '하', desc: '어휘 선택 오류가 잦아 의미 전달이 어려움' },
      ],
    },
    {
      id: 'grammar',
      name: '문법 (Grammar)',
      description: '문장 구조 정확성, 시제와 수 일치, 철자 및 구두점 준수',
      maxPoints: 25,
      levels: [
        { label: '상', desc: '문법 오류가 거의 없고 다양한 문장 구조를 정확히 사용함' },
        { label: '중상', desc: '소수의 사소한 오류가 있으나 의미 전달이 명확함' },
        { label: '중', desc: '여러 문법 오류가 반복되어 일부 문장 이해가 어려움' },
        { label: '하', desc: '기초 문법과 구두점 오류가 빈번해 교정이 시급함' },
      ],
    },
  ],
};

export function recalculateRubricTotal(rubric) {
  const criteria = (rubric?.criteria || []).map((c) => ({
    ...c,
    maxPoints: Math.max(0, Number(c.maxPoints) || 0),
  }));
  const totalPoints = criteria.reduce((sum, c) => sum + c.maxPoints, 0);
  return { ...rubric, criteria, totalPoints };
}

export const RUBRIC_PRESETS = [
  {
    id: 'standard',
    name: '표준 균등형 (25 / 25 / 25 / 25)',
    description: '내용, 구성, 언어, 문법 4개 영역에 각 25점을 배분합니다.',
    rubric: DEFAULT_RUBRIC,
  },
  {
    id: 'content-org-focus',
    name: '내용·논리 중심형 (35 / 25 / 20 / 20)',
    description: '수행평가 서술형 및 주장하기 에세이에 적합한 배점입니다.',
    rubric: recalculateRubricTotal({
      ...DEFAULT_RUBRIC,
      id: 'content-org-focus',
      name: '내용·논리 중심 루브릭',
      criteria: DEFAULT_RUBRIC.criteria.map((c) => {
        if (c.id === 'content') return { ...c, maxPoints: 35 };
        if (c.id === 'organization') return { ...c, maxPoints: 25 };
        return { ...c, maxPoints: 20 };
      }),
    }),
  },
  {
    id: 'language-grammar-focus',
    name: '언어·문법 집중형 (20 / 15 / 30 / 35)',
    description: '정확한 어휘 선택과 문법 교정에 높은 비중을 둔 배점입니다.',
    rubric: recalculateRubricTotal({
      ...DEFAULT_RUBRIC,
      id: 'language-grammar-focus',
      name: '언어·문법 집중 루브릭',
      criteria: DEFAULT_RUBRIC.criteria.map((c) => {
        if (c.id === 'content') return { ...c, maxPoints: 20 };
        if (c.id === 'organization') return { ...c, maxPoints: 15 };
        if (c.id === 'language') return { ...c, maxPoints: 30 };
        if (c.id === 'grammar') return { ...c, maxPoints: 35 };
        return c;
      }),
    }),
  },
];
