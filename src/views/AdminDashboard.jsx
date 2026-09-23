import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, setDoc, onSnapshot, collection, query } from 'firebase/firestore';
import { STAGES } from '../config/stages';

export default function AdminDashboard() {
  const [currentStage, setCurrentStage] = useState(0);
  const [responses, setResponses] = useState([]);

  // Subscribe to current presentation stage
  useEffect(() => {
    const stageRef = doc(doc(db, 'appState', 'presentation'));
    const unsubscribe = onSnapshot(doc(db, 'appState', 'presentation'), (docSnap) => {
      if (docSnap.exists()) {
        setCurrentStage(docSnap.data().currentStage ?? 0);
      }
    }, (error) => {
      console.error("Error subscribing to stage:", error);
    });

    return () => unsubscribe();
  }, []);

  // Subscribe to live responses feed
  useEffect(() => {
    const responsesRef = collection(db, 'responses');
    const q = query(responsesRef);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      docs.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setResponses(docs);
    }, (error) => {
      console.error("Error subscribing to responses:", error);
    });

    return () => unsubscribe();
  }, []);

  const handleSetStage = async (stageId) => {
    try {
      await setDoc(doc(db, 'appState', 'presentation'), { currentStage: stageId }, { merge: true });
      setCurrentStage(stageId);
    } catch (err) {
      console.error("Failed to update stage:", err);
    }
  };

  const activeStageInfo = STAGES.find(s => s.id === currentStage) || STAGES[0];
  const stageResponses = responses.filter(r => r.stage === currentStage);

  // Compute option counts for single_choice, yes_no, and multi_choice
  const computeOptionCounts = () => {
    if (!activeStageInfo.options) return {};
    const counts = {};
    activeStageInfo.options.forEach(opt => counts[opt] = 0);

    stageResponses.forEach(r => {
      if (Array.isArray(r.answer)) {
        r.answer.forEach(opt => {
          if (counts[opt] !== undefined) counts[opt]++;
        });
      } else if (typeof r.answer === 'string') {
        if (counts[r.answer] !== undefined) counts[r.answer]++;
      }
    });

    return counts;
  };

  const optionCounts = computeOptionCounts();
  const totalSubmissions = stageResponses.length;

  return (
    <div className="card" dir="rtl">
      <h2 style={{ marginBottom: '1.5rem', color: '#0f172a' }}>לוח בקרה - ניהול מצגת</h2>

      <div style={{ marginBottom: '1.25rem', fontWeight: 'bold', fontSize: '1.1rem' }}>
        שלב נוכחי פעיל: <span style={{ color: '#0284c7' }}>{activeStageInfo.title}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.85rem', marginBottom: '2.5rem' }}>
        {STAGES.map((stage) => {
          const isActive = currentStage === stage.id;
          return (
            <button
              key={stage.id}
              onClick={() => handleSetStage(stage.id)}
              style={{
                padding: '0.85rem 1rem',
                fontSize: '0.95rem',
                fontWeight: '600',
                borderRadius: '8px',
                border: isActive ? '2px solid #0284c7' : '1px solid #cbd5e1',
                backgroundColor: isActive ? '#0284c7' : '#ffffff',
                color: isActive ? '#ffffff' : '#1e293b',
                cursor: 'pointer',
                textAlign: 'right',
                transition: 'all 0.15s ease',
                boxShadow: isActive ? '0 4px 6px -1px rgba(2, 132, 199, 0.3)' : 'none'
              }}
            >
              {stage.title}
            </button>
          );
        })}
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '2rem 0' }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h3 style={{ margin: 0 }}>תוצאות לייב עבור {activeStageInfo.title}</h3>
        <span style={{ fontSize: '0.95rem', fontWeight: '600', backgroundColor: '#f1f5f9', padding: '0.35rem 0.85rem', borderRadius: '12px', color: '#475569' }}>
          סה"כ תשובות: {totalSubmissions}
        </span>
      </div>

      {/* Aggregate Choice Results */}
      {activeStageInfo.options && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '2rem' }}>
          {activeStageInfo.options.map((opt, idx) => {
            const count = optionCounts[opt] || 0;
            const pct = totalSubmissions > 0 ? Math.round((count / totalSubmissions) * 100) : 0;
            return (
              <div key={idx} style={{ padding: '0.85rem 1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontWeight: '600', fontSize: '0.95rem' }}>
                  <span>{opt}</span>
                  <span style={{ color: '#0284c7' }}>{count} ({pct}%)</span>
                </div>
                <div style={{ height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', backgroundColor: '#0284c7', transition: 'width 0.4s ease' }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Text Responses Feed */}
      <h4 style={{ margin: '1.5rem 0 0.75rem 0', color: '#334155' }}>פיד תשובות מלא ({stageResponses.length})</h4>
      <div style={{ maxHeight: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {stageResponses.length === 0 ? (
          <p style={{ color: '#64748b' }}>עדיין לא התקבלו תשובות לשלב זה.</p>
        ) : (
          stageResponses.map((resp) => (
            <div
              key={resp.id}
              style={{
                padding: '0.85rem 1rem',
                borderRadius: '8px',
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                textAlign: 'right'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.8rem', color: '#64748b' }}>
                <span>משיב/ה</span>
                <span>{resp.timestamp?.seconds ? new Date(resp.timestamp.seconds * 1000).toLocaleTimeString('he-IL') : 'עכשיו'}</span>
              </div>
              <div style={{ fontSize: '0.95rem', color: '#0f172a', fontWeight: '500' }}>
                {resp.text || JSON.stringify(resp.answer)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
