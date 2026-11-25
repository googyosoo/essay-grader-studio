import React, { useState, useEffect } from 'react';
import { worksheetData } from '../data/worksheetData';
import { saveWorksheetData, getWorksheetData } from '../lib/mockFirebase';
import { AlertCircle, CheckCircle2, Cloud, CloudOff, Lightbulb, Loader2, Save, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';
import { toast, Toaster } from 'sonner';

function timeAgo(iso) {
  if (!iso) return '저장 기록 없음';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 10) return '방금 전 저장됨';
  if (diff < 60) return `${Math.floor(diff)}초 전 저장됨`;
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전 저장됨`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전 저장됨`;
  return `${Math.floor(diff / 86400)}일 전 저장됨`;
}

function SaveStatusIndicator({ status, error, lastSavedAt }) {
  if (status === 'saving') {
    return (
      <p className="flex items-center gap-2 text-xs sm:text-sm text-primary">
        <Loader2 className="h-4 w-4 animate-spin" /> 저장 중...
      </p>
    );
  }
  if (status === 'error') {
    return (
      <p className="flex items-center gap-2 text-xs sm:text-sm text-destructive">
        <CloudOff className="h-4 w-4" /> 저장 실패{error ? `: ${error}` : ''}
      </p>
    );
  }
  if (status === 'success') {
    return (
      <p className="flex items-center gap-2 text-xs sm:text-sm">
        <CheckCircle2 className="h-4 w-4 text-accent" />
        <span className="text-foreground">저장 완료</span>
        <span className="text-muted-foreground">({timeAgo(lastSavedAt)})</span>
      </p>
    );
  }
  return (
    <p className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
      {lastSavedAt ? <Cloud className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
      {timeAgo(lastSavedAt)}
    </p>
  );
}

const Worksheet = () => {
  const [activeTab, setActiveTab] = useState('part1');
  const [reflection, setReflection] = useState('');
  const [inquiry, setInquiry] = useState('');
  const [saveStatus, setSaveStatus] = useState('idle');
  const [saveError, setSaveError] = useState(null);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setReflection('');
      setInquiry('');
      setLastSavedAt(null);
      const data = await getWorksheetData(activeTab);
      if (data) {
        setReflection(data.reflection || '');
        setInquiry(data.inquiry_answer || '');
        setLastSavedAt(data.updated_at || null);
      }
      setSaveStatus('idle');
    };
    loadData();
  }, [activeTab]);

  const save = async () => {
    setSaveStatus('saving');
    setSaveError(null);
    const saveData = {
      reflection,
      inquiry_answer: inquiry,
      updated_at: new Date().toISOString(),
    };

    const success = await saveWorksheetData(activeTab, saveData);
    if (success) {
      setSaveStatus('success');
      setLastSavedAt(saveData.updated_at);
      toast.success('에세이가 저장되었습니다.');
      setTimeout(() => {
        setSaveStatus((prev) => (prev === 'success' ? 'idle' : prev));
      }, 3000);
    } else {
      setSaveStatus('error');
      setSaveError('로컬 저장 오류');
      toast.error('저장에 실패했습니다.');
    }
  };

  const insertKeyword = (kw) => {
    setReflection((prev) => {
      const sep = prev.length === 0 || /\s$/.test(prev) ? '' : ' ';
      return prev + sep + kw + ' ';
    });
  };

  const part = worksheetData[activeTab];
  const wordCount = reflection.trim().split(/\s+/).filter(Boolean).length;
  const sentenceCount = reflection.split(/[.!?]+/).filter((s) => s.trim().length > 0).length;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-3 sm:px-4 pb-20 pt-4">
      <Toaster position="top-center" theme="dark" />

      {/* Task Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-4">
        {['part1', 'part2', 'part3'].map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setActiveTab(p)}
            className={cn(
              'px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-full transition-all',
              activeTab === p
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground'
            )}
          >
            {worksheetData[p].title}
          </button>
        ))}
      </div>

      {/* Save Status Bar */}
      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-2.5 text-sm shadow-sm transition-all',
          saveStatus === 'saving' && 'border-primary/40 bg-primary/10',
          saveStatus === 'error' && 'border-destructive/40 bg-destructive/10',
          saveStatus === 'success' && 'border-accent/40 bg-accent/10',
          saveStatus === 'idle' && 'border-border bg-card/90'
        )}
      >
        <SaveStatusIndicator status={saveStatus} error={saveError} lastSavedAt={lastSavedAt} />
        <span className="text-xs text-muted-foreground">저장 후 교사 채점 화면에 반영됩니다</span>
      </div>

      {/* Header */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wider text-primary">{part.title}</p>
        <h1 className="mt-1 text-xl sm:text-2xl font-bold">{part.promptTitle}</h1>
        <p className="mt-1 text-xs sm:text-sm text-muted-foreground">{part.guideNote}</p>
      </div>

      {/* Inquiry Section */}
      <section className="rounded-2xl border border-inquiry-foreground/20 bg-inquiry p-4 sm:p-6 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-inquiry-foreground shrink-0" />
          <h2 className="text-base sm:text-lg font-bold text-inquiry-foreground">1단계. 아이디어 메모 (선택)</h2>
        </div>
        <p className="text-sm leading-relaxed text-inquiry-foreground/95">{part.conceptQuestion}</p>
        <textarea
          value={inquiry}
          onChange={(e) => setInquiry(e.target.value)}
          placeholder="핵심 아이디어나 근거를 간단히 적어 보세요..."
          className="mt-4 min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </section>

      {/* Essay Writing Section */}
      <section className="rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary shrink-0" />
          <h2 className="text-base sm:text-lg font-bold text-foreground">2단계. 영어 에세이 작성</h2>
        </div>

        <div className="rounded-xl border border-border bg-secondary/30 p-3 sm:p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            추천 키워드 (누르면 에세이에 추가됩니다)
          </p>
          <div className="flex flex-wrap gap-2">
            {part.writingKeywords.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => insertKeyword(k)}
                className="flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground transition-all hover:border-primary hover:bg-primary hover:text-primary-foreground"
              >
                <span>+</span>
                {k}
              </button>
            ))}
          </div>
        </div>

        <textarea
          value={reflection}
          onChange={(e) => setReflection(e.target.value)}
          placeholder="Write your English essay here..."
          className="min-h-48 w-full rounded-xl border border-input bg-background px-3.5 py-3 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>권장 분량: 35단어 이상</span>
          <span>
            {wordCount} words, {sentenceCount} sentences
          </span>
        </div>
      </section>

      {/* Bottom Save Bar */}
      <div className="sticky bottom-3 z-30 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur">
        <SaveStatusIndicator status={saveStatus} error={saveError} lastSavedAt={lastSavedAt} />
        <button
          type="button"
          onClick={save}
          disabled={saveStatus === 'saving'}
          className="inline-flex items-center justify-center rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-6 disabled:opacity-50"
        >
          <Save className="mr-2 h-4 w-4" />
          {saveStatus === 'saving' ? '저장 중...' : '저장하기'}
        </button>
      </div>
    </div>
  );
};

export default Worksheet;
