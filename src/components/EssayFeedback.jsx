import React, { useState, useEffect } from 'react';
import { getAllGradingResults, getWorksheetData } from '../lib/mockFirebase';
import { worksheetData } from '../data/worksheetData';
import { DEFAULT_RUBRIC } from '../data/gradingRubric';
import SentenceHighlighter from './SentenceHighlighter';
import { cn } from '../lib/utils';
import { Award, CheckCircle2, BookOpen, MessageSquare } from 'lucide-react';

const ScoreRing = ({ score, max, label, size = 76 }) => {
  const safeMax = max > 0 ? max : 25;
  const pct = Math.min(100, Math.max(0, (score / safeMax) * 100));
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  const color = pct >= 80 ? '#22c55e' : pct >= 60 ? '#3b82f6' : pct >= 40 ? '#eab308' : '#ef4444';

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="-rotate-90" style={{ width: size, height: size }} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" className="text-secondary" strokeWidth="5" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="5"
            strokeDasharray={c}
            strokeDashoffset={c - (c * pct) / 100}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.7s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-sm font-bold" style={{ color }}>{score}</span>
          <span className="text-[9px] text-muted-foreground">/{safeMax}</span>
        </div>
      </div>
      <span className="text-[11px] font-medium text-muted-foreground text-center leading-tight max-w-[84px] break-words">
        {label}
      </span>
    </div>
  );
};

// Student-only feedback view: excludes teacherSummary, variance alerts, and grading history
const EssayFeedback = ({ user }) => {
  const [results, setResults] = useState({});
  const [essays, setEssays] = useState({});
  const [selectedPart, setSelectedPart] = useState(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const data = await getAllGradingResults(user.email);
      setResults(data);
      const essayMap = {};
      for (const p of ['part1', 'part2', 'part3']) {
        const w = await getWorksheetData(p);
        if (w?.reflection) essayMap[p] = w.reflection;
      }
      setEssays(essayMap);
      const firstGraded = ['part1', 'part2', 'part3'].find((p) => data[p]?.finalized);
      if (firstGraded) setSelectedPart(firstGraded);
    };
    load();
  }, [user]);

  const gradedParts = ['part1', 'part2', 'part3'].filter((p) => results[p]?.finalized);
  const currentResult = selectedPart ? results[selectedPart] : null;
  const currentEssay = selectedPart ? (currentResult?.originalEssay || essays[selectedPart] || '') : '';

  if (gradedParts.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-3 sm:px-4 py-12 text-center">
        <div className="rounded-2xl border border-border bg-card p-8 sm:p-12">
          <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-lg sm:text-xl font-bold text-foreground mb-2">아직 공개된 채점 결과가 없습니다</h2>
          <p className="text-sm text-muted-foreground">
            선생님이 에세이를 채점해 확정하면 이 화면에서 점수와 문장별 첨삭을 확인할 수 있습니다.
          </p>
        </div>
      </div>
    );
  }

  const criteria = currentResult?.rubricSnapshot?.criteria || DEFAULT_RUBRIC.criteria;
  const maxTotal =
    currentResult?.maxTotalScore ||
    currentResult?.rubricSnapshot?.totalPoints ||
    criteria.reduce((s, c) => s + (c.maxPoints || 0), 0) ||
    100;
  const pct = maxTotal > 0 ? Math.min(100, Math.round((currentResult.totalScore / maxTotal) * 100)) : 0;
  const studentFb = currentResult?.studentFeedback || currentResult?.feedback || {};

  return (
    <div className="mx-auto max-w-5xl px-3 sm:px-4 py-6 space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-1">
          <Award className="h-6 w-6 text-primary shrink-0" />
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">내 에세이 피드백</h1>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground sm:ml-9">
          영역별 점수와 문장별 첨삭, 선생님 피드백을 확인하세요
        </p>
      </div>

      {/* Part Tabs */}
      <div className="flex flex-wrap gap-2">
        {gradedParts.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setSelectedPart(p)}
            className={cn(
              'px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-full transition-all flex items-center gap-1.5',
              selectedPart === p ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
            )}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {worksheetData[p].title}
          </button>
        ))}
      </div>

      {currentResult && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Score Summary */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 p-5 sm:p-6 text-center">
              <p className="text-sm font-medium text-muted-foreground mb-2">총점</p>
              <div className="text-4xl sm:text-5xl font-bold text-primary mb-1">{currentResult.totalScore}</div>
              <p className="text-sm text-muted-foreground">/ {maxTotal} ({pct}%)</p>
              <div className="mt-4 h-2 rounded-full bg-secondary overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${pct}%` }} />
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
              <h3 className="text-sm font-bold text-foreground mb-4">루브릭 4영역 점수</h3>
              <div className="grid grid-cols-2 gap-4 place-items-center">
                {criteria.map((c) => (
                  <ScoreRing
                    key={c.id}
                    score={currentResult.scores?.[c.id] ?? 0}
                    max={c.maxPoints}
                    label={c.name}
                  />
                ))}
              </div>
            </div>

            {(currentResult.keywordsUsed?.length > 0 || currentResult.keywordsMissing?.length > 0) && (
              <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
                <h3 className="text-sm font-bold text-foreground mb-3">키워드 활용</h3>
                <div className="flex flex-wrap gap-1.5">
                  {currentResult.keywordsUsed?.map((kw) => (
                    <span key={kw} className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs text-emerald-400">
                      ✓ {kw}
                    </span>
                  ))}
                  {currentResult.keywordsMissing?.map((kw) => (
                    <span key={kw} className="rounded-full bg-rose-500/15 px-2.5 py-1 text-xs text-rose-400/80">
                      ✗ {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Student Feedback & Sentence Highlights */}
          <div className="lg:col-span-3 space-y-5">
            {currentEssay && (
              <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
                <h3 className="text-sm font-bold text-foreground mb-3">문장별 첨삭 하이라이트</h3>
                <SentenceHighlighter
                  essay={currentEssay}
                  corrections={currentResult.grammarCorrections || []}
                  correctedEssay={currentResult.correctedEssay}
                />
              </div>
            )}

            <div className="rounded-2xl border border-border bg-card p-4 sm:p-6 space-y-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" /> 학생용 피드백
              </h3>
              {studentFb.strengths && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5">
                  <p className="text-xs font-semibold text-emerald-400 mb-1">잘한 점</p>
                  <p className="text-sm text-foreground leading-relaxed">{studentFb.strengths}</p>
                </div>
              )}
              {studentFb.improvements && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5">
                  <p className="text-xs font-semibold text-amber-300 mb-1">보완 가이드</p>
                  <p className="text-sm text-foreground leading-relaxed">{studentFb.improvements}</p>
                </div>
              )}
              {studentFb.overall && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5">
                  <p className="text-xs font-semibold text-primary mb-1">종합 피드백</p>
                  <p className="text-sm text-foreground leading-relaxed">{studentFb.overall}</p>
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground text-right">
              채점일: {currentResult.gradedAt ? new Date(currentResult.gradedAt).toLocaleString('ko-KR') : '-'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default EssayFeedback;
