import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, collection, query } from 'firebase/firestore';
import { STAGES } from '../config/stages';

export default function LivePresentationView() {
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

  const activeStageInfo = STAGES.find(s => s.id === currentStage) || STAGES[0];
  const stageResponses = responses.filter(r => r.stage === currentStage);
  const totalCount = stageResponses.length;

  // Compute stats for choices
  const computeStats = () => {
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

  const optionCounts = computeStats();

  return (
    <div className="card" dir="rtl" style={{ textAlign: 'right', minHeight: '75vh', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '2rem' }}>
          <div>
            <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {activeStageInfo.title}
            </span>
            <h1 style={{ fontSize: '2rem', color: '#0f172a', margin: '0.25rem 0 0 0' }}>
              {activeStageInfo.prompt}
            </h1>
          </div>
          <div style={{ backgroundColor: '#0284c7', color: 'white', padding: '0.75rem 1.5rem', borderRadius: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 'bold' }}>{totalCount}</div>
            <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>תשובות להתקבלו</div>
          </div>
        </div>

        {/* Stage 0: Waiting Screen */}
        {activeStageInfo.type === 'waiting' && (
          <div style={{ padding: '6rem 2rem', textAlign: 'center' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>🏥 Clinical Pulse Sync</div>
            <h2 style={{ fontSize: '2.5rem', color: '#1e293b' }}>מיד מתחילים...</h2>
            <p style={{ fontSize: '1.25rem', color: '#64748b', marginTop: '1rem' }}>
              אנא התחברו למסך המשתתפים בנייד
            </p>
          </div>
        )}

        {/* Option Charts for Choices */}
        {activeStageInfo.options && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1.5rem' }}>
            {activeStageInfo.options.map((option, idx) => {
              const count = optionCounts[option] || 0;
              const pct = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
              return (
                <div key={idx} style={{ backgroundColor: '#f8fafc', padding: '1.25rem 1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                    <span style={{ fontSize: '1.2rem', fontWeight: '600', color: '#0f172a' }}>{option}</span>
                    <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#0284c7' }}>{count} ({pct}%)</span>
                  </div>
                  <div style={{ height: '14px', backgroundColor: '#cbd5e1', borderRadius: '7px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', backgroundColor: '#0284c7', transition: 'width 0.5s ease-out' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Text Feed for Open Text */}
        {(activeStageInfo.type === 'short_text' || activeStageInfo.type === 'long_text') && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem', marginTop: '1.5rem' }}>
            {stageResponses.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '1.2rem' }}>ממתין לתשובות מהקהל...</p>
            ) : (
              stageResponses.map((resp) => (
                <div key={resp.id} style={{ padding: '1.25rem', borderRadius: '12px', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', fontSize: '1.1rem', color: '#0369a1', fontWeight: '500' }}>
                  "{resp.text}"
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem', paddingTop: '2rem', borderTop: '1px solid #f1f5f9' }}>
        Clinical Pulse Sync • תצוגת מצגת בלייב
      </div>
    </div>
  );
}
