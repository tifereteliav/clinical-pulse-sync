import React, { useEffect, useRef, useState } from 'react';
import { onSnapshot, setDoc, writeBatch, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { stateRef, playerRef, answerRef, newId, loadPlayer, savePlayer } from '../quiz/api';
import { QUESTIONS, OPTION_STYLES, calcPoints, QUIZ_TITLE } from '../config/quiz';
import '../quiz/quiz.css';

function PlayerShell({ children, tone = 'default', player, me }) {
  return (
    <div className={`qp-shell qp-${tone}`} dir="rtl">
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

  // תשובה לשאלה הנוכחית
  const [answer, setAnswer] = useState(null);     // {q, option, correct, points}
  const [remaining, setRemaining] = useState(null);
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
    const name = nameInput.trim().slice(0, 18);
    if (!name || !sid || joining) return;
    setJoining(true);
    setError('');
    try {
      const id = newId();
      await setDoc(playerRef(sid, id), {
        id, name, score: 0, correctCount: 0, streak: 0, joinedAt: serverTimestamp()
      });
      const p = { id, name };
      savePlayer(sid, p);
      setPlayer(p);
      setKicked(false);
      if (navigator.vibrate) navigator.vibrate(60);
    } catch (err) {
      console.error(err);
      setError('ההצטרפות נכשלה. בדקו חיבור לאינטרנט ונסו שוב.');
    } finally {
      setJoining(false);
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
          <h1>{QUIZ_TITLE}</h1>
          <p>{error || 'החידון עוד לא נפתח. המסך יתעדכן לבד.'}</p>
        </div>
      </PlayerShell>
    );
  }

  // מסך הצטרפות
  if (!player) {
    return (
      <PlayerShell player={player} me={me}>
        <form className="qp-center qp-join" onSubmit={join}>
          <div className="qp-emoji">🎯</div>
          <h1>{QUIZ_TITLE}</h1>
          {kicked && <p className="qp-warn">השם הוסר ע״י המנחה. בחרו כינוי אחר 🙂</p>}
          <label htmlFor="nick">איך נקרא לך?</label>
          <input
            id="nick"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            maxLength={18}
            placeholder="כינוי או שם פרטי"
            autoComplete="off"
          />
          <button type="submit" className="qp-cta" disabled={!nameInput.trim() || joining}>
            {joining ? 'מצטרפת…' : 'בואו נשחק! 🚀'}
          </button>
          {error && <p className="qp-warn">{error}</p>}
          <p className="qp-hint">בלי הרשמה ובלי פרטים אישיים – רק כינוי.</p>
        </form>
      </PlayerShell>
    );
  }

  // לובי
  if (phase === 'lobby') {
    return (
      <PlayerShell player={player} me={me} tone="lobby">
        <div className="qp-center">
          <div className="qp-emoji qp-bounce">🎉</div>
          <h1>את/ה בפנים!</h1>
          <p className="qp-big">{player.name}</p>
          <p>תסתכלו על המסך הגדול – מתחילים עוד רגע.</p>
        </div>
      </PlayerShell>
    );
  }

  // שאלה
  if (phase === 'question' && question) {
    if (answer && answer.q === qIndex) {
      const fast = answer.ms < question.time * 1000 * 0.35;
      return (
        <PlayerShell player={player} me={me} tone="waiting">
          <div className="qp-center">
            <div className="qp-emoji qp-pulse">{fast ? '⚡' : '✅'}</div>
            <h1>{fast ? 'וואו, מהירה!' : 'התשובה נקלטה'}</h1>
            <p>מחכים לכולן… עיניים למסך 👀</p>
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
  if (phase === 'reveal' && question) {
    const mine = answer && answer.q === qIndex ? answer : null;
    const rank = state.ranks?.[player.id];
    const streak = me?.streak || 0;
    if (!mine) {
      return (
        <PlayerShell player={player} me={me} tone="miss">
          <div className="qp-center">
            <div className="qp-emoji">⏰</div>
            <h1>לא הספקת הפעם</h1>
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
      <PlayerShell player={player} me={me} tone="lobby">
        <div className="qp-center">
          <div className="qp-emoji">📊</div>
          <h1>{rank ? `מקום ${rank}` : 'טבלת המובילות'}</h1>
          <p className="qp-big">{me?.score ?? 0} נקודות</p>
          {rank && rank <= 3 && <p className="qp-streak">את/ה על הפודיום כרגע! 🏆</p>}
          <p>התשובות הנכונות שלך: {me?.correctCount ?? 0}</p>
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
          {rank && <p>סיימת במקום {rank} מתוך {state.total}</p>}
          <p className="qp-hint">תודה שהשתתפת 💜</p>
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
