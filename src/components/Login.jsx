import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEMO_ACCOUNTS, loginWithAccount } from '../lib/mockFirebase';
import { BookOpen, GraduationCap, UserCheck, ShieldCheck } from 'lucide-react';

const Login = ({ setUser }) => {
  const navigate = useNavigate();
  const [role, setRole] = useState('teacher');
  const [accountId, setAccountId] = useState('');
  const [error, setError] = useState('');

  const handleQuickDemo = (account) => {
    const logged = loginWithAccount(account);
    if (logged) {
      setUser(logged);
      navigate(account.role === 'teacher' ? '/essay-grader' : '/worksheet');
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    const cleaned = accountId.trim();
    if (!cleaned) {
      setError('식별 ID 또는 이메일을 입력해 주세요.');
      return;
    }
    const email = cleaned.includes('@') ? cleaned : `${cleaned}@example.edu`;
    const displayName = cleaned.includes('@') ? cleaned.split('@')[0] : cleaned;
    const logged = loginWithAccount({ email, displayName, role });
    if (logged) {
      setUser(logged);
      navigate(role === 'teacher' ? '/essay-grader' : '/worksheet');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background px-4 py-8">
      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 max-w-md w-full shadow-lg space-y-6">
        <div className="text-center">
          <div className="inline-flex bg-primary/20 p-3.5 rounded-2xl mb-4">
            <BookOpen className="h-9 w-9 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">AI Essay Grader</h1>
          <p className="text-sm text-muted-foreground mt-1">
            영어 영작문 첨삭, 루브릭 채점, 일괄 분석 도구
          </p>
        </div>

        {/* Quick Demo Accounts */}
        <div className="space-y-2.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            빠른 체험 로그인 (가상 계정)
          </p>
          <button
            type="button"
            onClick={() => handleQuickDemo(DEMO_ACCOUNTS.teacher)}
            className="w-full flex items-center justify-between rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-3 text-sm font-semibold transition-colors"
          >
            <span className="flex items-center gap-2.5">
              <GraduationCap className="h-4 w-4" /> 교사용 대시보드 시작
            </span>
            <span className="text-xs opacity-80">채점·루브릭·CSV</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickDemo(DEMO_ACCOUNTS.sample01)}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-secondary/40 hover:bg-secondary px-3 py-2.5 text-xs font-medium text-foreground transition-colors"
            >
              <UserCheck className="h-3.5 w-3.5 text-primary" /> Sample 01
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemo(DEMO_ACCOUNTS.sample02)}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-secondary/40 hover:bg-secondary px-3 py-2.5 text-xs font-medium text-foreground transition-colors"
            >
              <UserCheck className="h-3.5 w-3.5 text-accent" /> Sample 02
            </button>
          </div>
        </div>

        {/* Custom Anonymous Login */}
        <form onSubmit={handleFormSubmit} className="space-y-3 border-t border-border pt-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            식별 ID로 로그인 (학생 실명 사용 금지 권장)
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setRole('teacher')}
              className={`rounded-lg border py-2 text-xs font-medium transition-colors ${
                role === 'teacher' ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground'
              }`}
            >
              교사 모드
            </button>
            <button
              type="button"
              onClick={() => setRole('student')}
              className={`rounded-lg border py-2 text-xs font-medium transition-colors ${
                role === 'student' ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground'
              }`}
            >
              학생 모드
            </button>
          </div>
          <input
            type="text"
            value={accountId}
            onChange={(e) => {
              setAccountId(e.target.value);
              setError('');
            }}
            placeholder="예: class1_no05 또는 teacher"
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <button
            type="submit"
            className="w-full rounded-lg border border-border bg-background hover:bg-secondary py-2.5 text-sm font-medium text-foreground transition-colors"
          >
            입장하기
          </button>
        </form>

        <div className="flex items-start gap-2 rounded-xl bg-secondary/30 p-3 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>
            모든 데이터와 Gemini API 키는 사용자 브라우저 로컬에만 저장됩니다. 키 없이도 규칙 기반 폴백 채점을 바로 사용할 수 있습니다.
          </span>
        </div>
      </div>
    </div>
  );
};

export default Login;
