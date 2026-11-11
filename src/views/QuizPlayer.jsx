import React, { useEffect, useRef, useState } from 'react';
import { onSnapshot, setDoc, writeBatch, increment, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { stateRef, playerRef, playersCol, answerRef, newId, loadPlayer, savePlayer } from '../quiz/api';
import { OPTION_STYLES, calcPoints, getQuiz } from '../config/quiz';
import '../quiz/quiz.css';

function PlayerShell({ children, tone = 'default', player, me, bg }) {
  return (
    <div className={`qp-shell qp-${tone} ${bg ? 'qp-has-bg' : ''}`} dir="rtl"
      style={bg ? { backgroundImage: `url(${bg})` } : undefined}>
      <header className="qp-top">
        <img src="/logo.png" alt="" className="qp-logo" />
        {player && <div className="qp-me">{player.name}{me ? <b> · {me.score} נק׳</b> : null}</div>}
      </header>
      <main className="qp-main">{children}</main>
    </div>
  );
}

export default function QuizPlayer() {
  const [state, setState] = useState(undefined); // undefined = טוען, null = אין חידון פתוח
  const [player, setPlayer] = useState(null);     // {id, name}
  const [me, setMe] = useState(null);             // מסמך השחקן מהשרת (ניקוד)
  const [nameInput, setNameInput] = useState('');
  const [joining, setJoining] = useState(false);
  const [kicked, setKicked] = useState(false);
  const [error, setError] = useState('');
  const [existing, setExisting] = useState(null); // שחקנית קיימת עם אותו שם (חזרה מהפסקה)

  // תשובה לשאלה הנוכחית
  const [answer, setAnswer] = useState(null);     // {q, option, correct, points}
  const [remaining, setRemaining] = useState(null);
  const [openText, setOpenText] = useState('');
  const shownAt = useRef({ q: -1, t: 0 });

  // האזנה למצב החידון
  useEffect(() => {
    const unsub = onSnapshot(stateRef(), (snap) => {
      setState(snap.exists() ? snap.data() : null);
    }, (err) => {
      console.error(err);
      setError('אין חיבור לחידון כרגע. נסו לרענן את העמוד.');
      setState(null);
    });
    return () => unsub();
  }, []);

  const sid = state?.sessionId;
  const quiz = getQuiz(state?.quizId);
  const QUESTIONS = quiz.QUESTIONS;
  const T = quiz.teams; // משחק בצוותים – נוסח לרבים

  // טעינת שחקן שמור למשחק הנוכחי
  useEffect(() => {
    if (!sid) return;
    const saved = loadPlayer(sid);
    setPlayer(saved);
    setAnswer(null);
  }, [sid]);

  // האזנה למסמך השחקן שלי בלבד (ניקוד)
  useEffect(() => {
    if (!sid || !player) return;
    const unsub = onSnapshot(playerRef(sid, player.id), (snap) => {
      if (snap.exists()) {
        setMe(snap.data());
      } else if (me) {
        // המנחה הסיר את השחקן
        setKicked(true);
        setPlayer(null);
        setMe(null);
        try { localStorage.removeItem(`quizPlayer_${sid}`); } catch (e) { /* ignore */ }
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sid, player?.id]);

  // כשמגיעה שאלה חדשה – מאפסים ומתחילים למדוד זמן
  const phase = state?.phase;
  const qIndex = state?.qIndex ?? 0;
  const question = QUESTIONS[qIndex];

  useEffect(() => {
    if (phase === 'question' && shownAt.current.q !== qIndex) {
      shownAt.current = { q: qIndex, t: Date.now() };
      setAnswer((a) => (a && a.q === qIndex ? a : null));
    }
  }, [phase, qIndex]);

  // שעון לאחור בטלפון
  useEffect(() => {
    if (phase !== 'question' || !question) { setRemaining(null); return; }
    const tick = () => {
      const left = question.time - (Date.now() - shownAt.current.t) / 1000;
      setRemaining(Math.max(0, left));
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [phase, qIndex, question]);

  const join = async (e) => {
    e.preventDefault();
    const name = nameInput.trim().replace(/\s+/g, ' ').slice(0, quiz.maxName || 24);
    if (!name || !sid || joining) return;
    setJoining(true);
    setError('');
    try {
      // חזרה מהפסקה: אם כבר יש שחקנית בשם הזה – מציעים להמשיך עם הניקוד שלה
      const found = await getDocs(query(playersCol(sid), where('name', '==', name)));
      if (!found.empty) {
        setExisting(found.docs[0].data());
        return;
      }
      await createPlayer(name);
    } catch (err) {
      console.error(err);
      setError('ההצטרפות נכשלה. בדקו חיבור לאינטרנט ונסו שוב.');
    } finally {
      setJoining(false);
    }
  };

  const createPlayer = async (name) => {
    const id = newId();
    await setDoc(playerRef(sid, id), {
      id, name, score: 0, correctCount: 0, streak: 0, joinedAt: serverTimestamp()
    });
    enterAs({ id, name });
  };

  const enterAs = (p) => {
    savePlayer(sid, p);
    setPlayer(p);
    setExisting(null);
    setKicked(false);
    if (navigator.vibrate) navigator.vibrate(60);
  };

  const submitOpen = async (e) => {
    e.preventDefault();
    const text = openText.trim().slice(0, 140);
    if (!text || !player || !question || answer || phase !== 'question') return;
    const points = question.points || 500;
    setAnswer({ q: qIndex, option: -1, correct: true, points, ms: Date.now() - shownAt.current.t, text });
    if (navigator.vibrate) navigator.vibrate(40);
    try {
      const batch = writeBatch(db);
      batch.set(answerRef(sid, qIndex, player.id), {
        pid: player.id, name: player.name, q: qIndex, option: -1, text, correct: true, points, ms: 0, at: serverTimestamp()
      });
      batch.update(playerRef(sid, player.id), { score: increment(points) });
      await batch.commit();
      setOpenText('');
    } catch (err) {
      console.error(err);
    }
  };

  const choose = async (optionIndex) => {
    if (!player || !question || answer || phase !== 'question') return;
    const elapsed = Date.now() - shownAt.current.t;
    if (elapsed > question.time * 1000 + 500) return;
    const correct = optionIndex === question.correct;
    const points = calcPoints(correct, elapsed, question.time);
    const local = { q: qIndex, option: optionIndex, correct, points, ms: elapsed };
    setAnswer(local);
    if (navigator.vibrate) navigator.vibrate(40);
    try {
      const batch = writeBatch(db);
      batch.set(answerRef(sid, qIndex, player.id), {
        pid: player.id, q: qIndex, option: optionIndex, correct, points, ms: elapsed, at: serverTimestamp()
      });
      batch.update(playerRef(sid, player.id), {
        score: increment(points),
        correctCount: increment(correct ? 1 : 0),
        streak: correct ? increment(1) : 0
      });
      await batch.commit();
    } catch (err) {
      console.error(err);
    }
  };

  if (state === undefined) {
    return <PlayerShell player={player} me={me}><div className="qp-center"><div className="qp-spinner" /><p>מתחברים…</p></div></PlayerShell>;
  }

  if (!state || !sid || phase === 'closed') {
    return (
      <PlayerShell player={player} me={me}>
        <div className="qp-center">
          <div className="qp-emoji">⏳</div>
          <h1>{quiz.title}</h1>
          <p>{error || 'החידון עוד לא נפתח. המסך יתעדכן לבד.'}</p>
        </div>
      </PlayerShell>
    );
  }

  // חזרה למשחק עם שם קיים
  if (!player && existing) {
    return (
      <PlayerShell player={player} me={me}>
        <div className="qp-center qp-join">
          <div className="qp-emoji">👋</div>
          <h1>{T ? 'כבר יש צוות בשם הזה' : 'השם הזה כבר במשחק'}</h1>
          <p>{T ? 'הצוות' : 'יש משתתף/ת בשם'} <b>{existing.name}</b> {T ? 'כבר במשחק עם' : 'עם'} <b>{existing.score || 0}</b> נקודות.</p>
          <p className="qp-hint">{T ? 'זה הצוות שלכם/ן והטלפון התנתק? ממשיכים עם הניקוד. צוות חדש? בוחרים שם אחר.' : 'חזרת מהפסקה והניקוד הזה שלך? ממשיכים. נכנסת עכשיו לראשונה? בוחרים שם אחר.'}</p>
          <button className="qp-cta" onClick={() => enterAs({ id: existing.id, name: existing.name })}>{T ? 'זה הצוות שלנו – ממשיכים ▶' : 'זה אני – ממשיכים עם הניקוד ▶'}</button>
          <button className="qp-ghost" onClick={() => { setExisting(null); setNameInput(existing.name + ' '); }}>{T ? 'אנחנו צוות חדש – נבחר שם אחר' : 'אני חדש/ה – אכתוב שם אחר'}</button>
        </div>
      </PlayerShell>
    );
  }

  // מסך הצטרפות
  if (!player) {
    return (
      <PlayerShell player={player} me={me} bg="/quiz/join.jpg">
        <form className="qp-center qp-join qp-top-content" onSubmit={join}>
          <h1>{quiz.title}</h1>
          {kicked && <p className="qp-warn">השם הוסר ע״י המנחה. {T ? 'בחרו שם צוות אחר 🙂' : 'בחרו כינוי אחר 🙂'}</p>}
          <label htmlFor="nick">{quiz.joinLabel}</label>
          <input
            id="nick"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            maxLength={quiz.maxName || 24}
            placeholder={quiz.joinPlaceholder}
            autoComplete="off"
          />
          <button type="submit" className="qp-cta" disabled={!nameInput.trim() || joining}>
            {joining ? (T ? 'מצטרפים…' : 'מצטרפים…') : 'בואו נשחק! 🚀'}
          </button>
          {error && <p className="qp-warn">{error}</p>}
          <p className="qp-hint">{quiz.joinHint}</p>
        </form>
      </PlayerShell>
    );
  }

  // לובי
  if (phase === 'lobby') {
    return (
      <PlayerShell player={player} me={me} tone="lobby" bg="/quiz/join.jpg">
        <div className="qp-center qp-top-content">
          <div className="qp-emoji qp-bounce">🎉</div>
          <h1>{T ? 'הצוות בפנים!' : 'את/ה בפנים!'}</h1>
          <p className="qp-big">{player.name}</p>
          <p>תסתכלו על המסך הגדול – מתחילים עוד רגע.</p>
          <p className="qp-hint">{T ? 'הטלפון התנתק? חוזרים לאותה כתובת ומקלידים את אותו שם צוות – הניקוד נשמר.' : 'יצאת מהמשחק? חוזרים לאותה כתובת ומקלידים אותו שם – הניקוד נשמר.'}</p>
        </div>
      </PlayerShell>
    );
  }

  // שאלה
  // פתיחת סבב
  if (phase === 'intro' && question) {
    return (
      <PlayerShell player={player} me={me} tone="waiting">
        <div className="qp-center">
          <div className="qp-emoji qp-bounce">🎬</div>
          <h1>סבב {question.round + 1} מתחיל!</h1>
          <p className="qp-big">{question.roundTitle.split('·').pop().trim()}</p>
          <p>תתכוננו – עונים נכון ומהר ⚡</p>
        </div>
      </PlayerShell>
    );
  }

  // שאלה פתוחה – התשובות מופיעות על המסך הגדול
  if (phase === 'question' && question && question.type === 'open') {
    if (answer && answer.q === qIndex) {
      return (
        <PlayerShell player={player} me={me} tone="right">
          <div className="qp-center">
            <div className="qp-emoji qp-bounce">💬</div>
            <h1>{T ? 'התשובה שלכם/ן על המסך!' : 'התשובה שלך על המסך!'}</h1>
            <p className="qp-points">+{answer.points}</p>
            <p>תסתכלו על הקיר הגדול 👀</p>
          </div>
        </PlayerShell>
      );
    }
    return (
      <PlayerShell player={player} me={me} tone="question">
        <div className="qp-qhead">
          <span className="qp-pill">{question.roundTitle} · שאלה פתוחה</span>
          <span className={`qp-timer ${remaining !== null && remaining < 10 ? 'qp-hurry' : ''}`}>
            {remaining !== null ? Math.ceil(remaining) : ''}
          </span>
        </div>
        <h2 className="qp-q">{question.q}</h2>
        <form className="qp-open" onSubmit={submitOpen}>
          <textarea
            value={openText}
            onChange={(e) => setOpenText(e.target.value)}
            maxLength={140}
            rows={4}
            placeholder={question.placeholder || quiz.openPlaceholder}
          />
          <div className="qp-counter">{openText.length}/140</div>
          <button type="submit" className="qp-cta" disabled={!openText.trim()}>שליחה למסך 🚀</button>
          <p className="qp-hint">כל תשובה שווה {question.points || 500} נקודות. בלי פרטים מזהים 🙂</p>
        </form>
      </PlayerShell>
    );
  }

  if (phase === 'question' && question) {
    if (answer && answer.q === qIndex) {
      const fast = answer.ms < question.time * 1000 * 0.35;
      return (
        <PlayerShell player={player} me={me} tone="waiting">
          <div className="qp-center">
            <div className="qp-emoji qp-pulse">{fast ? '⚡' : '✅'}</div>
            <h1>{fast ? (T ? 'וואו, איזו מהירות!' : 'וואו, איזו מהירות!') : 'התשובה נקלטה'}</h1>
            <p>{T ? 'מחכים לכל הצוותים… עיניים למסך 👀' : 'מחכים לכולם… עיניים למסך 👀'}</p>
          </div>
        </PlayerShell>
      );
    }
    const timeUp = remaining !== null && remaining <= 0;
    return (
      <PlayerShell player={player} me={me} tone="question">
        <div className="qp-qhead">
          <span className="qp-pill">{question.roundTitle}</span>
          <span className={`qp-timer ${remaining !== null && remaining < 5 ? 'qp-hurry' : ''}`}>
            {remaining !== null ? Math.ceil(remaining) : ''}
          </span>
        </div>
        <div className="qp-bar"><div style={{ width: `${remaining !== null ? (remaining / question.time) * 100 : 100}%` }} /></div>
        <h2 className="qp-q">{question.q}</h2>
        {timeUp ? (
          <div className="qp-center"><div className="qp-emoji">⏰</div><h1>נגמר הזמן!</h1></div>
        ) : (
          <div className="qp-options">
            {question.options.map((opt, i) => (
              <button
                key={i}
                className="qp-opt"
                style={{ background: OPTION_STYLES[i].color }}
                onClick={() => choose(i)}
              >
                <span className="qp-shape">{OPTION_STYLES[i].shape}</span>
                <span className="qp-opt-text">{opt}</span>
              </button>
            ))}
          </div>
        )}
      </PlayerShell>
    );
  }

  // חשיפת תשובה
  if (phase === 'reveal' && question && question.type === 'open') {
    const mine = answer && answer.q === qIndex ? answer : null;
    return (
      <PlayerShell player={player} me={me} tone={mine ? 'right' : 'lobby'}>
        <div className="qp-center">
          <div className="qp-emoji qp-bounce">{mine ? '💜' : '💬'}</div>
          <h1>{mine ? 'תודה על התשובה!' : 'תסתכלו על הקיר'}</h1>
          {mine && <p className="qp-points">+{mine.points}</p>}
          <p>בחרו משימה אחת – ונסו אותה עוד השבוע.</p>
        </div>
      </PlayerShell>
    );
  }

  if (phase === 'reveal' && question) {
    const mine = answer && answer.q === qIndex ? answer : null;
    const rank = state.ranks?.[player.id];
    const streak = me?.streak || 0;
    if (!mine) {
      return (
        <PlayerShell player={player} me={me} tone="miss">
          <div className="qp-center">
            <div className="qp-emoji">⏰</div>
            <h1>{T ? 'לא הספקתם/ן הפעם' : 'לא הספקת הפעם'}</h1>
            <p>התשובה הנכונה: <b>{question.options[question.correct]}</b></p>
            {rank && <p className="qp-rank">מקום {rank} מתוך {state.total}</p>}
          </div>
        </PlayerShell>
      );
    }
    return (
      <PlayerShell player={player} me={me} tone={mine.correct ? 'right' : 'wrong'}>
        <div className="qp-center">
          <div className="qp-emoji qp-bounce">{mine.correct ? '🎉' : '💡'}</div>
          <h1>{mine.correct ? 'נכון!' : 'לא הפעם'}</h1>
          {mine.correct
            ? <p className="qp-points">+{mine.points}</p>
            : <p>התשובה הנכונה: <b>{question.options[question.correct]}</b></p>}
          {mine.correct && streak >= 2 && <p className="qp-streak">🔥 רצף של {streak} תשובות נכונות!</p>}
          {rank && <p className="qp-rank">מקום {rank} מתוך {state.total}</p>}
        </div>
      </PlayerShell>
    );
  }

  // טבלה בין סבבים
  if (phase === 'leaderboard') {
    const rank = state.ranks?.[player.id];
    return (
      <PlayerShell player={player} me={me} tone="lobby" bg="/quiz/break.jpg">
        <div className="qp-center qp-top-content">
          <div className="qp-emoji">📊</div>
          <h1>{rank ? `מקום ${rank}` : 'טבלת המובילות'}</h1>
          <p className="qp-big">{me?.score ?? 0} נקודות</p>
          {rank && rank <= 3 && <p className="qp-streak">{T ? 'הצוות על הפודיום כרגע! 🏆' : 'את/ה על הפודיום כרגע! 🏆'}</p>}
          <p>{T ? 'תשובות נכונות' : 'התשובות הנכונות שלך'}: {me?.correctCount ?? 0}</p>
          <p className="qp-hint">{T ? 'עיניים למסך – הסבב הבא מתחיל עוד רגע.' : 'הפסקה? אפשר לצאת – כשחוזרים לכתובת, ממשיכים מאותו מקום.'}</p>
        </div>
      </PlayerShell>
    );
  }

  // פודיום
  if (phase === 'podium') {
    const rank = state.ranks?.[player.id];
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🎊';
    return (
      <PlayerShell player={player} me={me} tone={rank && rank <= 3 ? 'right' : 'lobby'}>
        <div className="qp-center">
          <div className="qp-emoji qp-bounce">{medal}</div>
          <h1>{rank && rank <= 3 ? `מקום ${rank}!` : 'כל הכבוד!'}</h1>
          <p className="qp-big">{me?.score ?? 0} נקודות</p>
          {rank && <p>{T ? 'הצוות סיים במקום' : 'סיימת במקום'} {rank} מתוך {state.total}</p>}
          <p className="qp-hint">{T ? 'תודה על ההשתתפות 💜' : 'תודה שהשתתפת 💜'}</p>
        </div>
      </PlayerShell>
    );
  }

  return (
    <PlayerShell player={player} me={me}>
      <div className="qp-center"><div className="qp-emoji">⏳</div><p>מחכים למנחה…</p></div>
    </PlayerShell>
  );
}
