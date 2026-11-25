import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { signOutUser, isTeacherUser } from '../lib/mockFirebase';
import { LogOut, LayoutDashboard, FileText, PenLine, MessageSquare } from 'lucide-react';
import { cn } from '../lib/utils';

const Layout = ({ user, setUser }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await signOutUser();
    setUser(null);
    navigate('/');
  };

  if (!user) return <Outlet />;

  const isTeacher = isTeacherUser(user);
  const currentPath = location.pathname;

  return (
    <div className="min-h-screen bg-background text-foreground font-sans antialiased">
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary ring-1 ring-primary/30">
              {(user.displayName || 'U').slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold truncate">{user.displayName}</h2>
              <span className="text-[11px] text-muted-foreground block">
                {isTeacher ? '교사 모드' : '학생 모드'}
              </span>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-1.5">
            {isTeacher ? (
              <>
                <button
                  type="button"
                  onClick={() => navigate('/admin')}
                  className={cn(
                    'inline-flex items-center justify-center rounded-lg text-xs sm:text-sm font-medium transition-colors h-8 sm:h-9 px-2.5 sm:px-3.5',
                    currentPath === '/admin' ? 'bg-primary/15 text-primary' : 'hover:bg-secondary text-muted-foreground hover:text-foreground'
                  )}
                >
                  <LayoutDashboard className="mr-1.5 h-4 w-4 shrink-0" />
                  <span>현황</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/essay-grader')}
                  className={cn(
                    'inline-flex items-center justify-center rounded-lg text-xs sm:text-sm font-medium transition-colors h-8 sm:h-9 px-2.5 sm:px-3.5',
                    currentPath === '/essay-grader' ? 'bg-primary/15 text-primary' : 'hover:bg-secondary text-muted-foreground hover:text-foreground'
                  )}
                >
                  <PenLine className="mr-1.5 h-4 w-4 shrink-0" />
                  <span>채점기</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => navigate('/worksheet')}
                  className={cn(
                    'inline-flex items-center justify-center rounded-lg text-xs sm:text-sm font-medium transition-colors h-8 sm:h-9 px-2.5 sm:px-3.5',
                    currentPath === '/worksheet' ? 'bg-primary/15 text-primary' : 'hover:bg-secondary text-muted-foreground hover:text-foreground'
                  )}
                >
                  <FileText className="mr-1.5 h-4 w-4 shrink-0" />
                  <span>작성하기</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/feedback')}
                  className={cn(
                    'inline-flex items-center justify-center rounded-lg text-xs sm:text-sm font-medium transition-colors h-8 sm:h-9 px-2.5 sm:px-3.5',
                    currentPath === '/feedback' ? 'bg-primary/15 text-primary' : 'hover:bg-secondary text-muted-foreground hover:text-foreground'
                  )}
                >
                  <MessageSquare className="mr-1.5 h-4 w-4 shrink-0" />
                  <span>내 피드백</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center justify-center rounded-lg text-xs sm:text-sm font-medium border border-input bg-background hover:bg-secondary transition-colors h-8 sm:h-9 px-2.5 sm:px-3"
            >
              <LogOut className="mr-1.5 h-3.5 w-3.5 shrink-0" />
              <span>나가기</span>
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-1 bg-background">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
