import React, { useState } from 'react';
import { splitSentencesWithInfo } from '../lib/essayGrader';
import { cn } from '../lib/utils';
import { ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';

const SentenceHighlighter = ({ essay, corrections = [], correctedEssay }) => {
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [viewMode, setViewMode] = useState('highlight'); // 'highlight' | 'corrected'

  const sentences = splitSentencesWithInfo(essay);

  // Group corrections by sentenceIndex
  const correctionsBySentence = {};
  corrections.forEach((c) => {
    const idx = Number.isInteger(c.sentenceIndex) ? c.sentenceIndex : 0;
    if (!correctionsBySentence[idx]) correctionsBySentence[idx] = [];
    correctionsBySentence[idx].push(c);
  });

  if (!essay) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-6 text-center text-sm text-muted-foreground">
        작성된 에세이가 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* View toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-border bg-secondary/30 p-0.5">
          <button
            type="button"
            onClick={() => setViewMode('highlight')}
            className={cn(
              'rounded-md px-3 py-1 text-xs font-medium transition-colors',
              viewMode === 'highlight' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            문장별 첨삭 하이라이트
          </button>
          <button
            type="button"
            onClick={() => setViewMode('corrected')}
            className={cn(
              'rounded-md px-3 py-1 text-xs font-medium transition-colors',
              viewMode === 'corrected' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            교정본 전체 보기
          </button>
        </div>
        {viewMode === 'highlight' && corrections.length > 0 && (
          <span className="text-[11px] text-muted-foreground">
            색칠된 문장을 눌러 교정 이유를 확인하세요
          </span>
        )}
      </div>

      {viewMode === 'corrected' ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground break-words">
            {correctedEssay || essay}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="rounded-xl border border-border bg-background p-3 sm:p-4 space-y-2.5">
            {sentences.map((s) => {
              const items = correctionsBySentence[s.index] || [];
              const hasIssue = items.length > 0;
              const isSelected = selectedIdx === s.index;

              return (
                <div key={s.index} className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedIdx(isSelected ? null : s.index)}
                    className={cn(
                      'w-full text-left rounded-lg border px-3 py-2 text-sm leading-relaxed transition-all break-words',
                      hasIssue
                        ? isSelected
                          ? 'border-amber-400 bg-amber-500/15 text-foreground'
                          : 'border-amber-500/40 bg-amber-500/10 text-foreground hover:border-amber-400'
                        : 'border-transparent bg-secondary/20 text-foreground/90 hover:border-border'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="mr-2 inline-block rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          S{s.index + 1}
                        </span>
                        <span className={cn(hasIssue && 'underline decoration-amber-400/70 decoration-wavy underline-offset-4')}>
                          {s.text}
                        </span>
                      </div>
                      {hasIssue ? (
                        <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                          <AlertCircle className="h-3 w-3" /> {items.length}건
                        </span>
                      ) : (
                        corrections.length > 0 && (
                          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" /> 양호
                          </span>
                        )
                      )}
                    </div>
                  </button>

                  {/* Inline correction details */}
                  {hasIssue && (isSelected || sentences.length <= 5) && (
                    <div className="ml-2 sm:ml-4 space-y-1.5 border-l-2 border-amber-500/40 pl-3">
                      {items.map((item, idx) => (
                        <div key={idx} className="rounded-lg border border-border bg-card/70 px-3 py-2 text-xs">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="line-through text-rose-400 break-all">{item.original}</span>
                            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="font-semibold text-emerald-400 break-all">{item.corrected}</span>
                            {item.type && (
                              <span className="ml-auto rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                {item.type}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-muted-foreground leading-relaxed">{item.explanation}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default SentenceHighlighter;
