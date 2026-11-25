import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Layout from './components/Layout';
import Worksheet from './components/Worksheet';
import Admin from './components/Admin';
import EssayGrader from './components/EssayGrader';
import EssayFeedback from './components/EssayFeedback';
import { getCurrentUser, isTeacherUser } from './lib/mockFirebase';

function App() {
  const [user, setUser] = useState(() => getCurrentUser());

  const defaultHome = user ? (isTeacherUser(user) ? '/essay-grader' : '/worksheet') : '/';

  return (
    <Routes>
      <Route path="/" element={!user ? <Login setUser={setUser} /> : <Navigate to={defaultHome} replace />} />
      <Route element={<Layout user={user} setUser={setUser} />}>
        <Route path="/worksheet" element={user ? <Worksheet /> : <Navigate to="/" replace />} />
        <Route path="/admin" element={user ? <Admin user={user} /> : <Navigate to="/" replace />} />
        <Route path="/essay-grader" element={user ? <EssayGrader user={user} /> : <Navigate to="/" replace />} />
        <Route path="/feedback" element={user ? <EssayFeedback user={user} /> : <Navigate to="/" replace />} />
      </Route>
      <Route path="*" element={<Navigate to={defaultHome} replace />} />
    </Routes>
  );
}

export default App;
