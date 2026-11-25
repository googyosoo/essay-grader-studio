// Original open-ended writing prompts and anonymized sample essays (no copyrighted textbook texts or real student names)

export const worksheetData = {
  part1: {
    title: 'Task 1 · Nature & Conservation',
    promptTitle: '자연 관찰과 생태계 보전',
    conceptQuestion:
      'What small actions can students take in daily life to protect local wildlife and natural habitats? (우리 주변의 생태계와 동식물을 지키기 위해 학생이 일상에서 실천할 수 있는 일은 무엇일까요?)',
    guideNote:
      '자연 현상이나 생태계 보전에 대한 자신의 관점을 영어 3문장 이상(권장 35단어 이상)으로 작성해 보세요.',
    writingKeywords: ['habitat', 'wildlife', 'protection', 'responsibility', 'daily action'],
  },
  part2: {
    title: 'Task 2 · Technology & Focus',
    promptTitle: '디지털 기기와 건강한 집중력',
    conceptQuestion:
      'How do smartphones and digital tools affect students’ focus, and what rules help maintain balance? (스마트폰과 디지털 도구는 학습 집중력에 어떤 영향을 미치며, 균형을 지키려면 어떤 기준이 필요할까요?)',
    guideNote:
      '장점과 주의점을 균형 있게 다루고 연결어(First, However, Therefore 등)를 활용해 의견을 정리해 보세요.',
    writingKeywords: ['digital balance', 'focus', 'screen time', 'habit', 'productivity'],
  },
  part3: {
    title: 'Task 3 · Community & Cooperation',
    promptTitle: '공동체 문제 해결과 협력',
    conceptQuestion:
      'Why is cooperation across different groups necessary when solving environmental or school community problems? (학교나 지역 사회의 공동 문제를 해결할 때 구성원 간의 협력이 필요한 이유는 무엇일까요?)',
    guideNote:
      '구체적인 사례나 기대 효과를 포함해 자신의 주장을 논리적으로 서술해 보세요.',
    writingKeywords: ['cooperation', 'community', 'shared goal', 'communication', 'sustainable'],
  },
};

export const SAMPLE_ESSAYS = [
  {
    id: 'sample_01',
    email: 'sample01@example.edu',
    name: 'Sample 01',
    partKey: 'part1',
    inquiryAnswer: 'We can reduce plastic waste and keep parks clean for birds and small animals.',
    essay:
      'i think protecting wildlife is very interested. Many animals lose their habitat because of people throw trash everywhere. Our small daily action and responsibility can help nature stay safe',
  },
  {
    id: 'sample_02',
    email: 'sample02@example.edu',
    name: 'Sample 02',
    partKey: 'part1',
    inquiryAnswer: 'Students can join local clean-up campaigns and share awareness posters.',
    essay:
      'First, protecting local wildlife is an important responsibility for all students. However, urban development often threatens animal habitat near our schools. Therefore, taking daily action such as reducing single-use plastics can support long-term protection.',
  },
];
