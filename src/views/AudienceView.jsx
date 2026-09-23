import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, collection, addDoc, serverTimestamp } from 'firebase/firestore';

const STAGES = [
  { id: 0, title: "מסך המתנה", prompt: "המצגת תתחיל כעת. אנא המתן..." },
  { id: 1, title: "שלב 1: האם AI יחליף אותנו?", prompt: "האם לדעתך AI יחליף רופאים/צוות רפואי בעתיד?" },
  { id: 2, title: "שלב 2: מחלקות", prompt: "לאיזו מחלקה/תחום את/ה שייך/ת?" },
  { id: 3, title: "שלב 3: משימה ששורפת זמן", prompt: "איזו משימה יומיומית שורפת לך הכי הרבה זמן?" },
  { id: 4, title: "שלב 4: סכנות AI", prompt: "מהי הסכנה או החשש המרכזי שלך משימוש ב-AI ברפואה?" },
  { id: 5, title: "שלב 5: OpenEvidence", prompt: "האם כבר יצא לך להשתמש ב-OpenEvidence או בכלי AI רפואי אחר?" },
  { id: 6, title: "שלב 6: תרגיל פרומפט", prompt: "רשום/י פרומפט או שאלה שהיית רוצה לשאול כלי AI רפואי:" },
  { id: 7, title: "שלב 7: Q&A", prompt: "שאלות, הערות או מחשבות לסיום:" }
];

export default function AudienceView() {
  const [currentStage, setCurrentStage] = useState(0);
  const [inputText, setInputText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const stageRef = doc(db, 'appState', 'presentation');
    const unsubscribe = onSnapshot(stageRef, (docSnap) => {
      if (docSnap.exists()) {
        const newStage = docSnap.data().currentStage ?? 0;
        setCurrentStage(newStage);
        setSubmitted(false);
        setInputText('');
      }
    }, (err) => {
      console.error("Error listening to stage:", err);
    });

    return () => unsubscribe();
  }, []);

  const activeStageInfo = STAGES.find(s => s.id === currentStage) || STAGES[0];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'responses'), {
        stage: currentStage,
        text: inputText.trim(),
        timestamp: serverTimestamp()
      });
      setSubmitted(true);
      setInputText('');
    } catch (err) {
      console.error("Error submitting response:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="card" dir="rtl" style={{ textAlign: 'right' }}>
      <h2>{activeStageInfo.title}</h2>
      <p style={{ fontSize: '1.1rem', color: '#334155', marginBottom: '1.5rem' }}>
        {activeStageInfo.prompt}
      </p>

      {currentStage === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
          ⏳ המצגת תתחיל בקרוב, עמוד זה יתעדכן אוטומטית...
        </div>
      ) : submitted ? (
        <div style={{ padding: '1.5rem', backgroundColor: '#f0fdf4', color: '#166534', borderRadius: '8px', border: '1px solid #bbf7d0', textAlign: 'center' }}>
          ✓ התשובה שלך התקבלה בהצלחה! תודה.
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="הקלד/י את תשובתך כאן..."
            rows={4}
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '1rem',
              fontFamily: 'inherit',
              boxSizing: 'border-box'
            }}
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isSubmitting}
            style={{
              padding: '0.85rem 1.5rem',
              backgroundColor: isSubmitting || !inputText.trim() ? '#94a3b8' : '#0284c7',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: isSubmitting || !inputText.trim() ? 'not-allowed' : 'pointer'
            }}
          >
            {isSubmitting ? 'שולח...' : 'שלח תשובה'}
          </button>
        </form>
      )}
    </div>
  );
}
