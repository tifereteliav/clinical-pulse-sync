import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { onSnapshot, setDoc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';
import { stateRef, playersCol, playerRef, answersCol, answerRef, newId, computeRanks } from '../quiz/api';
import { OPTION_STYLES, QUIZZES, DEFAULT_QUIZ_ID, getQuiz } from '../config/quiz';
import { sfx, unlockAudio, setSoundEnabled } from '../quiz/sounds';
import '../quiz/quiz.css';

const joinUrl = () => window.location.origin;
const joinLabel = () => window.location.host;

function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 90 }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 2.5,
    dur: 3 + Math.random() * 3,
    color: ['#5B5FC7', '#7B7FE0', '#E5A000', '#30A46C', '#E5484D', '#3E63DD', '#ffffff'][i % 7],
    rot: Math.random() * 360
  })), []);
  return (
    <div className="qh-confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <span key={i} style={{
          left: `${p.left}%`, background: p.color, animationDelay: `${p.delay}s`,
          animationDuration: `${p.dur}s`, transform: `rotate(${p.rot}deg)`
        }} />
      ))}
    </div>
  );
}

const ROUND_IMAGES = ['/quiz/round1.jpg', '/quiz/round2.jpg', '/quiz/round3.jpg'];

function HostFrame({ children, footer, label, bg, bgClass = '', quiz }) {
  return (
    <div className={`qh-shell ${bg ? `qh-has-bg ${bgClass}` : ''}`} dir="rtl"
      style={bg ? { backgroundImage: `url(${bg})` } : undefined}>
      <header className="qh-top">
        <div className="qh-brand">
          <img src="/logo.png" alt="" />
          <div>
            <div className="qh-title">{quiz?.title}</div>
            <div className="qh-sub">{quiz?.subtitle}</div>
          </div>
        </div>
        <div className="qh-joinhint">הצטרפות: <b>{joinLabel()}</b></div>
        {label && <div className="qh-label">{label}</div>}
      </header>
      <main className="qh-main">{children}</main>
      <footer className="qh-footer">{footer}</footer>
    </div>
  );
}

export default function QuizHost() {
  const [state, setState] = useState(undefined);
  const [players, setPlayers] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [sound, setSound] = useState(true);
  const [busy, setBusy] = useState(false);
  const playersRef = useRef([]);
  const revealedFor = useRef(-1);
  const lastTick = useRef(-1);
  const prevCount = useRef(0);
  const allAnsweredAt = useRef({ q: -1, t: 0 });
  const [pickId, setPickId] = useState(DEFAULT_QUIZ_ID);

  const sid = state?.sessionId;
  const phase = state?.phase;
  const qIndex = state?.qIndex ?? 0;
  // בזמן משחק – החידון שנבחר בפתיחה. במסך הפתיחה – החידון המסומן כרגע.
  const quiz = getQuiz(sid ? state?.quizId : pickId);
  const { QUESTIONS, ROUNDS } = quiz;
  const question = QUESTIONS[qIndex];

  useEffect(() => onSnapshot(stateRef(), (s) => setState(s.exists() ? s.data() : null),
    (e) => { console.error(e); setState(null); }), []);

  useEffect(() => {
    if (!sid) { setPlayers([]); return; }
    return onSnapshot(playersCol(sid), (snap) => {
      const list = snap.docs.map((d) => d.data());
      playersRef.current = list;
      setPlayers(list);
    });
  }, [sid]);

  useEffect(() => {
    if (!sid) { setAnswers([]); return; }
    const q = query(answersCol(sid), where('q', '==', qIndex));
    return onSnapshot(q, (snap) => setAnswers(snap.docs.map((d) => d.data())));
  }, [sid, qIndex]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  // צליל הצטרפות בלובי
  useEffect(() => {
    if (phase === 'lobby' && players.length > prevCount.current) sfx.join();
    prevCount.current = players.length;
  }, [players.length, phase]);

  const remaining = phase === 'question' && question && state?.startedAt
    ? Math.max(0, question.time - (now - state.startedAt) / 1000)
    : null;

  const writeRanks = useCallback(async (extra = {}) => {
    const { ranks, top, total } = computeRanks(playersRef.current);
    await updateDoc(stateRef(), { ranks, top, total, ...extra });
  }, []);

  // ===== פעולות =====
  // משחק חדש באמצע משחק: סוגרים את הנוכחי וחוזרים למסך בחירת החידון
  const newGame = async () => {
    unlockAudio();
    if (sid && phase !== 'podium' && !window.confirm(`להתחיל משחק חדש? כל ה${quiz.unit} יצטרכו להצטרף מחדש.`)) return;
    revealedFor.current = -1;
    if (sid) setPickId(state.quizId || DEFAULT_QUIZ_ID);
    await setDoc(stateRef(), { sessionId: null, phase: 'closed', quizId: state?.quizId || pickId, qIndex: 0, startedAt: 0, ranks: {}, top: [], total: 0 });
  };

  // פתיחת לובי לחידון שנבחר
  const openQuiz = async () => {
    unlockAudio();
    revealedFor.current = -1;
    await setDoc(stateRef(), {
      sessionId: newId(), quizId: pickId, phase: 'lobby', qIndex: 0, startedAt: 0, ranks: {}, top: [], total: 0
    });
  };

  const startQuestion = async (i) => {
    unlockAudio();
    revealedFor.current = -1;
    lastTick.current = -1;
    sfx.start();
    await updateDoc(stateRef(), { phase: 'question', qIndex: i, startedAt: Date.now() });
  };

  const startRound = async (i) => {
    unlockAudio();
    sfx.join();
    await updateDoc(stateRef(), { phase: 'intro', qIndex: i, startedAt: 0 });
  };

  const reveal = useCallback(async () => {
    if (revealedFor.current === qIndex) return;
    revealedFor.current = qIndex;
    sfx.reveal();
    await updateDoc(stateRef(), { phase: 'reveal' });
    setTimeout(() => { writeRanks().catch(console.error); }, 1500);
  }, [qIndex, writeRanks]);

  const showLeaderboard = async () => {
    unlockAudio();
    await writeRanks({ phase: 'leaderboard' });
  };

  const showPodium = async () => {
    unlockAudio();
    sfx.fanfare();
    await writeRanks({ phase: 'podium' });
  };

  const kick = async (p) => {
    if (!window.confirm(`להסיר את "${p.name}"?`)) return;
    await deleteDoc(playerRef(sid, p.id));
  };

  // חשיפה אוטומטית: נגמר הזמן או שכולן ענו
  useEffect(() => {
    if (phase !== 'question' || remaining === null) return;
    const allAnswered = players.length > 0 && answers.length >= players.length;
    if (remaining <= 0) {
      if (revealedFor.current !== qIndex) sfx.timeUp();
      reveal();
      return;
    }
    if (allAnswered) {
      if (allAnsweredAt.current.q !== qIndex) allAnsweredAt.current = { q: qIndex, t: Date.now() };
      else if (Date.now() - allAnsweredAt.current.t > 700) { reveal(); return; }
    }
    const sec = Math.ceil(remaining);
    if (sec <= 5 && sec !== lastTick.current) { lastTick.current = sec; sfx.tick(); }
  }, [phase, remaining, players.length, answers.length, qIndex, reveal]);

  // הפעולה הראשית (כפתור גדול / מקש רווח / שלט מצגות)
  const isLastQuestion = qIndex >= QUESTIONS.length - 1;
  const primary = (() => {
    if (!state || !sid) return { label: 'פתיחת החידון ←', fn: openQuiz };
    if (phase === 'lobby') return { label: `מתחילים! (${players.length} ${quiz.unit})`, fn: () => startRound(0) };
    if (phase === 'intro') return { label: 'יאללה, לשאלה הראשונה! ←', fn: () => startQuestion(qIndex) };
    if (phase === 'question' && question?.type === 'open') {
      return { label: isLastQuestion ? 'סיימנו – לטבלת הסיום 🏁' : 'סיימנו – הלאה ←', fn: question.lastInRound ? showLeaderboard : () => startQuestion(qIndex + 1) };
    }
    if (phase === 'question') return { label: 'חשיפת התשובה', fn: reveal };
    if (phase === 'reveal') {
      if (question?.lastInRound) return { label: isLastQuestion ? 'טבלת סיום 🏁' : 'טבלת המובילות 📊', fn: showLeaderboard };
      return { label: 'לשאלה הבאה ←', fn: () => startQuestion(qIndex + 1) };
    }
    if (phase === 'leaderboard') {
      if (isLastQuestion) return { label: 'לפודיום 🏆', fn: showPodium };
      return { label: `ל${ROUNDS[QUESTIONS[qIndex + 1].round].title} ←`, fn: () => startRound(qIndex + 1) };
    }
    if (phase === 'podium') return { label: 'משחק חדש', fn: newGame };
    return { label: 'משחק חדש', fn: newGame };
  })();

  const runPrimary = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try { await primary.fn(); } catch (e) { console.error(e); alert('הפעולה נכשלה – בדקו חיבור לאינטרנט.'); }
    finally { setBusy(false); }
  }, [busy, primary]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if ([' ', 'Enter', 'PageDown', 'ArrowLeft'].includes(e.key)) { e.preventDefault(); runPrimary(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [runPrimary]);

  // ===== מוזיקה =====
  const tracks = useRef(null);
  const musicFor = (p, q) => {
    if (p === 'podium') return 'podium';
    if (p === 'question') return 'question';
    if (p === 'lobby' || p === 'intro' || p === 'leaderboard') return 'lobby';
    return null;
  };
  useEffect(() => {
    if (!tracks.current) {
      const mk = (src, vol) => { const a = new Audio(src); a.loop = true; a.volume = vol; a.preload = 'auto'; return a; };
      tracks.current = { lobby: mk('/quiz/lobby.mp3', 0.35), question: mk('/quiz/question.mp3', 0.3), podium: mk('/quiz/podium.mp3', 0.5) };
    }
    const want = sound ? musicFor(phase, question) : null;
    Object.entries(tracks.current).forEach(([k, a]) => {
      if (k === want) {
        if (a.paused) { if (k !== 'lobby') a.currentTime = 0; a.play().catch(() => {}); }
      } else if (!a.paused) a.pause();
    });
  }, [phase, qIndex, sound]);
  useEffect(() => () => { if (tracks.current) Object.values(tracks.current).forEach((a) => a.pause()); }, []);

  const toggleSound = () => { const v = !sound; setSound(v); setSoundEnabled(v); unlockAudio(); };
  const fullscreen = () => {
    unlockAudio();
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  const footer = (
    <>
      <button className="qh-primary" onClick={runPrimary} disabled={busy}>{primary.label}</button>
      <div className="qh-tools">
        <button onClick={toggleSound} title="צליל">{sound ? '🔊' : '🔇'}</button>
        <button onClick={fullscreen} title="מסך מלא">⛶</button>
        {sid && <button onClick={newGame} title="חזרה לבחירת חידון">↺ {phase === 'lobby' ? 'החלפת חידון' : 'משחק חדש'}</button>}
      </div>
    </>
  );

  // ===== מסכים =====
  if (state === undefined) {
    return <HostFrame quiz={quiz} footer={null}><div className="qh-center"><div className="qp-spinner" /></div></HostFrame>;
  }

  if (!state || !sid) {
    return (
      <HostFrame quiz={quiz} footer={footer}>
        <div className="qh-center">
          <div className="qh-hero">🎯</div>
          <h1 className="qh-h1">איזה חידון מפעילים?</h1>
          <div className="qh-pick">
            {QUIZZES.map((qz) => {
              const n = qz.rounds.reduce((s, r) => s + r.questions.length, 0);
              return (
                <button key={qz.id} className={`qh-pick-card ${pickId === qz.id ? 'qh-pick-on' : ''}`} onClick={() => setPickId(qz.id)}>
                  <b>{qz.title}</b>
                  <span>{qz.name}</span>
                  <small>{qz.rounds.length} סבבים · {n} שאלות · {qz.teams ? 'משחק בצוותים' : 'משחק אישי'}</small>
                </button>
              );
            })}
          </div>
          <p className="qh-lead">בחרי חידון ולחצי על "פתיחת החידון" כדי לפתוח את הלובי.</p>
        </div>
      </HostFrame>
    );
  }

  const rankedLive = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));

  if (phase === 'lobby') {
    return (
      <HostFrame quiz={quiz} footer={footer} label={`${players.length} ${quiz.unit}`} bg="/quiz/lobby.jpg" bgClass="qh-bg-left">
        <div className="qh-lobby2">
          <div className="qh-lobby-panel">
            <div className="qh-join qh-join-sm">
              <div className="qh-join-step">סרקו את הקוד</div>
              <div className="qh-qr"><QRCodeSVG value={joinUrl()} size={210} bgColor="#ffffff" fgColor="#1F2654" level="M" /></div>
              <div className="qh-url">{joinLabel()}</div>
            </div>
            <div className="qh-names">
              <h2>{players.length === 0 ? (quiz.teams ? 'מחכים לצוותים הראשונים…' : 'מחכים למשתתפים הראשונים…') : `הצטרפו כבר ${players.length} ${quiz.unit}! 🎉`}</h2>
              <div className={`qh-chips ${players.length > 30 ? 'qh-chips-dense' : ''}`}>
                {players.map((p) => (
                  <button key={p.id} className="qh-chip" onClick={() => kick(p)} title="לחיצה להסרה">{p.name}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </HostFrame>
    );
  }

  if (phase === 'intro' && question) {
    const r = question.round;
    const count = ROUNDS[r].questions.length;
    return (
      <HostFrame quiz={quiz} footer={footer} label={`סבב ${r + 1} מתוך ${ROUNDS.length}`} bg={ROUND_IMAGES[r]} bgClass="qh-bg-left">
        <div className="qh-intro">
          <div className="qh-intro-num">סבב {r + 1}</div>
          <h1 className="qh-intro-title">{ROUNDS[r].title.split('·').pop().trim()}</h1>
          <div className="qh-intro-meta">{count} שאלות · {quiz.teams ? 'הצוות שעונה נכון ומהר – מנצח' : 'מי שעונה נכון ומהר – מנצח/ת'} ⚡</div>
          {r > 0 && (
            <div className="qh-intro-rejoin">
              <QRCodeSVG value={joinUrl()} size={190} bgColor="#ffffff" fgColor="#1F2654" level="M" />
              <div>
                <b>{quiz.teams ? 'עוד לא הצטרפתם/ן?' : 'חזרתם/ן מההפסקה?'}</b>
                <span>{quiz.teams ? 'סורקים ומצטרפים עכשיו – אפשר גם באמצע' : 'סורקים שוב ומקלידים את אותו שם – הניקוד נשמר'}</span>
                {quiz.teams && <span>הטלפון התנתק? אותו שם צוות – הניקוד נשמר</span>}
                <span className="qh-intro-url">{joinLabel()}</span>
              </div>
            </div>
          )}
        </div>
      </HostFrame>
    );
  }

  if ((phase === 'question' || phase === 'reveal') && question && question.type === 'open') {
    const ring = remaining !== null ? remaining / question.time : 0;
    const ms = (t) => (t && typeof t.toMillis === 'function' ? t.toMillis() : (typeof t === 'number' ? t : Date.now()));
    const wall = [...answers].filter((a) => a.text).sort((a, b) => ms(a.at) - ms(b.at));
    const hide = async (a) => {
      if (!window.confirm('להסתיר את התשובה הזו מהמסך?')) return;
      await updateDoc(answerRef(sid, qIndex, a.pid), { text: '' });
    };
    return (
      <HostFrame quiz={quiz} footer={footer} label={`${question.roundTitle} · שאלה פתוחה`}>
        <div className="qh-qwrap">
          <div className="qh-qrow">
            <h1 className="qh-question">{question.q}</h1>
            {phase === 'question' ? (
              <div className={`qh-clock ${remaining !== null && remaining <= 10 ? 'qh-hurry' : ''}`}>
                <svg viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="52" className="qh-clock-bg" />
                  <circle cx="60" cy="60" r="52" className="qh-clock-fg"
                    style={{ strokeDasharray: 327, strokeDashoffset: 327 * (1 - ring) }} />
                </svg>
                <span>{remaining !== null ? Math.ceil(remaining) : ''}</span>
              </div>
            ) : (
              <div className="qh-stat"><b>{wall.length}</b><span>רעיונות</span></div>
            )}
          </div>
          <div className={`qh-wall ${wall.length > 45 ? 'qh-wall-xdense' : wall.length > 18 ? 'qh-wall-dense' : ''}`}>
            {wall.length === 0 && <div className="qh-wall-empty">מחכים לרעיון הראשון… ✍️</div>}
            {wall.map((a, i) => (
              <button key={a.pid} className={`qh-note qh-note-${i % 4}`} onClick={() => hide(a)} title="לחיצה להסתרה">
                <span className="qh-note-text">{a.text}</span>
                <span className="qh-note-name">— {a.name}</span>
              </button>
            ))}
          </div>
          {phase === 'question'
            ? <div className="qh-answered"><b>{wall.length}</b> / {players.length} שלחו</div>
            : <div className="qh-explain"><span className="qh-bulb">💡</span><span>{question.explain}</span></div>}
        </div>
      </HostFrame>
    );
  }

  if ((phase === 'question' || phase === 'reveal') && question) {
    const counts = question.options.map((_, i) => answers.filter((a) => a.option === i).length);
    const maxCount = Math.max(1, ...counts);
    const isReveal = phase === 'reveal';
    const fastest = isReveal
      ? answers.filter((a) => a.correct).sort((a, b) => a.ms - b.ms)[0]
      : null;
    const fastestName = fastest ? players.find((p) => p.id === fastest.pid)?.name : null;
    const correctPct = answers.length ? Math.round((counts[question.correct] / answers.length) * 100) : 0;
    const ring = remaining !== null ? remaining / question.time : 0;

    return (
      <HostFrame quiz={quiz} footer={footer} label={`${question.roundTitle} · שאלה ${qIndex + 1}/${QUESTIONS.length}`}>
        <div className="qh-qwrap">
          <div className="qh-qrow">
            <h1 className="qh-question">{question.q}</h1>
            {!isReveal ? (
              <div className={`qh-clock ${remaining !== null && remaining <= 5 ? 'qh-hurry' : ''}`}>
                <svg viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="52" className="qh-clock-bg" />
                  <circle cx="60" cy="60" r="52" className="qh-clock-fg"
                    style={{ strokeDasharray: 327, strokeDashoffset: 327 * (1 - ring) }} />
                </svg>
                <span>{remaining !== null ? Math.ceil(remaining) : ''}</span>
              </div>
            ) : (
              <div className="qh-stat"><b>{correctPct}%</b><span>ענו נכון</span></div>
            )}
          </div>

          <div className="qh-tiles">
            {question.options.map((opt, i) => {
              const right = i === question.correct;
              return (
                <div key={i}
                  className={`qh-tile ${isReveal ? (right ? 'qh-right' : 'qh-dim') : ''}`}
                  style={{ background: OPTION_STYLES[i].color }}>
                  <span className="qh-shape">{OPTION_STYLES[i].shape}</span>
                  <span className="qh-opt">{opt}</span>
                  {isReveal && (
                    <span className="qh-count">
                      <span className="qh-countbar" style={{ width: `${(counts[i] / maxCount) * 100}%` }} />
                      <b>{counts[i]}</b>{right && ' ✔'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {!isReveal ? (
            <div className="qh-answered"><b>{answers.length}</b> / {players.length} ענו</div>
          ) : (
            <div className="qh-explain">
              <span className="qh-bulb">💡</span>
              <span>{question.explain}</span>
              {fastestName && <span className="qh-fast">⚡ {quiz.teams ? 'הצוות הכי מהיר' : 'הכי מהיר/ה'}: {fastestName}</span>}
            </div>
          )}
        </div>
      </HostFrame>
    );
  }

  if (phase === 'leaderboard') {
    const top = rankedLive.slice(0, 10);
    const best = Math.max(1, top[0]?.score || 1);
    return (
      <HostFrame quiz={quiz} footer={footer} label={`${ROUNDS[question.round].title} · סיכום`}>
        <div className="qh-board">
          <h1 className="qh-h1">טבלת המובילות 📊</h1>
          <div className="qh-board-row"><ol>
            {top.map((p, i) => (
              <li key={p.id} style={{ animationDelay: `${(top.length - i) * 0.12}s` }}>
                <span className="qh-pos">{i + 1}</span>
                <span className="qh-pname">{p.name}{p.streak >= 3 ? ' 🔥' : ''}</span>
                <span className="qh-pbar"><span style={{ width: `${((p.score || 0) / best) * 100}%` }} /></span>
                <span className="qh-pscore">{p.score || 0}</span>
              </li>
            ))}
          </ol>
          <aside className="qh-rejoin">
            <QRCodeSVG value={joinUrl()} size={quiz.teams ? 190 : 150} bgColor="#ffffff" fgColor="#1F2654" level="M" />
            {quiz.teams
              ? <div><b>עוד לא הצטרפתם/ן?</b><br />סורקים ומצטרפים לסבב הבא<br /><b>{joinLabel()}</b></div>
              : <div>חוזרות מההפסקה?<br />סורקות שוב – הניקוד נשמר</div>}
          </aside></div>
        </div>
      </HostFrame>
    );
  }

  if (phase === 'podium') {
    const [first, second, third] = rankedLive;
    return (
      <HostFrame quiz={quiz} footer={footer} label={quiz.teams ? '🏆 המנצחים' : '🏆 המנצחים'} bg="/quiz/podium.jpg">
        <Confetti />
        <div className="qh-podium-wrap">
          <div className="qh-podium">
            {second && <div className="qh-step qh-p2"><div className="qh-medal">🥈</div><div className="qh-wname">{second.name}</div><div className="qh-wscore">{second.score}</div><div className="qh-block">2</div></div>}
            {first && <div className="qh-step qh-p1"><div className="qh-medal">🥇</div><div className="qh-wname">{first.name}</div><div className="qh-wscore">{first.score}</div><div className="qh-block">1</div></div>}
            {third && <div className="qh-step qh-p3"><div className="qh-medal">🥉</div><div className="qh-wname">{third.name}</div><div className="qh-wscore">{third.score}</div><div className="qh-block">3</div></div>}
          </div>
        </div>
      </HostFrame>
    );
  }

  return <HostFrame quiz={quiz} footer={footer}><div className="qh-center"><p className="qh-lead">מצב לא מוכר. לחצי על משחק חדש.</p></div></HostFrame>;
}
