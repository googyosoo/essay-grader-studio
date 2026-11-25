// LocalStorage-backed mock auth & data store (no hardcoded personal emails or real names)
import { SAMPLE_ESSAYS } from '../data/worksheetData';

const KEYS = {
  USER: 'eg_current_user',
  WORKSHEET: 'eg_worksheet_data',
  GRADING: 'eg_grading_results',
  RUBRIC: 'eg_grading_rubric',
  SEEDED: 'eg_samples_seeded_v1',
};

export const DEMO_ACCOUNTS = {
  teacher: {
    uid: 'demo_teacher',
    email: 'teacher@example.edu',
    displayName: 'Teacher',
    role: 'teacher',
  },
  sample01: {
    uid: 'demo_sample01',
    email: 'sample01@example.edu',
    displayName: 'Sample 01',
    role: 'student',
  },
  sample02: {
    uid: 'demo_sample02',
    email: 'sample02@example.edu',
    displayName: 'Sample 02',
    role: 'student',
  },
};

export function isTeacherUser(user) {
  if (!user) return false;
  return user.role === 'teacher' || user.email === DEMO_ACCOUNTS.teacher.email;
}

export function loginWithAccount({ email, displayName, role = 'student' }) {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) return null;
  const cleanName = (displayName || cleanEmail.split('@')[0] || 'User').trim();
  const user = {
    uid: 'user_' + Math.random().toString(36).slice(2, 10),
    email: cleanEmail,
    displayName: cleanName,
    role,
  };
  localStorage.setItem(KEYS.USER, JSON.stringify(user));
  return user;
}

export function signOutUser() {
  localStorage.removeItem(KEYS.USER);
  return Promise.resolve();
}

export function getCurrentUser() {
  try {
    const raw = localStorage.getItem(KEYS.USER);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function seedSampleEssaysIfEmpty(force = false) {
  const existing = readJson(KEYS.WORKSHEET, {});
  const alreadySeeded = localStorage.getItem(KEYS.SEEDED);
  if (!force && (alreadySeeded || Object.keys(existing).length > 0)) {
    return existing;
  }

  const next = { ...existing };
  const now = Date.now();
  SAMPLE_ESSAYS.forEach((sample, idx) => {
    if (!next[sample.email]) {
      next[sample.email] = {
        name: sample.name,
        lastUpdated: now - idx * 60000,
      };
    }
    if (!next[sample.email][sample.partKey]?.reflection || force) {
      next[sample.email][sample.partKey] = {
        inquiry_answer: sample.inquiryAnswer,
        reflection: sample.essay,
        updated_at: new Date(now - idx * 60000).toISOString(),
      };
      next[sample.email].lastUpdated = now - idx * 60000;
    }
  });

  localStorage.setItem(KEYS.WORKSHEET, JSON.stringify(next));
  localStorage.setItem(KEYS.SEEDED, '1');
  return next;
}

export async function saveWorksheetData(part, data) {
  const user = getCurrentUser();
  if (!user) return false;

  const allData = readJson(KEYS.WORKSHEET, {});
  if (!allData[user.email]) {
    allData[user.email] = { name: user.displayName, lastUpdated: Date.now() };
  }
  allData[user.email].name = user.displayName;
  allData[user.email][part] = data;
  allData[user.email].lastUpdated = Date.now();

  localStorage.setItem(KEYS.WORKSHEET, JSON.stringify(allData));
  return true;
}

export async function getWorksheetData(part) {
  const user = getCurrentUser();
  if (!user) return null;
  const allData = readJson(KEYS.WORKSHEET, {});
  return allData[user.email]?.[part] || null;
}

export async function getAllStudentsData() {
  seedSampleEssaysIfEmpty(false);
  const allData = readJson(KEYS.WORKSHEET, {});
  return Object.keys(allData)
    .filter((email) => email !== DEMO_ACCOUNTS.teacher.email)
    .map((email) => ({
      email,
      ...allData[email],
    }))
    .sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));
}

export async function upsertBatchSubmissions(entries, partKey = 'part1') {
  const allData = readJson(KEYS.WORKSHEET, {});
  const now = Date.now();
  const createdStudents = [];

  entries.forEach((entry, idx) => {
    const anonId = (entry.id || `Batch ${String(idx + 1).padStart(2, '0')}`).trim();
    const safeSlug = anonId.toLowerCase().replace(/[^a-z0-9]+/g, '_') || `batch_${idx + 1}`;
    const email = entry.email || `${safeSlug}@batch.local`;

    if (!allData[email]) {
      allData[email] = { name: anonId, lastUpdated: now - idx * 1000 };
    } else {
      allData[email].name = anonId;
      allData[email].lastUpdated = now - idx * 1000;
    }

    allData[email][partKey] = {
      ...(allData[email][partKey] || {}),
      reflection: entry.essay.trim(),
      updated_at: new Date(now - idx * 1000).toISOString(),
    };

    createdStudents.push({ email, ...allData[email] });
  });

  localStorage.setItem(KEYS.WORKSHEET, JSON.stringify(allData));
  return createdStudents;
}

// ─── Essay Grading Data & History ────────────────────────────────────

export async function saveGradingResult(studentEmail, partKey, result, options = {}) {
  const allResults = readJson(KEYS.GRADING, {});
  if (!allResults[studentEmail]) {
    allResults[studentEmail] = {};
  }

  const prevRecord = allResults[studentEmail][partKey];
  const prevHistory = Array.isArray(prevRecord?.gradingHistory) ? prevRecord.gradingHistory : [];

  const historyEntry = {
    attempt: prevHistory.length + 1,
    totalScore: result.totalScore,
    maxTotalScore: result.maxTotalScore || 100,
    scores: result.scores || {},
    mode: result._fallback ? 'fallback' : 'ai',
    model: result._model || 'rule-based',
    gradedAt: result.gradedAt || new Date().toISOString(),
  };

  let nextHistory = prevHistory;
  if (options.recordHistory !== false) {
    // Avoid duplicating the exact same grading timestamp if just finalizing/editing
    const last = prevHistory[prevHistory.length - 1];
    if (last && last.gradedAt === historyEntry.gradedAt && !options.forceNewAttempt) {
      nextHistory = [...prevHistory.slice(0, -1), historyEntry];
    } else {
      nextHistory = [...prevHistory, historyEntry];
    }
  }

  const saved = {
    ...result,
    gradingHistory: nextHistory,
    savedAt: new Date().toISOString(),
    gradedBy: getCurrentUser()?.displayName || 'Teacher',
  };

  allResults[studentEmail][partKey] = saved;
  localStorage.setItem(KEYS.GRADING, JSON.stringify(allResults));
  return saved;
}

export async function getGradingResult(studentEmail, partKey) {
  const allResults = readJson(KEYS.GRADING, {});
  return allResults[studentEmail]?.[partKey] || null;
}

export async function getAllGradingResults(studentEmail) {
  const allResults = readJson(KEYS.GRADING, {});
  return allResults[studentEmail] || {};
}

export async function getAllGradingResultsMap() {
  return readJson(KEYS.GRADING, {});
}

// ─── Rubric Data ──────────────────────────────────────────────────────

export async function saveRubric(rubric) {
  localStorage.setItem(KEYS.RUBRIC, JSON.stringify(rubric));
  return true;
}

export async function getRubric() {
  return readJson(KEYS.RUBRIC, null);
}
