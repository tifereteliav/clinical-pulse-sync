import { db } from '../firebase';
import { doc, collection } from 'firebase/firestore';

// מסמך המצב של החידון – המנחה כותב, כל הטלפונים מאזינים
export const stateRef = () => doc(db, 'quiz', 'state');

// כל משחק חדש מקבל מזהה סשן משלו, כך שאין צורך למחוק נתונים ישנים
export const playersCol = (sid) => collection(db, 'quizSessions', sid, 'players');
export const playerRef = (sid, pid) => doc(db, 'quizSessions', sid, 'players', pid);
export const answersCol = (sid) => collection(db, 'quizSessions', sid, 'answers');
export const answerRef = (sid, qIndex, pid) => doc(db, 'quizSessions', sid, 'answers', `${qIndex}_${pid}`);

export const newId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const PLAYER_KEY = (sid) => `quizPlayer_${sid}`;

export function loadPlayer(sid) {
  try {
    const raw = localStorage.getItem(PLAYER_KEY(sid));
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function savePlayer(sid, p) {
  try { localStorage.setItem(PLAYER_KEY(sid), JSON.stringify(p)); } catch (e) { /* ignore */ }
}

// מחשב דירוג מתוך רשימת שחקנים (ממוינת לפי ניקוד)
export function computeRanks(players) {
  const sorted = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));
  const ranks = {};
  sorted.forEach((p, i) => { ranks[p.id] = i + 1; });
  const top = sorted.slice(0, 10).map(p => ({ id: p.id, name: p.name, score: p.score || 0 }));
  return { ranks, top, total: sorted.length };
}
