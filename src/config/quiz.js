// ===== רשימת החידונים =====
// כל חידון בקובץ משלו בתיקייה quizzes. המנחה בוחר במסך הפתיחה איזה חידון להפעיל.
// כדי להוסיף חידון: יוצרים קובץ חדש בתיקייה ומוסיפים אותו לרשימה QUIZZES.

import { ROUNDS as PLASTIC_ROUNDS } from './quizzes/plastic2026';
import { ROUNDS as EDU_ROUNDS } from './quizzes/edu';

export const QUIZZES = [
  {
    id: 'plastic-2026',
    name: 'כנס אחיות כירורגיה פלסטית וכוויות · 2026',
    title: 'חידון AI לאחיות ולאחים',
    subtitle: 'כנס אחיות כירורגיה פלסטית וכוויות · 2026',
    teams: true,
    unit: 'צוותים',
    joinLabel: 'שם הצוות או שמות חברי הצוות',
    joinPlaceholder: 'למשל: נועה ורחל / צוות כוויות',
    joinHint: 'טלפון אחד לכל צוות. השם יופיע על המסך בטבלת המובילות.',
    maxName: 30,
    openPlaceholder: 'למשל: דף הדרכה לטיפול בשתל עור בבית',
    rounds: PLASTIC_ROUNDS
  },
  {
    id: 'edu',
    name: 'אחיות לחינוך התיישבותי (החידון הקודם)',
    title: 'חידון AI לאחיות',
    subtitle: 'סדנת בינה מלאכותית · אחיות לחינוך התיישבותי',
    teams: false,
    unit: 'משתתפות',
    joinLabel: 'שם פרטי ושם משפחה',
    joinPlaceholder: 'למשל: נועה כהן',
    joinHint: 'בלי הרשמה. השם יופיע על המסך בטבלת המובילות.',
    maxName: 24,
    openPlaceholder: 'למשל: לנסח מכתב להורים בשלוש שפות',
    rounds: EDU_ROUNDS
  }
];

export const DEFAULT_QUIZ_ID = QUIZZES[0].id;

// מחזיר חידון לפי מזהה, עם רשימה שטוחה של כל השאלות
const cache = {};
export function getQuiz(id) {
  const base = QUIZZES.find((q) => q.id === id) || QUIZZES[0];
  if (!cache[base.id]) {
    const questions = base.rounds.flatMap((r, ri) =>
      r.questions.map((q, qi) => ({ ...q, round: ri, roundTitle: r.title, indexInRound: qi, lastInRound: qi === r.questions.length - 1 }))
    );
    cache[base.id] = { ...base, ROUNDS: base.rounds, QUESTIONS: questions };
  }
  return cache[base.id];
}

// ניקוד: תשובה נכונה = 500 עד 1000 נקודות לפי מהירות
export function calcPoints(correct, elapsedMs, timeSec) {
  if (!correct) return 0;
  const ratio = Math.min(1, Math.max(0, elapsedMs / (timeSec * 1000)));
  return Math.round(1000 - 500 * ratio);
}

export const OPTION_STYLES = [
  { color: '#E5484D', shape: '▲' },
  { color: '#3E63DD', shape: '◆' },
  { color: '#E5A000', shape: '●' },
  { color: '#30A46C', shape: '■' }
];
