import React, { useState, useEffect } from 'react';
import { DEFAULT_RUBRIC, RUBRIC_PRESETS, recalculateRubricTotal } from '../data/gradingRubric';
import { saveRubric, getRubric } from '../lib/mockFirebase';
import { Settings2, RotateCcw, Save, ChevronDown, ChevronUp, Sparkles, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

const RubricEditor = ({ onClose, onSave }) => {
  const [rubric, setRubric] = useState(DEFAULT_RUBRIC);
  const [expandedCriterion, setExpandedCriterion] = useState('content');
  const [showPresets, setShowPresets] = useState(false);

  useEffect(() => {
    const loadRubric = async () => {
      const saved = await getRubric();
      if (saved) setRubric(recalculateRubricTotal(saved));
    };
    loadRubric();
  }, []);

  const updateCriterion = (id, field, value) => {
    setRubric((prev) => {
      const updated = {
        ...prev,
        criteria: prev.criteria.map((c) => (c.id === id ? { ...c, [field]: value } : c)),
      };
      return recalculateRubricTotal(updated);
    });
  };

  const handlePointsChange = (id, rawVal) => {
    const parsed = Math.max(0, Math.min(100, parseInt(rawVal || '0', 10) || 0));
    updateCriterion(id, 'maxPoints', parsed);
  };

  const handleSave = async () => {
    const updatedRubric = recalculateRubricTotal(rubric);
    if (updatedRubric.totalPoints <= 0) {
      toast.error('총점은 최소 1점 이상이어야 합니다.');
      return;
    }
    await saveRubric(updatedRubric);
    setRubric(updatedRubric);
    toast.success(`채점 기준(총 ${updatedRubric.totalPoints}점)이 저장되었습니다.`);
    if (onSave) onSave(updatedRubric);
  };

  const applyPreset = (preset) => {
    setRubric(recalculateRubricTotal(preset.rubric));
    setShowPresets(false);
    toast.success(`"${preset.name}" 프리셋이 적용되었습니다.`);
  };

  const resetToDefault = () => {
    setRubric(recalculateRubricTotal(DEFAULT_RUBRIC));
    toast('기본 루브릭(내용 25, 구성 25, 언어 25, 문법 25)으로 초기화했습니다.');
  };

  const totalPoints = rubric.criteria.reduce((sum, c) => sum + (Number(c.maxPoints) || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-3 sm:p-4">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/95 backdrop-blur px-4 sm:px-6 py-4 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
              <Settings2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-foreground">루브릭 설정 (4영역)</h2>
              <p className="text-xs text-muted-foreground">내용, 구성, 언어, 문법 배점 수정 가능</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-5">
          {/* Preset Selector */}
          <div className="rounded-xl border border-border bg-secondary/30 p-3 sm:p-4">
            <button
              type="button"
              onClick={() => setShowPresets(!showPresets)}
              className="flex w-full items-center justify-between text-sm font-medium text-foreground"
            >
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                프리셋 빠르게 적용
              </span>
              {showPresets ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {showPresets && (
              <div className="mt-3 space-y-2">
                {RUBRIC_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className="w-full text-left rounded-lg border border-border bg-card p-3 hover:border-primary/50 hover:bg-primary/5 transition-all"
                  >
                    <p className="text-sm font-medium text-foreground">{preset.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{preset.description}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Total Points Display */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div>
              <span className="text-sm font-medium text-foreground">루브릭 총점</span>
              {totalPoints !== 100 && (
                <p className="text-xs text-amber-300 mt-0.5">
                  사용자 지정 만점({totalPoints}점)이 학생 피드백과 CSV에도 자동 반영됩니다.
                </p>
              )}
            </div>
            <span className={cn('text-2xl font-bold', totalPoints > 0 ? 'text-primary' : 'text-destructive')}>
              {totalPoints}점
            </span>
          </div>

          {/* Criteria List */}
          <div className="space-y-3">
            {rubric.criteria.map((criterion) => {
              const isExpanded = expandedCriterion === criterion.id;
              return (
                <div
                  key={criterion.id}
                  className="rounded-xl border border-border bg-background overflow-hidden transition-all"
                >
                  <div className="flex items-center justify-between gap-2 p-3 sm:p-4 hover:bg-secondary/30 transition-colors">
                    <button
                      type="button"
                      onClick={() => setExpandedCriterion(isExpanded ? null : criterion.id)}
                      className="flex flex-1 items-center gap-3 text-left min-w-0"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-sm font-bold text-primary">
                        {criterion.maxPoints}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">{criterion.name}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{criterion.description}</p>
                      </div>
                    </button>

                    <div className="flex items-center gap-2 shrink-0">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={criterion.maxPoints}
                        onChange={(e) => handlePointsChange(criterion.id, e.target.value)}
                        aria-label={`${criterion.name} 배점`}
                        className="w-16 rounded-lg border border-input bg-card px-2 py-1 text-center text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <button
                        type="button"
                        onClick={() => setExpandedCriterion(isExpanded ? null : criterion.id)}
                        className="p-1 text-muted-foreground hover:text-foreground"
                        aria-label="세부 설명 펼치기"
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-border p-4 space-y-4">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">영역 설명</label>
                        <textarea
                          value={criterion.description}
                          onChange={(e) => updateCriterion(criterion.id, 'description', e.target.value)}
                          className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                          rows={2}
                        />
                      </div>

                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-2 block">
                          배점 조절: <span className="text-primary font-bold">{criterion.maxPoints}점</span>
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={60}
                          step={1}
                          value={criterion.maxPoints}
                          onChange={(e) => handlePointsChange(criterion.id, e.target.value)}
                          className="w-full accent-primary"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                          <span>0점</span>
                          <span>30점</span>
                          <span>60점</span>
                        </div>
                      </div>

                      {criterion.levels?.length > 0 && (
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-2 block">수준별 기준</label>
                          <div className="space-y-1.5">
                            {criterion.levels.map((level, i) => (
                              <div key={i} className="flex items-start gap-2 text-xs">
                                <span
                                  className={cn(
                                    'shrink-0 rounded-md px-2 py-0.5 font-medium',
                                    i === 0 ? 'bg-emerald-500/15 text-emerald-400' :
                                    i === 1 ? 'bg-blue-500/15 text-blue-400' :
                                    i === 2 ? 'bg-amber-500/15 text-amber-300' :
                                    'bg-rose-500/15 text-rose-400'
                                  )}
                                >
                                  {level.label}
                                </span>
                                <span className="text-muted-foreground">{level.desc}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 flex items-center justify-between border-t border-border bg-card/95 backdrop-blur px-4 sm:px-6 py-4 rounded-b-2xl">
          <button
            type="button"
            onClick={resetToDefault}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 sm:px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            초기화
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 sm:px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Save className="h-4 w-4" />
            저장하기
          </button>
        </div>
      </div>
    </div>
  );
};

export default RubricEditor;
