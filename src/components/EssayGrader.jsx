import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getAllStudentsData,
  getAllGradingResultsMap,
  isTeacherUser,
  getRubric,
  saveGradingResult,
  getGradingResult,
  upsertBatchSubmissions,
  seedSampleEssaysIfEmpty,
} from '../lib/mockFirebase';
import {
  gradeEssay,
  getApiKey,
  setApiKey,
  getSelectedModel,
  setSelectedModel,
  GEMINI_MODELS,
  evaluateScoreVariance,
  buildGradingCsv,
} from '../lib/essayGrader';
import { DEFAULT_RUBRIC, recalculateRubricTotal } from '../data/gradingRubric';
import { worksheetData } from '../data/worksheetData';
import RubricEditor from './RubricEditor';
import SentenceHighlighter from './SentenceHighlighter';
import { cn } from '../lib/utils';
import { toast, Toaster } from 'sonner';
import {
  Users,
  Settings2,
  Sparkles,
  Loader2,
  AlertTriangle,
  ArrowLeft,
  Key,
  Send,
  PenLine,
  RotateCcw,
  Download,
  ListChecks,
  HelpCircle,
  CheckCircle2,
  EyeOff,
  Eye,
  PlusCircle,
} from 'lucide-react';

const ScoreCircle = ({ score, max, label, onChange }) => {
  const safeMax = max > 0 ? max : 25;
  const pct = Math.min(100, Math.max(0, (score / safeMax) * 100));
  const r = 34;
  const c = 2 * Math.PI * r;
  const color = pct >= 80 ? '#22c55e' : pct >= 60 ? '#3b82f6' : pct >= 40 ? '#eab308' : '#ef4444';

  return (
    <div className="flex flex-col items-center gap-1.5 min-w-[92px]">
      <div className="relative w-20 h-20">
        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={r} fill="none" stroke="currentColor" className="text-secondary" strokeWidth="6" />
          <circle
            cx="40"
            cy="40"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeDasharray={c}
            strokeDashoffset={c - (c * pct) / 100}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-base font-bold" style={{ color }}>{score}</span>
          <span className="text-[10px] text-muted-foreground">/{safeMax}</span>
        </div>
      </div>
      <span className="text-xs font-medium text-muted-foreground text-center leading-tight">{label}</span>
      {onChange && (
        <input
          type="range"
          min={0}
          max={safeMax}
          value={score}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          className="w-20 accent-primary"
        />
      )}
    </div>
  );
};

function parseBatchText(rawText) {
  const blocks = rawText
    .split(/\n\s*(?:===|---)\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  return blocks.map((block, index) => {
    const lines = block.split(/\r?\n/);
    const firstLine = lines[0]?.trim() || '';
    const idMatch = firstLine.match(/^\[([^\]]+)\]$/) || firstLine.match(/^ID\s*:\s*(.+)$/i);
    if (idMatch && lines.length > 1) {
      return {
        id: idMatch[1].trim(),
        essay: lines.slice(1).join('\n').trim(),
      };
    }
    return {
      id: `Batch ${String(index + 1).padStart(2, '0')}`,
      essay: block,
    };
  });
}

const EssayGrader = ({ user }) => {
  const navigate = useNavigate();
  const [activeMode, setActiveMode] = useState('single'); // 'single' | 'batch'
  const [students, setStudents] = useState([]);
  const [gradingMap, setGradingMap] = useState({});
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedPart, setSelectedPart] = useState('part1');
  const [rubric, setRubric] = useState(DEFAULT_RUBRIC);
  const [showRubricEditor, setShowRubricEditor] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  // BYOK API Key & Model
  const [apiKeyInput, setApiKeyInput] = useState(() => getApiKey());
  const [selectedModel, setModelState] = useState(() => getSelectedModel());
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);

  // Single Grading State
  const [grading, setGrading] = useState(false);
  const [result, setResult] = useState(null);
  const [editedScores, setEditedScores] = useState({});
  const [editedStudentFeedback, setEditedStudentFeedback] = useState('');
  const [editedTeacherSummary, setEditedTeacherSummary] = useState('');
  const [editedTeacherFocus, setEditedTeacherFocus] = useState('');
  const [saving, setSaving] = useState(false);

  // Batch Grading State
  const [selectedBatchEmails, setSelectedBatchEmails] = useState([]);
  const [batchProgress, setBatchProgress] = useState({ running: false, current: 0, total: 0 });
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [batchPasteText, setBatchPasteText] = useState('');

  const refreshData = useCallback(async (keepSelectionEmail = null) => {
    const [studs, gMap, savedRubric] = await Promise.all([
      getAllStudentsData(),
      getAllGradingResultsMap(),
      getRubric(),
    ]);
    setStudents(studs);
    setGradingMap(gMap);
    if (savedRubric) setRubric(recalculateRubricTotal(savedRubric));

    setSelectedBatchEmails((prev) => {
      if (prev.length > 0) return prev.filter((em) => studs.some((s) => s.email === em));
      return studs.filter((s) => s[selectedPart]?.reflection).map((s) => s.email);
    });

    if (keepSelectionEmail) {
      const found = studs.find((s) => s.email === keepSelectionEmail);
      if (found) setSelectedStudent(found);
    } else {
      setSelectedStudent((prev) => prev || studs[0] || null);
    }
  }, [selectedPart]);

  useEffect(() => {
    if (!user || !isTeacherUser(user)) {
      navigate('/');
      return;
    }
    let mounted = true;
    const init = async () => {
      if (mounted) await refreshData();
    };
    init();
    return () => {
      mounted = false;
    };
  }, [user, navigate, refreshData]);

  const syncFormFromResult = useCallback((res) => {
    if (!res) {
      setResult(null);
      setEditedScores({});
      setEditedStudentFeedback('');
      setEditedTeacherSummary('');
      setEditedTeacherFocus('');
      return;
    }
    setResult(res);
    setEditedScores(res.scores || {});
    setEditedStudentFeedback(res.studentFeedback?.overall || res.feedback?.overall || '');
    setEditedTeacherSummary(res.teacherSummary?.overview || '');
    setEditedTeacherFocus(res.teacherSummary?.instructionalFocus || '');
  }, []);

  useEffect(() => {
    if (!selectedStudent) return;
    const loadExisting = async () => {
      const existing = await getGradingResult(selectedStudent.email, selectedPart);
      syncFormFromResult(existing);
    };
    loadExisting();
  }, [selectedStudent, selectedPart, syncFormFromResult]);

  const getStudentEssay = (student = selectedStudent, partKey = selectedPart) => {
    if (!student) return '';
    return student[partKey]?.reflection || student[partKey]?.opinionWriting || '';
  };

  const handleGradeSingle = async () => {
    const essay = getStudentEssay();
    if (!essay.trim()) {
      toast.error('선택한 과제에 학생이 작성한 에세이가 없습니다.');
      return;
    }

    setGrading(true);
    try {
      const key = getApiKey();
      const existing = await getGradingResult(selectedStudent.email, selectedPart);
      const history = existing?.gradingHistory || [];

      const rawRes = await gradeEssay(essay, rubric, selectedPart, key, selectedModel);
      const variance = evaluateScoreVariance(history, rawRes.totalScore, rawRes.scores, rubric);

      const enriched = {
        ...rawRes,
        originalEssay: essay,
        needsTeacherReview: variance.needsTeacherReview,
        reviewReason: variance.reviewReason,
        varianceDiff: variance.diffPoints,
        finalized: existing?.finalized || false,
      };

      const saved = await saveGradingResult(selectedStudent.email, selectedPart, enriched, {
        recordHistory: true,
        forceNewAttempt: true,
      });

      syncFormFromResult(saved);
      await refreshData(selectedStudent.email);

      if (saved.needsTeacherReview) {
        toast.warning('이전 채점과 점수 차이가 커서 "교사 확인 필요"로 표시되었습니다.');
      } else if (saved._fallback) {
        toast('규칙 기반 폴백 모드로 채점했습니다.');
      } else {
        toast.success('AI 에세이 분석이 완료되었습니다.');
      }
    } catch (err) {
      toast.error(`분석 실패: ${err.message}`);
    } finally {
      setGrading(false);
    }
  };

  const handleSaveSingle = async (markReviewed = false) => {
    if (!result || !selectedStudent) return;
    setSaving(true);
    const totalScore = Object.values(editedScores).reduce((a, b) => a + (Number(b) || 0), 0);
    const updated = {
      ...result,
      originalEssay: getStudentEssay(),
      scores: editedScores,
      totalScore,
      maxTotalScore: rubric.totalPoints,
      rubricSnapshot: rubric,
      studentFeedback: {
        ...(result.studentFeedback || {}),
        overall: editedStudentFeedback,
      },
      teacherSummary: {
        ...(result.teacherSummary || {}),
        overview: editedTeacherSummary,
        instructionalFocus: editedTeacherFocus,
      },
      needsTeacherReview: markReviewed ? false : result.needsTeacherReview,
      reviewReason: markReviewed ? '' : result.reviewReason,
      teacherConfirmedAt: markReviewed ? new Date().toISOString() : result.teacherConfirmedAt,
      finalized: true,
    };

    const saved = await saveGradingResult(selectedStudent.email, selectedPart, updated, {
      recordHistory: true,
      forceNewAttempt: false,
    });
    syncFormFromResult(saved);
    await refreshData(selectedStudent.email);
    toast.success(markReviewed ? '확인 완료 및 학생에게 공개 저장되었습니다.' : '채점 결과가 저장되어 학생에게 공개되었습니다.');
    setSaving(false);
  };

  const handleSaveApiKey = () => {
    setApiKey(apiKeyInput);
    setSelectedModel(selectedModel);
    setShowApiKeyInput(false);
    toast.success(apiKeyInput.trim() ? 'API 키와 모델 설정을 브라우저에 저장했습니다.' : 'API 키를 제거했습니다(폴백 모드 사용).');
  };

  const toggleBatchSelect = (email) => {
    setSelectedBatchEmails((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]
    );
  };

  const handleRunBatch = async () => {
    const targets = students.filter(
      (s) => selectedBatchEmails.includes(s.email) && getStudentEssay(s, selectedPart).trim().length > 0
    );
    if (targets.length === 0) {
      toast.error('일괄 채점할 에세이를 하나 이상 선택해 주세요.');
      return;
    }

    setBatchProgress({ running: true, current: 0, total: targets.length });
    const key = getApiKey();
    let reviewCount = 0;

    for (let i = 0; i < targets.length; i++) {
      const student = targets[i];
      const essayText = getStudentEssay(student, selectedPart);
      try {
        const existing = await getGradingResult(student.email, selectedPart);
        const history = existing?.gradingHistory || [];
        const rawRes = await gradeEssay(essayText, rubric, selectedPart, key, selectedModel);
        const variance = evaluateScoreVariance(history, rawRes.totalScore, rawRes.scores, rubric);
        if (variance.needsTeacherReview) reviewCount++;

        await saveGradingResult(
          student.email,
          selectedPart,
          {
            ...rawRes,
            originalEssay: essayText,
            needsTeacherReview: variance.needsTeacherReview,
            reviewReason: variance.reviewReason,
            varianceDiff: variance.diffPoints,
            finalized: true,
          },
          { recordHistory: true, forceNewAttempt: true }
        );
      } catch (err) {
        console.error(`Batch error for ${student.name}:`, err);
      }
      setBatchProgress({ running: true, current: i + 1, total: targets.length });
      if (key && i < targets.length - 1) {
        await new Promise((r) => setTimeout(r, 350));
      }
    }

    await refreshData();
    setBatchProgress({ running: false, current: 0, total: 0 });
    toast.success(
      reviewCount > 0
        ? `${targets.length}편 채점 완료 ("교사 확인 필요" ${reviewCount}건 발생)`
        : `${targets.length}편 일괄 채점이 완료되었습니다.`
    );
  };

  const handleImportBatchText = async () => {
    const entries = parseBatchText(batchPasteText);
    if (entries.length === 0) {
      toast.error('등록할 에세이 본문을 입력해 주세요.');
      return;
    }
    const created = await upsertBatchSubmissions(entries, selectedPart);
    await refreshData();
    setSelectedBatchEmails((prev) => [...new Set([...prev, ...created.map((c) => c.email)])]);
    setBatchPasteText('');
    setShowBatchImport(false);
    toast.success(`${created.length}편의 에세이가 목록에 추가되었습니다.`);
  };

  const handleExportCsv = () => {
    const rows = students
      .filter((s) => getStudentEssay(s, selectedPart).trim().length > 0)
      .map((s) => {
        const text = getStudentEssay(s, selectedPart);
        return {
          name: s.name,
          partKey: selectedPart,
          wordCount: text.trim().split(/\s+/).filter(Boolean).length,
          result: gradingMap[s.email]?.[selectedPart] || null,
        };
      });

    if (rows.length === 0) {
      toast.error('내보낼 데이터가 없습니다.');
      return;
    }

    const csv = buildGradingCsv(rows, rubric);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateTag = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    link.href = url;
    link.setAttribute('download', `essay-grading-${selectedPart}-${dateTag}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`${rows.length}건의 채점 결과를 CSV로 내보냈습니다.`);
  };

  const handleRestoreSamples = async () => {
    seedSampleEssaysIfEmpty(true);
    await refreshData();
    toast.success('가상 샘플 에세이 2편(Sample 01, Sample 02)을 복원했습니다.');
  };

  const essay = getStudentEssay();
  const totalEdited = Object.values(editedScores).reduce((a, b) => a + (Number(b) || 0), 0);
  const currentMaxTotal = result?.maxTotalScore || rubric.totalPoints;
  const activeCriteria = result?.rubricSnapshot?.criteria || rubric.criteria;
  const hasApiKey = Boolean(getApiKey());

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-4 py-5 space-y-5">
      <Toaster position="top-center" theme="dark" />
      {showRubricEditor && (
        <RubricEditor
          onClose={() => setShowRubricEditor(false)}
          onSave={(r) => {
            setRubric(recalculateRubricTotal(r));
            setShowRubricEditor(false);
          }}
        />
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigate('/admin')}
            aria-label="제출 현황으로 돌아가기"
            className="rounded-lg p-2 border border-border hover:bg-secondary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-lg sm:text-2xl font-bold flex items-center gap-2">
              <PenLine className="h-5 w-5 text-primary shrink-0" />
              <span>AI 에세이 채점기</span>
            </h1>
            <p className="text-xs text-muted-foreground">루브릭 4영역 채점, 문장별 첨삭, 일괄 채점 및 CSV 내보내기</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowGuide(!showGuide)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 sm:px-3 py-2 text-xs sm:text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <HelpCircle className="h-4 w-4" /> 사용 안내
          </button>
          <button
            type="button"
            onClick={() => setShowApiKeyInput(!showApiKeyInput)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-2.5 sm:px-3 py-2 text-xs sm:text-sm transition-colors',
              hasApiKey
                ? 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                : 'border-border text-muted-foreground hover:bg-secondary'
            )}
          >
            <Key className="h-4 w-4" />
            <span>{hasApiKey ? 'Gemini 연결됨' : 'API 키 설정'}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowRubricEditor(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 sm:px-3 py-2 text-xs sm:text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <Settings2 className="h-4 w-4" /> 루브릭 ({rubric.totalPoints}점)
          </button>
        </div>
      </div>

      {/* Classroom Usage Guide */}
      {showGuide && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 text-xs sm:text-sm space-y-2">
          <p className="font-bold text-primary">수업 활용 4단계 안내</p>
          <ol className="list-decimal list-inside space-y-1 text-foreground/90">
            <li>상단 <strong>루브릭</strong> 버튼에서 내용, 구성, 언어, 문법 4개 영역의 배점을 수업 기준에 맞게 조정하세요.</li>
            <li>Gemini API 키가 없어도 <strong>규칙 기반 폴백 모드</strong>로 문법 교정과 채점을 즉시 실행할 수 있습니다. (무료 키 입력 시 Gemini 분석 활성화)</li>
            <li><strong>개별 채점</strong>에서 문장별 하이라이트와 교사용 요약을 확인하고, 필요하면 점수 슬라이더를 수정해 학생에게 공개 저장하세요.</li>
            <li><strong>일괄 채점 및 CSV</strong> 탭에서 여러 에세이를 한 번에 채점하고 엑셀 호환 CSV 파일로 내려받으세요. 2회 채점 점수가 크게 다르면 <strong>교사 확인 필요</strong> 경고가 자동 표시됩니다.</li>
          </ol>
        </div>
      )}

      {/* BYOK API Key & Model Panel */}
      {showApiKeyInput && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="flex flex-1 items-center gap-2 rounded-lg border border-input bg-background px-3 py-2">
              <Key className="h-4 w-4 text-primary shrink-0" />
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="본인의 Gemini API 키 입력 (브라우저 로컬에만 저장)..."
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
            <select
              value={selectedModel}
              onChange={(e) => setModelState(e.target.value)}
              aria-label="Gemini 모델 선택"
              className="rounded-lg border border-input bg-background px-3 py-2 text-xs sm:text-sm text-foreground"
            >
              {GEMINI_MODELS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleSaveApiKey}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 shrink-0"
            >
              저장
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            API 키를 비워 두고 저장하면 외부 전송 없이 브라우저 내장 규칙 기반 폴백 엔진으로 동작합니다.
          </p>
        </div>
      )}

      {/* Top Mode & Part Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveMode('single')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-semibold transition-colors',
              activeMode === 'single' ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-muted-foreground hover:text-foreground'
            )}
          >
            <PenLine className="h-4 w-4" /> 개별 첨삭 및 채점
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('batch')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-semibold transition-colors',
              activeMode === 'batch' ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-muted-foreground hover:text-foreground'
            )}
          >
            <ListChecks className="h-4 w-4" /> 일괄 채점 및 CSV
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {['part1', 'part2', 'part3'].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setSelectedPart(p)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-full transition-all',
                selectedPart === p ? 'bg-primary/20 text-primary border border-primary/40' : 'bg-secondary/40 text-muted-foreground hover:bg-secondary'
              )}
            >
              {worksheetData[p].title}
            </button>
          ))}
        </div>
      </div>

      {/* ─── MODE 1: SINGLE GRADING ─── */}
      {activeMode === 'single' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Student List */}
          <div className="lg:col-span-3 rounded-2xl border border-border bg-card p-4 max-h-[75vh] overflow-y-auto space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold flex items-center gap-2 text-foreground">
                <Users className="h-4 w-4 text-primary" /> 제출 목록 ({students.length})
              </h2>
              <button
                type="button"
                onClick={handleRestoreSamples}
                className="text-[11px] text-primary hover:underline"
              >
                샘플 복원
              </button>
            </div>

            {students.length === 0 ? (
              <p className="text-muted-foreground text-xs text-center py-8">제출된 에세이가 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {students.map((s) => {
                  const isSelected = selectedStudent?.email === s.email;
                  const hasEssay = !!getStudentEssay(s, selectedPart);
                  const existingGrade = gradingMap[s.email]?.[selectedPart];

                  return (
                    <button
                      key={s.email}
                      type="button"
                      onClick={() => setSelectedStudent(s)}
                      className={cn(
                        'w-full text-left rounded-xl border p-3 transition-all',
                        isSelected ? 'border-primary bg-primary/10' : 'border-border bg-background hover:border-primary/40'
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn('text-sm font-medium truncate', isSelected ? 'text-primary' : 'text-foreground')}>
                          {s.name}
                        </span>
                        {existingGrade?.needsTeacherReview ? (
                          <span className="shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                            확인 필요
                          </span>
                        ) : existingGrade ? (
                          <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                            {existingGrade.totalScore}점
                          </span>
                        ) : hasEssay ? (
                          <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] text-accent">
                            미채점
                          </span>
                        ) : null}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{s.email}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Essay + Analysis */}
          <div className="lg:col-span-9">
            {!selectedStudent ? (
              <div className="rounded-2xl border border-border bg-card p-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                <h3 className="text-lg text-muted-foreground">목록에서 학생을 선택하세요</h3>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                {/* Left: Essay & Sentence Highlighter */}
                <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-foreground">{selectedStudent.name} 에세이</h3>
                      <p className="text-xs text-muted-foreground">{worksheetData[selectedPart].title}</p>
                    </div>
                    {essay && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{essay.trim().split(/\s+/).filter(Boolean).length}단어</span>
                      </div>
                    )}
                  </div>

                  {result ? (
                    <SentenceHighlighter
                      essay={essay}
                      corrections={result.grammarCorrections || []}
                      correctedEssay={result.correctedEssay}
                    />
                  ) : essay ? (
                    <div className="rounded-xl border border-border bg-background p-4 min-h-[160px]">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground break-words">{essay}</p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-8 text-center">
                      <p className="text-sm text-muted-foreground">이 과제에 작성된 에세이가 없습니다.</p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleGradeSingle}
                    disabled={grading || !essay}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {grading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> 채점 분석 중...
                      </>
                    ) : result ? (
                      <>
                        <RotateCcw className="h-4 w-4" /> 다시 채점하기 (2차 편차 검사)
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" /> {hasApiKey ? 'AI 에세이 채점 실행' : '폴백 규칙 기반 채점 실행'}
                      </>
                    )}
                  </button>
                </div>

                {/* Right: Results */}
                <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                  {!result ? (
                    <div className="flex flex-col items-center justify-center h-full min-h-[320px] text-center">
                      <Sparkles className="h-10 w-10 text-muted-foreground/30 mb-3" />
                      <h3 className="text-base font-medium text-muted-foreground">채점 대기 중</h3>
                      <p className="text-xs text-muted-foreground/70 mt-1">좌측 하단 버튼을 눌러 분석을 시작하세요</p>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {/* Variance Warning Banner */}
                      {result.needsTeacherReview && (
                        <div className="rounded-xl border border-amber-500/40 bg-amber-500/15 p-3.5 space-y-2">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-300 shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-xs sm:text-sm font-bold text-amber-200">교사 확인 필요</p>
                              <p className="text-xs text-amber-200/85 mt-0.5">{result.reviewReason}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSaveSingle(true)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/25 hover:bg-amber-500/35 px-3 py-1.5 text-xs font-semibold text-amber-100"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> 점수 검토 후 확인 완료 처리
                          </button>
                        </div>
                      )}

                      {/* Fallback Notice */}
                      {result._fallback && (
                        <div className="flex items-start gap-2 rounded-lg border border-border bg-secondary/40 p-3">
                          <AlertTriangle className="h-4 w-4 text-amber-300 mt-0.5 shrink-0" />
                          <div className="text-xs">
                            <p className="font-semibold text-foreground">규칙 기반 폴백 모드</p>
                            <p className="text-muted-foreground">{result._fallbackReason}</p>
                          </div>
                        </div>
                      )}

                      {/* Score History Strip */}
                      {result.gradingHistory?.length > 1 && (
                        <div className="rounded-lg border border-border bg-background p-2.5 text-xs">
                          <span className="font-semibold text-muted-foreground mr-2">채점 회차 기록:</span>
                          <span className="text-foreground">
                            {result.gradingHistory.map((h) => `${h.attempt}차 ${h.totalScore}점`).join(' → ')}
                          </span>
                        </div>
                      )}

                      {/* Score Circles */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-bold text-foreground">영역별 점수 조정</h4>
                          <div>
                            <span className="text-2xl font-bold text-primary">{totalEdited}</span>
                            <span className="text-xs text-muted-foreground"> / {currentMaxTotal}점</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap justify-center gap-3">
                          {activeCriteria.map((c) => (
                            <ScoreCircle
                              key={c.id}
                              score={editedScores[c.id] ?? 0}
                              max={c.maxPoints}
                              label={c.name.split('(')[0].trim()}
                              onChange={(v) => setEditedScores((prev) => ({ ...prev, [c.id]: v }))}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Teacher Summary (Teacher-only) */}
                      <div className="rounded-xl border border-primary/25 bg-primary/5 p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-primary flex items-center gap-1.5">
                            <EyeOff className="h-3.5 w-3.5" /> 교사용 요약 (학생 화면 비공개)
                          </h4>
                          {result.teacherSummary?.riskFlags?.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {result.teacherSummary.riskFlags.map((flag) => (
                                <span key={flag} className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] text-rose-300">
                                  {flag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <textarea
                          value={editedTeacherSummary}
                          onChange={(e) => setEditedTeacherSummary(e.target.value)}
                          rows={2}
                          placeholder="교사용 진단 요약..."
                          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                        />
                        <input
                          type="text"
                          value={editedTeacherFocus}
                          onChange={(e) => setEditedTeacherFocus(e.target.value)}
                          placeholder="다음 지도 포인트..."
                          className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>

                      {/* Student Feedback (Student-facing) */}
                      <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3.5 space-y-2">
                        <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                          <Eye className="h-3.5 w-3.5" /> 학생용 피드백 (학생 화면 공개)
                        </h4>
                        {result.studentFeedback?.strengths && (
                          <p className="text-xs text-foreground/90">
                            <strong className="text-emerald-400">잘한 점:</strong> {result.studentFeedback.strengths}
                          </p>
                        )}
                        {result.studentFeedback?.improvements && (
                          <p className="text-xs text-foreground/90">
                            <strong className="text-amber-300">보완 가이드:</strong> {result.studentFeedback.improvements}
                          </p>
                        )}
                        <textarea
                          value={editedStudentFeedback}
                          onChange={(e) => setEditedStudentFeedback(e.target.value)}
                          rows={3}
                          placeholder="학생에게 전달할 종합 피드백..."
                          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                        />
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleGradeSingle}
                          disabled={grading}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-xs sm:text-sm text-muted-foreground hover:bg-secondary disabled:opacity-50"
                        >
                          <RotateCcw className="h-4 w-4" /> 재채점
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveSingle(false)}
                          disabled={saving}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-xs sm:text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                        >
                          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          {result.finalized ? '수정 저장 및 공개' : '확정 및 학생 공개'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ─── MODE 2: BATCH GRADING & CSV EXPORT ─── */
        <div className="space-y-4">
          {/* Batch Controls */}
          <div className="rounded-2xl border border-border bg-card p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleRunBatch}
                disabled={batchProgress.running}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs sm:text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {batchProgress.running ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    채점 중 ({batchProgress.current}/{batchProgress.total})
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> 선택 에세이 일괄 채점 ({selectedBatchEmails.length}편)
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowBatchImport(!showBatchImport)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2.5 text-xs sm:text-sm font-medium text-foreground hover:bg-secondary"
              >
                <PlusCircle className="h-4 w-4 text-primary" /> 여러 편 붙여넣기 등록
              </button>
            </div>

            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-xs sm:text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20"
            >
              <Download className="h-4 w-4" /> CSV 내보내기
            </button>
          </div>

          {/* Batch Paste Importer */}
          {showBatchImport && (
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs sm:text-sm font-semibold text-foreground">
                  여러 편 일괄 등록 (에세이 사이는 <code className="text-primary">---</code> 로 구분)
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setBatchPasteText(
                      `[Sample 03]\nFirst, students can protect local wildlife by reducing plastic waste. However, community effort is also needed for long-term habitat protection.\n---\n[Sample 04]\ni think nature protection is very interested and our daily action help animals`
                    )
                  }
                  className="text-xs text-primary hover:underline"
                >
                  가상 에세이 2편 예시 채우기
                </button>
              </div>
              <textarea
                value={batchPasteText}
                onChange={(e) => setBatchPasteText(e.target.value)}
                rows={6}
                placeholder={'[익명ID 1]\nFirst essay text...\n---\n[익명ID 2]\nSecond essay text...'}
                className="w-full rounded-xl border border-input bg-background p-3 text-xs sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowBatchImport(false)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleImportBatchText}
                  className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  목록에 추가
                </button>
              </div>
            </div>
          )}

          {/* Batch Results Table */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="border-b border-border bg-secondary/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="p-3 w-10">
                      <input
                        type="checkbox"
                        aria-label="전체 선택"
                        checked={
                          students.filter((s) => getStudentEssay(s, selectedPart)).length > 0 &&
                          students
                            .filter((s) => getStudentEssay(s, selectedPart))
                            .every((s) => selectedBatchEmails.includes(s.email))
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedBatchEmails(
                              students.filter((s) => getStudentEssay(s, selectedPart)).map((s) => s.email)
                            );
                          } else {
                            setSelectedBatchEmails([]);
                          }
                        }}
                      />
                    </th>
                    <th className="p-3">식별 ID</th>
                    <th className="p-3">단어</th>
                    {rubric.criteria.map((c) => (
                      <th key={c.id} className="p-3 whitespace-nowrap">
                        {c.name.split('(')[0].trim()}
                        <span className="text-[10px] text-muted-foreground">/{c.maxPoints}</span>
                      </th>
                    ))}
                    <th className="p-3">총점</th>
                    <th className="p-3">상태</th>
                    <th className="p-3 min-w-[200px]">교사용 요약</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {students
                    .filter((s) => getStudentEssay(s, selectedPart).trim().length > 0)
                    .map((s) => {
                      const text = getStudentEssay(s, selectedPart);
                      const wc = text.trim().split(/\s+/).filter(Boolean).length;
                      const g = gradingMap[s.email]?.[selectedPart];

                      return (
                        <tr key={s.email} className="hover:bg-secondary/20 transition-colors">
                          <td className="p-3">
                            <input
                              type="checkbox"
                              aria-label={`${s.name} 선택`}
                              checked={selectedBatchEmails.includes(s.email)}
                              onChange={() => toggleBatchSelect(s.email)}
                            />
                          </td>
                          <td className="p-3 font-medium">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedStudent(s);
                                setActiveMode('single');
                              }}
                              className="text-primary hover:underline text-left"
                            >
                              {s.name}
                            </button>
                          </td>
                          <td className="p-3 text-muted-foreground">{wc}</td>
                          {rubric.criteria.map((c) => (
                            <td key={c.id} className="p-3">
                              {g?.scores?.[c.id] ?? '-'}
                            </td>
                          ))}
                          <td className="p-3 font-bold text-primary">
                            {g ? `${g.totalScore}/${g.maxTotalScore || rubric.totalPoints}` : '-'}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            {!g ? (
                              <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                                대기
                              </span>
                            ) : g.needsTeacherReview ? (
                              <span
                                title={g.reviewReason}
                                className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-300"
                              >
                                <AlertTriangle className="h-3 w-3" /> 교사 확인 필요
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-400">
                                <CheckCircle2 className="h-3 w-3" /> 정상 ({g.gradingHistory?.length || 1}차)
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-xs text-muted-foreground">
                            {g?.teacherSummary?.overview || '아직 채점되지 않았습니다.'}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EssayGrader;
