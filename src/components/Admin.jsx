import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllStudentsData, getAllGradingResultsMap, isTeacherUser } from '../lib/mockFirebase';
import { worksheetData } from '../data/worksheetData';
import { Users, CheckCircle2, Clock, PenLine, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';

const Admin = ({ user }) => {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [gradingMap, setGradingMap] = useState({});
  const [selectedStudent, setSelectedStudent] = useState(null);

  useEffect(() => {
    if (!user || !isTeacherUser(user)) {
      navigate('/');
      return;
    }

    const loadStudents = async () => {
      const [data, gMap] = await Promise.all([getAllStudentsData(), getAllGradingResultsMap()]);
      setStudents(data);
      setGradingMap(gMap);
    };
    loadStudents();
  }, [user, navigate]);

  const calculateProgress = (studentData) => {
    let completedParts = 0;
    if (studentData.part1?.reflection) completedParts++;
    if (studentData.part2?.reflection) completedParts++;
    if (studentData.part3?.reflection) completedParts++;
    return completedParts;
  };

  return (
    <div className="mx-auto max-w-6xl px-3 sm:px-4 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Student List */}
        <div className="lg:col-span-1 rounded-2xl border border-border bg-card p-4 sm:p-6 flex flex-col max-h-[80vh]">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> 제출 목록
            </h2>
            <button
              type="button"
              onClick={() => navigate('/essay-grader')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              <PenLine className="h-3.5 w-3.5" /> 채점기로
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 space-y-2.5">
            {students.length === 0 ? (
              <p className="text-muted-foreground text-center py-8 text-sm">제출된 에세이가 없습니다.</p>
            ) : (
              students.map((student) => {
                const progress = calculateProgress(student);
                const isSelected = selectedStudent?.email === student.email;
                const studentGrades = gradingMap[student.email] || {};
                const hasFlag = Object.values(studentGrades).some((g) => g?.needsTeacherReview);

                return (
                  <button
                    key={student.email}
                    type="button"
                    className={cn(
                      'w-full text-left rounded-xl border p-3.5 transition-all hover:border-primary/50',
                      isSelected ? 'border-primary bg-primary/10 shadow-sm' : 'border-border bg-background'
                    )}
                    onClick={() => setSelectedStudent(student)}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h4 className={cn('font-semibold text-sm truncate', isSelected ? 'text-primary' : 'text-foreground')}>
                        {student.name}
                      </h4>
                      {hasFlag && (
                        <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                          <AlertTriangle className="h-3 w-3" /> 확인 필요
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mb-2.5 truncate">{student.email}</p>

                    <div className="flex gap-1 mb-1">
                      {[1, 2, 3].map((step) => (
                        <div
                          key={step}
                          className={cn('h-1.5 flex-1 rounded-full', step <= progress ? 'bg-primary' : 'bg-muted')}
                        />
                      ))}
                    </div>
                    <p className="text-[10px] text-right text-muted-foreground">{progress}/3 과제 제출</p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Detail */}
        <div className="lg:col-span-2">
          {!selectedStudent ? (
            <div className="rounded-2xl border border-border bg-card p-8 sm:p-12 text-center flex flex-col items-center justify-center min-h-[360px]">
              <Users className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground">제출 항목을 선택하세요</h3>
              <p className="text-xs text-muted-foreground/70 mt-1">과제별 작성 내용과 채점 상태를 확인할 수 있습니다</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-4 sm:p-6 space-y-6">
              <div className="flex flex-wrap justify-between items-center gap-2 border-b border-border pb-4">
                <div>
                  <h2 className="text-xl font-bold text-foreground">{selectedStudent.name} 제출 현황</h2>
                  <p className="text-xs text-muted-foreground">{selectedStudent.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/essay-grader')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <PenLine className="h-3.5 w-3.5" /> 채점 화면에서 열기
                </button>
              </div>

              {['part1', 'part2', 'part3'].map((partKey) => {
                const pData = selectedStudent[partKey] || {};
                const wData = worksheetData[partKey];
                const grade = gradingMap[selectedStudent.email]?.[partKey];
                const hasEssay = !!pData.reflection;

                return (
                  <div key={partKey} className="rounded-xl border border-border bg-background p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm sm:text-base font-bold flex items-center gap-2 text-foreground">
                        {wData.title}
                        {hasEssay ? (
                          <CheckCircle2 className="h-4 w-4 text-accent" />
                        ) : (
                          <Clock className="h-4 w-4 text-muted-foreground" />
                        )}
                      </h3>
                      {grade && (
                        <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary">
                          {grade.totalScore}/{grade.maxTotalScore || 100}점
                        </span>
                      )}
                    </div>

                    {!hasEssay ? (
                      <p className="text-xs text-muted-foreground italic">아직 제출되지 않았습니다.</p>
                    ) : (
                      <div className="space-y-2.5">
                        {pData.inquiry_answer && (
                          <div className="rounded-lg bg-secondary/30 p-3">
                            <p className="text-[11px] font-semibold text-primary mb-1">아이디어 메모</p>
                            <p className="text-xs text-foreground whitespace-pre-wrap break-words">{pData.inquiry_answer}</p>
                          </div>
                        )}
                        <div className="rounded-lg bg-secondary/20 p-3">
                          <p className="text-[11px] font-semibold text-muted-foreground mb-1">제출 에세이</p>
                          <p className="text-sm text-foreground whitespace-pre-wrap break-words">{pData.reflection}</p>
                        </div>
                        {grade?.teacherSummary?.overview && (
                          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                            <p className="text-[11px] font-semibold text-primary mb-1">교사용 요약</p>
                            <p className="text-xs text-foreground">{grade.teacherSummary.overview}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Admin;
