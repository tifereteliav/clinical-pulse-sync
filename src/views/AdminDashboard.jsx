import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, setDoc, onSnapshot, collection, query } from 'firebase/firestore';

const STAGES = [
  { id: 0, title: "מסך המתנה" },
  { id: 1, title: "שלב 1: האם AI יחליף אותנו?" },
  { id: 2, title: "שלב 2: מחלקות" },
  { id: 3, title: "שלב 3: משימה ששורפת זמן" },
  { id: 4, title: "שלב 4: סכנות AI" },
  { id: 5, title: "שלב 5: OpenEvidence" },
  { id: 6, title: "שלב 6: תרגיל פרומפט" },
  { id: 7, title: "שלב 7: Q&A" }
];

export default function AdminDashboard() {
  const [currentStage, setCurrentStage] = useState(0);
  const [responses, setResponses] = useState([]);

  // Subscribe to current presentation stage
  useEffect(() => {
    const stageRef = doc(db, 'appState', 'presentation');
    const unsubscribe = onSnapshot(stageRef, (docSnap) => {
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

  return (
    <div className="card" dir="rtl">
      <h2 style={{ marginBottom: '1.5rem' }}>לוח בקרה - ניהול מצגת</h2>

      <div style={{ marginBottom: '1rem', fontWeight: 'bold', fontSize: '1.1rem' }}>
        שלב נוכחי פעיל: <span style={{ color: '#0284c7' }}>{STAGES.find(s => s.id === currentStage)?.title || `שלב ${currentStage}`}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem', marginBottom: '2.5rem' }}>
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
                transition: 'all 0.2s ease',
                boxShadow: isActive ? '0 4px 6px -1px rgba(2, 132, 199, 0.3)' : 'none'
              }}
            >
              {stage.title}
            </button>
          );
        })}
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '2rem 0' }} />

      <h3>פיד תשובות בלייב ({responses.length})</h3>

      <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
        {responses.length === 0 ? (
          <p style={{ color: '#64748b' }}>עדיין לא התקבלו תשובות.</p>
        ) : (
          responses.map((resp) => (
            <div
              key={resp.id}
              style={{
                padding: '1rem',
                borderRadius: '8px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                textAlign: 'right'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem', color: '#64748b' }}>
                <span>שלב {resp.stage ?? '-'}</span>
                <span>{resp.timestamp?.seconds ? new Date(resp.timestamp.seconds * 1000).toLocaleTimeString('he-IL') : 'עכשיו'}</span>
              </div>
              <div style={{ fontSize: '1rem', color: '#0f172a', fontWeight: '500' }}>
                {resp.text || resp.answer || JSON.stringify(resp)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
