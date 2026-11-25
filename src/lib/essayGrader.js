// Essay Grading Engine
// Supports BYOK Gemini API (free-tier models) + enhanced rule-based fallback
// Includes sentence-level alignment, student/teacher feedback split, 2-pass variance detection, and CSV export

import { worksheetData } from '../data/worksheetData';

export const GEMINI_MODELS = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (무료 등급 권장)' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (무료 등급)' },
];

const API_KEY_STORAGE = 'eg_gemini_api_key';
const MODEL_STORAGE = 'eg_gemini_model';

export function getApiKey() {
  return localStorage.getItem(API_KEY_STORAGE) || '';
}

export function setApiKey(key) {
  if (key && key.trim()) {
    localStorage.setItem(API_KEY_STORAGE, key.trim());
  } else {
    localStorage.removeItem(API_KEY_STORAGE);
  }
}

export function getSelectedModel() {
  const saved = localStorage.getItem(MODEL_STORAGE);
  return GEMINI_MODELS.some((m) => m.id === saved) ? saved : GEMINI_MODELS[0].id;
}

export function setSelectedModel(modelId) {
  if (GEMINI_MODELS.some((m) => m.id === modelId)) {
    localStorage.setItem(MODEL_STORAGE, modelId);
  }
}

// ─── Sentence Splitting & Alignment ──────────────────────────────────

export function splitSentencesWithInfo(essay) {
  const text = (essay || '').trim();
  if (!text) return [];

  const regex = /[^.!?\n]+(?:[.!?]+|$)/g;
  const sentences = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    const raw = match[0];
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const leadingSpaces = raw.length - raw.trimStart().length;
    sentences.push({
      index: sentences.length,
      text: trimmed,
      start: match.index + leadingSpaces,
      end: match.index + raw.trimEnd().length,
    });
  }
  return sentences;
}

function alignCorrectionsToSentences(essay, corrections = []) {
  const sentences = splitSentencesWithInfo(essay);
  return corrections.map((item) => {
    let idx = Number.isInteger(item.sentenceIndex) ? item.sentenceIndex : -1;
    if (idx < 0 || idx >= sentences.length) {
      const target = (item.original || '').trim().toLowerCase();
      if (target) {
        idx = sentences.findIndex((s) => s.text.toLowerCase().includes(target));
      }
      if (idx < 0 && item.sentence) {
        const st = item.sentence.trim().toLowerCase();
        idx = sentences.findIndex((s) => s.text.toLowerCase().includes(st) || st.includes(s.text.toLowerCase()));
      }
      if (idx < 0 && sentences.length > 0) idx = 0;
    }
    return {
      ...item,
      sentenceIndex: idx,
      sentence: sentences[idx]?.text || item.sentence || '',
    };
  });
}

// ─── 2-Pass Score Variance Detection ─────────────────────────────────

export function evaluateScoreVariance(history = [], currentTotal, currentScores, rubric) {
  if (!Array.isArray(history) || history.length === 0) {
    return {
      needsTeacherReview: false,
      reviewReason: '',
      previousAttempt: null,
      diffPoints: 0,
    };
  }

  const previous = history[history.length - 1];
  const rubricTotal = rubric?.totalPoints || 100;
  const totalThreshold = Math.max(8, Math.round(rubricTotal * 0.1));
  const diffPoints = currentTotal - (previous.totalScore ?? 0);
  const absDiff = Math.abs(diffPoints);

  const largeCategoryDiffs = [];
  (rubric?.criteria || []).forEach((c) => {
    const prevVal = previous.scores?.[c.id];
    const currVal = currentScores?.[c.id];
    if (typeof prevVal === 'number' && typeof currVal === 'number' && c.maxPoints > 0) {
      const catDiff = Math.abs(currVal - prevVal);
      if (catDiff >= Math.max(4, Math.round(c.maxPoints * 0.25))) {
        largeCategoryDiffs.push(`${c.name.split('(')[0].trim()} ${prevVal}→${currVal}`);
      }
    }
  });

  const flagged = absDiff >= totalThreshold || largeCategoryDiffs.length > 0;
  if (!flagged) {
    return {
      needsTeacherReview: false,
      reviewReason: '',
      previousAttempt: previous,
      diffPoints,
    };
  }

  const sign = diffPoints > 0 ? `+${diffPoints}` : `${diffPoints}`;
  const detail = largeCategoryDiffs.length > 0 ? ` (${largeCategoryDiffs.join(', ')})` : '';
  return {
    needsTeacherReview: true,
    reviewReason: `${history.length}차(${previous.totalScore}점)와 ${history.length + 1}차(${currentTotal}점) 점수 차이가 큽니다 (${sign}점${detail}).`,
    previousAttempt: previous,
    diffPoints,
  };
}

// ─── Gemini API Analysis (BYOK) ──────────────────────────────────────

function buildGradingPrompt(essay, rubric, partKey) {
  const part = worksheetData[partKey];
  const keywords = part?.writingKeywords || [];
  const conceptQ = part?.conceptQuestion || '';
  const sentences = splitSentencesWithInfo(essay);

  const criteriaDesc = rubric.criteria
    .map((c) => `- ${c.id} | ${c.name} (배점 0~${c.maxPoints}점): ${c.description}`)
    .join('\n');

  const numberedSentences = sentences.map((s) => `[${s.index}] ${s.text}`).join('\n');

  return `You are an expert high school English writing teacher evaluating a Korean EFL student's essay.

## Task Context
- Topic: ${part?.title || 'General English Essay'}
- Concept Question: ${conceptQ}
- Target Keywords: ${keywords.join(', ')}

## Grading Rubric (Total Max: ${rubric.totalPoints} points)
${criteriaDesc}

## Numbered Sentences of Student Essay
${numberedSentences}

## Raw Essay
"""
${essay}
"""

## Output Instructions
Return ONLY valid JSON matching this exact structure. Keep scores strictly within each criterion's maxPoints. Separate student-facing encouragement/guidance from teacher-only diagnostic summary.

{
  "scores": {
    ${rubric.criteria.map((c) => `"${c.id}": <integer 0-${c.maxPoints}>`).join(',\n    ')}
  },
  "grammarCorrections": [
    {
      "sentenceIndex": <0-based integer from Numbered Sentences>,
      "original": "<exact error substring>",
      "corrected": "<corrected substring>",
      "type": "<grammar | punctuation | capitalization | vocabulary>",
      "explanation": "<concise Korean explanation for student>"
    }
  ],
  "keywordsUsed": ["<keywords actually used>"],
  "keywordsMissing": ["<target keywords not used>"],
  "studentFeedback": {
    "strengths": "<1-2 encouraging sentences in Korean for the student>",
    "improvements": "<1-2 actionable improvement tips in Korean for the student>",
    "overall": "<2-3 warm, clear overall sentences in Korean for the student>"
  },
  "teacherSummary": {
    "overview": "<objective Korean diagnostic summary for teacher: proficiency level, score rationale, main error types>",
    "instructionalFocus": "<concise next-step coaching advice for teacher in Korean>",
    "riskFlags": ["<short tag if notable issue exists, e.g. '시제 불일치', '분량 부족', or empty array>"]
  },
  "correctedEssay": "<full essay with all grammar corrections applied>"
}`;
}

async function analyzeWithGemini(essay, rubric, partKey, apiKey, modelId) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent`;
  const prompt = buildGradingPrompt(essay, rubric, partKey);

  const response = await fetch(`${url}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        topP: 0.85,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API 오류 (${response.status}): ${err.slice(0, 180)}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini API 응답이 비어 있습니다.');

  const jsonStr = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const parsed = JSON.parse(jsonStr);

  // Clamp scores strictly to rubric maxPoints
  const clampedScores = {};
  rubric.criteria.forEach((c) => {
    const raw = Number(parsed.scores?.[c.id] ?? 0);
    clampedScores[c.id] = Math.max(0, Math.min(c.maxPoints, Math.round(raw)));
  });

  const totalScore = Object.values(clampedScores).reduce((a, b) => a + b, 0);
  const alignedCorrections = alignCorrectionsToSentences(essay, parsed.grammarCorrections || []);

  return {
    scores: clampedScores,
    totalScore,
    maxTotalScore: rubric.totalPoints,
    rubricSnapshot: rubric,
    grammarCorrections: alignedCorrections,
    keywordsUsed: Array.isArray(parsed.keywordsUsed) ? parsed.keywordsUsed : [],
    keywordsMissing: Array.isArray(parsed.keywordsMissing) ? parsed.keywordsMissing : [],
    studentFeedback: {
      strengths: parsed.studentFeedback?.strengths || '글의 주제를 반영하려 노력했습니다.',
      improvements: parsed.studentFeedback?.improvements || '문법 교정 사항을 확인해 다시 써 보세요.',
      overall: parsed.studentFeedback?.overall || '전반적으로 의미 전달이 이루어졌습니다.',
    },
    teacherSummary: {
      overview: parsed.teacherSummary?.overview || `총점 ${totalScore}/${rubric.totalPoints}점. 교정 ${alignedCorrections.length}건.`,
      instructionalFocus: parsed.teacherSummary?.instructionalFocus || '문법 정확성과 전환어 연결을 지도해 주세요.',
      riskFlags: Array.isArray(parsed.teacherSummary?.riskFlags) ? parsed.teacherSummary.riskFlags : [],
    },
    correctedEssay: parsed.correctedEssay || essay,
    _fallback: false,
    _model: modelId,
    gradedAt: new Date().toISOString(),
  };
}

// ─── Enhanced Rule-Based Fallback Analysis ───────────────────────────

function applyCorrectionsToSentence(sentenceText, corrections) {
  let updated = sentenceText;
  corrections.forEach((c) => {
    if (!c.original || !c.corrected || c.original === c.corrected) return;
    if (updated.includes(c.original)) {
      updated = updated.replace(c.original, c.corrected);
    }
  });
  return updated;
}

export function analyzeWithRules(essay, rubric, partKey) {
  const part = worksheetData[partKey];
  const keywords = part?.writingKeywords || [];
  const words = essay.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const sentences = splitSentencesWithInfo(essay);
  const sentenceCount = sentences.length;

  const essayLower = essay.toLowerCase();
  const keywordsUsed = keywords.filter((kw) => essayLower.includes(kw.toLowerCase()));
  const keywordsMissing = keywords.filter((kw) => !essayLower.includes(kw.toLowerCase()));
  const keywordRatio = keywords.length > 0 ? keywordsUsed.length / keywords.length : 0;

  const grammarCorrections = [];

  sentences.forEach((sent) => {
    const sText = sent.text;

    // 1. Capitalization at sentence start
    if (/^[a-z]/.test(sText)) {
      const firstWord = sText.split(/\s+/)[0];
      grammarCorrections.push({
        sentenceIndex: sent.index,
        sentence: sText,
        original: firstWord,
        corrected: firstWord.charAt(0).toUpperCase() + firstWord.slice(1),
        type: 'capitalization',
        explanation: '문장의 첫 글자는 대문자로 시작해야 합니다.',
      });
    }

    // 2. Standalone lowercase 'i' (case-sensitive!)
    const lowercaseIMatch = sText.match(/(^|\s)i(\s|[,.!?]|$)/);
    if (lowercaseIMatch && !/^[a-z]/.test(sText)) {
      grammarCorrections.push({
        sentenceIndex: sent.index,
        sentence: sText,
        original: ' i ',
        corrected: ' I ',
        type: 'capitalization',
        explanation: "1인칭 대명사 'I'는 문장 위치와 관계없이 항상 대문자로 씁니다.",
      });
    }

    // 3. interested vs interesting
    const interestedRegex = /\binterested\b/gi;
    let m;
    while ((m = interestedRegex.exec(sText)) !== null) {
      const before = sText.slice(Math.max(0, m.index - 22), m.index);
      const after = sText.slice(m.index + m[0].length, m.index + m[0].length + 18);
      if (/\b(is|was|are|were|very|really|so)\s+$/i.test(before) && !/^\s+(in|by|with)\b/i.test(after)) {
        grammarCorrections.push({
          sentenceIndex: sent.index,
          sentence: sText,
          original: m[0],
          corrected: 'interesting',
          type: 'vocabulary',
          explanation: '"interested"는 사람의 감정, "interesting"은 사물이나 현상의 성격을 설명할 때 씁니다.',
        });
      }
    }

    // 4. "because of" followed by a clause (subject + verb pattern)
    const becauseOfClause = sText.match(/\bbecause of\s+([a-z]+\s+(?:is|are|was|were|have|has|had|can|will|do|does|did|[a-z]+s)\b[^,.!?]*)/i);
    if (becauseOfClause) {
      grammarCorrections.push({
        sentenceIndex: sent.index,
        sentence: sText,
        original: `because of ${becauseOfClause[1].split(/\s+/).slice(0, 3).join(' ')}`,
        corrected: `because ${becauseOfClause[1].split(/\s+/).slice(0, 3).join(' ')}`,
        type: 'grammar',
        explanation: "'because of' 뒤에는 명사(구)가 오고, 주어와 동사가 있는 절 앞에는 'because'를 사용합니다.",
      });
    }

    // 5. Subject-verb agreement: he/she/it don't
    const dontMatch = sText.match(/\b(he|she|it)\s+don't\b/i);
    if (dontMatch) {
      grammarCorrections.push({
        sentenceIndex: sent.index,
        sentence: sText,
        original: dontMatch[0],
        corrected: `${dontMatch[1]} doesn't`,
        type: 'grammar',
        explanation: "3인칭 단수 주어(he, she, it) 뒤에는 don't 대신 doesn't를 씁니다.",
      });
    }

    // 6. "there is" + plural quantifier
    const thereIsPlural = sText.match(/\bthere is\s+(many|several|two|three|four|five|lots of|a lot of)\b/i);
    if (thereIsPlural) {
      grammarCorrections.push({
        sentenceIndex: sent.index,
        sentence: sText,
        original: thereIsPlural[0],
        corrected: thereIsPlural[0].replace(/\bis\b/i, 'are'),
        type: 'grammar',
        explanation: '뒤에 복수 명사구가 올 때는 there is 대신 there are를 사용합니다.',
      });
    }

    // 7. Article "a" before common vowel-sound words
    const articleMatch = sText.match(/\ba\s+(hour|honest|apple|elephant|orange|umbrella|idea|example|animal|ocean|important)\b/i);
    if (articleMatch) {
      grammarCorrections.push({
        sentenceIndex: sent.index,
        sentence: sText,
        original: articleMatch[0],
        corrected: `an ${articleMatch[1]}`,
        type: 'grammar',
        explanation: `'${articleMatch[1]}'는 모음 발음으로 시작하므로 부정관사 a 대신 an을 씁니다.`,
      });
    }

    // 8. Repeated adjacent word
    const dupMatch = sText.match(/\b([a-z]{2,})\s+\1\b/i);
    if (dupMatch) {
      grammarCorrections.push({
        sentenceIndex: sent.index,
        sentence: sText,
        original: dupMatch[0],
        corrected: dupMatch[1],
        type: 'grammar',
        explanation: `동일한 단어('${dupMatch[1]}')가 연속으로 중복되었습니다.`,
      });
    }

    // 9. Missing ending punctuation
    if (!/[.!?]$/.test(sText)) {
      const tailWords = sText.split(/\s+/).slice(-3).join(' ');
      grammarCorrections.push({
        sentenceIndex: sent.index,
        sentence: sText,
        original: tailWords,
        corrected: `${tailWords}.`,
        type: 'punctuation',
        explanation: '완전한 문장 끝에는 마침표(.) 등 종결 부호를 붙여야 합니다.',
      });
    }
  });

  // ─── Score Calculation across 4 Criteria (content, organization, language, grammar) ───
  const uniqueWords = new Set(words.map((w) => w.toLowerCase().replace(/[^a-z']/g, '')).filter(Boolean));
  const diversity = uniqueWords.size / Math.max(wordCount, 1);
  const transitions = [
    'first', 'second', 'third', 'also', 'however', 'moreover',
    'therefore', 'furthermore', 'in addition', 'finally', 'in conclusion', 'for example',
  ];
  const transitionCount = transitions.filter((t) => essayLower.includes(t)).length;

  const scores = {};
  (rubric?.criteria || []).forEach((c) => {
    const max = c.maxPoints || 0;
    let ratio = 0.5;

    switch (c.id) {
      case 'content': {
        const lengthRatio = Math.min(wordCount / 40, 1);
        const sentenceBonus = sentenceCount >= 3 ? 0.15 : sentenceCount >= 2 ? 0.08 : 0;
        ratio = lengthRatio * 0.48 + keywordRatio * 0.37 + sentenceBonus;
        break;
      }
      case 'organization': {
        let org = 0.15;
        if (sentenceCount >= 2) org += 0.25;
        if (sentenceCount >= 3) org += 0.15;
        if (wordCount >= 30) org += 0.15;
        org += Math.min(transitionCount * 0.15, 0.3);
        ratio = org;
        break;
      }
      case 'language':
      case 'vocabulary': {
        ratio = keywordRatio * 0.55 + Math.min(diversity / 0.85, 1) * 0.45;
        break;
      }
      case 'grammar': {
        const errorRate = grammarCorrections.length / Math.max(sentenceCount, 1);
        ratio = Math.max(0.15, 1 - errorRate * 0.26);
        if (wordCount < 10) ratio *= 0.4;
        break;
      }
      default:
        ratio = 0.6;
    }

    scores[c.id] = Math.max(0, Math.min(max, Math.round(Math.min(ratio, 1) * max)));
  });

  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);

  // Build corrected essay sentence by sentence
  const correctedEssay = sentences
    .map((s) => {
      const sentCorrections = grammarCorrections.filter((g) => g.sentenceIndex === s.index);
      return applyCorrectionsToSentence(s.text, sentCorrections);
    })
    .join(' ');

  // Split Student Feedback vs Teacher Summary
  const strengthsList = [];
  const improvementsList = [];
  const riskFlags = [];

  if (wordCount >= 30) strengthsList.push(`충분한 분량(${wordCount}단어)으로 자신의 생각을 표현했습니다.`);
  if (keywordsUsed.length > 0) strengthsList.push(`제시된 핵심 키워드(${keywordsUsed.join(', ')})를 문맥에 맞게 활용했습니다.`);
  if (transitionCount > 0) strengthsList.push('연결어를 사용해 글의 흐름을 자연스럽게 구성했습니다.');
  if (grammarCorrections.length === 0) strengthsList.push('문장 부호와 기본 문법이 안정적입니다.');

  if (wordCount < 30) {
    improvementsList.push('핵심 근거를 한 문장 이상 덧붙여 35단어 이상으로 확장해 보세요.');
    riskFlags.push('분량 부족');
  }
  if (keywordsMissing.length > 0) {
    improvementsList.push(`빠진 키워드(${keywordsMissing.join(', ')}) 중 1~2개를 문장에 녹여 보세요.`);
  }
  if (grammarCorrections.length > 0) {
    improvementsList.push(`표시된 ${grammarCorrections.length}개의 문장별 교정 포인트를 확인하고 소리 내어 읽어 보세요.`);
  }
  if (transitionCount === 0 && sentenceCount >= 2) {
    improvementsList.push('First, However, Therefore 같은 연결어를 넣으면 논리가 더 선명해집니다.');
  }
  if (grammarCorrections.length >= 3) riskFlags.push('문법 오류 다수');
  if (keywordRatio < 0.4 && keywords.length > 0) riskFlags.push('키워드 반영 저조');

  const errorTypes = [...new Set(grammarCorrections.map((g) => g.type))];
  const overview = `규칙 기반 진단: ${wordCount}단어, ${sentenceCount}문장, 어휘 다양성 ${Math.round(diversity * 100)}%, 키워드 반영 ${keywordsUsed.length}/${keywords.length}개. 총점 ${totalScore}/${rubric.totalPoints}점${errorTypes.length ? ` (오류 유형: ${errorTypes.join(', ')})` : ' (특이 문법 오류 없음)'}.`;
  const instructionalFocus =
    grammarCorrections.length > 0
      ? `문장별 교정(${grammarCorrections.length}건) 위주로 개별 피드백을 제공하고, ${keywordsMissing.length ? `미사용 키워드(${keywordsMissing.slice(0, 2).join(', ')}) 활용` : '문장 확장'}을 권장하세요.`
      : '기초 문법이 안정적이므로 논리적 근거 확장과 심화 어휘 사용을 지도하세요.';

  return {
    scores,
    totalScore,
    maxTotalScore: rubric.totalPoints,
    rubricSnapshot: rubric,
    grammarCorrections,
    keywordsUsed,
    keywordsMissing,
    studentFeedback: {
      strengths: strengthsList.join(' ') || '주제에 맞춰 성실하게 글을 작성했습니다.',
      improvements: improvementsList.join(' ') || '현재 구성을 유지하며 구체적 예시를 더해 보세요.',
      overall: `총 ${wordCount}개 단어(${sentenceCount}문장)로 작성했고, 핵심 키워드 ${keywordsUsed.length}개를 반영했습니다. ${grammarCorrections.length > 0 ? `${grammarCorrections.length}곳의 문장 교정 제안을 참고해 다듬어 보세요.` : '문법과 마침표 사용이 깔끔합니다.'}`,
    },
    teacherSummary: {
      overview,
      instructionalFocus,
      riskFlags,
    },
    correctedEssay: correctedEssay || essay,
    _fallback: true,
    _model: 'rule-based',
    gradedAt: new Date().toISOString(),
  };
}

// ─── Main Grade Entrypoint ───────────────────────────────────────────

export async function gradeEssay(essay, rubric, partKey, apiKey = null, modelId = getSelectedModel()) {
  if (!essay || essay.trim().length === 0) {
    throw new Error('에세이 내용이 비어 있습니다.');
  }

  if (apiKey && apiKey.trim().length > 0) {
    try {
      return await analyzeWithGemini(essay, rubric, partKey, apiKey.trim(), modelId);
    } catch (err) {
      const result = analyzeWithRules(essay, rubric, partKey);
      result._fallback = true;
      result._fallbackReason = `Gemini 호출 실패로 규칙 기반 모드로 채점했습니다 (${err.message}).`;
      return result;
    }
  }

  const result = analyzeWithRules(essay, rubric, partKey);
  result._fallback = true;
  result._fallbackReason = 'API 키가 설정되지 않아 규칙 기반 폴백 모드로 채점했습니다.';
  return result;
}

// ─── CSV Export Utility (Excel-safe UTF-8 BOM + Formula Escaping) ────

function escapeCsvCell(value) {
  let str = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

export function buildGradingCsv(rows, rubric) {
  const criteria = rubric?.criteria || [];
  const headers = [
    '식별ID',
    '과제',
    '단어수',
    ...criteria.map((c) => `${c.name.split('(')[0].trim()}(/${c.maxPoints})`),
    '총점',
    '만점',
    '채점횟수',
    '교사확인필요',
    '확인사유',
    '채점모드',
    '교사용요약',
    '학생용피드백',
  ];

  const lines = [headers.map(escapeCsvCell).join(',')];
  rows.forEach((row) => {
    const r = row.result;
    const scoreCells = criteria.map((c) => r?.scores?.[c.id] ?? '');
    const line = [
      row.name,
      worksheetData[row.partKey]?.title || row.partKey,
      row.wordCount,
      ...scoreCells,
      r?.totalScore ?? '',
      r?.maxTotalScore ?? rubric?.totalPoints ?? 100,
      r?.gradingHistory?.length || (r ? 1 : 0),
      r?.needsTeacherReview ? '교사 확인 필요' : '정상',
      r?.reviewReason || '',
      r?._fallback ? '규칙기반폴백' : (r?._model || 'AI'),
      r?.teacherSummary?.overview || '',
      r?.studentFeedback?.overall || '',
    ];
    lines.push(line.map(escapeCsvCell).join(','));
  });

  return '\uFEFF' + lines.join('\r\n');
}
