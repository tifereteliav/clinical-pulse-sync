import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { STAGES } from '../config/stages';

export default function AudienceView() {
  const [currentStage, setCurrentStage] = useState(0);
  const [singleSelection, setSingleSelection] = useState(null);
  const [multiSelection, setMultiSelection] = useState([]);
  const [textInput, setTextInput] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Listen to active stage from Firestore
  useEffect(() => {
    let unsubscribe = () => {};
    try {
      const stageRef = doc(db, 'appState', 'presentation');
      unsubscribe = onSnapshot(stageRef, (docSnap) => {
        if (docSnap.exists()) {
          const newStage = docSnap.data().currentStage ?? 0;
          setCurrentStage(newStage);
          setSubmitted(false);
          setSingleSelection(null);
          setMultiSelection([]);
          setTextInput('');
        }
      }, (err) => {
        console.error("Error listening to stage:", err);
      });
    } catch (e) {
      console.error("Exception setting up stage listener:", e);
    }

    return () => unsubscribe();
  }, []);

  const activeStage = STAGES.find(s => s.id === currentStage) || STAGES[0];

  const handleToggleMulti = (option) => {
    if (submitted || isSubmitting) return;
    setMultiSelection(prev => 
      prev.includes(option) ? prev.filter(item => item !== option) : [...prev, option]
    );
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (submitted || isSubmitting) return;

    let responseData = null;

    if (activeStage.type === 'single_choice' || activeStage.type === 'yes_no') {
      if (!singleSelection) return;
      responseData = singleSelection;
    } else if (activeStage.type === 'multi_choice') {
      if (multiSelection.length === 0) return;
      responseData = multiSelection;
    } else if (activeStage.type === 'short_text' || activeStage.type === 'long_text') {
      if (!textInput.trim()) return;
      responseData = textInput.trim();
    }

    if (!responseData) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'responses'), {
        stage: currentStage,
        stageTitle: activeStage.title,
        answer: responseData,
        text: Array.isArray(responseData) ? responseData.join(', ') : String(responseData),
        timestamp: serverTimestamp()
      });
      setSubmitted(true);
    } catch (err) {
      console.error("Error submitting response:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="card" dir="rtl" style={{ textAlign: 'right', maxWidth: '640px', margin: '2rem auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#0284c7', backgroundColor: '#e0f2fe', padding: '0.25rem 0.75rem', borderRadius: '12px' }}>
          {activeStage.title}
        </span>
      </div>

      <h2 style={{ fontSize: '1.35rem', color: '#0f172a', marginBottom: '1.5rem', lineHeight: '1.5', whiteSpace: 'pre-line' }}>
        {activeStage.prompt}
      </h2>

      {/* Stage 0: Waiting Screen */}
      {activeStage.type === 'waiting' && (
        <div style={{ padding: '3rem 1.5rem', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
          <h3 style={{ color: '#334155', margin: 0, fontSize: '1.25rem' }}>{activeStage.prompt}</h3>
          <p style={{ color: '#64748b', fontSize: '0.95rem', marginTop: '0.5rem' }}>
            המסך יתעדכן אוטומטית ברגע שהמרצה יעבור לשלב הבא.
          </p>
        </div>
      )}

      {/* Submission Success Banner */}
      {submitted && (
        <div style={{ padding: '2rem 1.5rem', backgroundColor: '#f0fdf4', color: '#166534', borderRadius: '12px', border: '1px solid #bbf7d0', textAlign: 'center', margin: '1rem 0' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>✓</div>
          <h3 style={{ margin: 0, fontSize: '1.25rem' }}>תשובתך התקבלה בהצלחה!</h3>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.95rem', color: '#15803d' }}>
            תודה על השתתפותך. המתן לשלב הבא.
          </p>
        </div>
      )}

      {/* Interactive Forms when not submitted & not waiting */}
      {!submitted && activeStage.type !== 'waiting' && (
        <div>
          {/* Single Choice Options */}
          {activeStage.type === 'single_choice' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {activeStage.options.map((option, idx) => {
                const isSelected = singleSelection === option;
                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setSingleSelection(option)}
                    style={{
                      padding: '1.1rem 1.25rem',
                      fontSize: '1.05rem',
                      fontWeight: isSelected ? '600' : '400',
                      textAlign: 'right',
                      borderRadius: '10px',
                      border: isSelected ? '2px solid #0284c7' : '1px solid #cbd5e1',
                      backgroundColor: isSelected ? '#f0f9ff' : '#ffffff',
                      color: isSelected ? '#0369a1' : '#1e293b',
                      cursor: isSubmitting ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? '0 4px 6px -1px rgba(2, 132, 199, 0.15)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <span style={{ flex: 1 }}>{option}</span>
                    <span style={{ 
                      width: '20px', 
                      height: '20px', 
                      borderRadius: '50%', 
                      border: isSelected ? '6px solid #0284c7' : '2px solid #94a3b8',
                      display: 'inline-block',
                      marginRight: '0.75rem',
                      boxSizing: 'border-box'
                    }} />
                  </button>
                );
              })}

              <button
                onClick={handleSubmit}
                disabled={!singleSelection || isSubmitting}
                style={{
                  marginTop: '1.25rem',
                  padding: '0.9rem',
                  backgroundColor: !singleSelection || isSubmitting ? '#94a3b8' : '#0284c7',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '1.05rem',
                  fontWeight: '600',
                  cursor: !singleSelection || isSubmitting ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.2s'
                }}
              >
                {isSubmitting ? 'שולח...' : 'שלח תשובה'}
              </button>
            </div>
          )}

          {/* Yes / No Toggle Cards */}
          {activeStage.type === 'yes_no' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {activeStage.options.map((option, idx) => {
                  const isSelected = singleSelection === option;
                  const isYes = option === 'כן';
                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => setSingleSelection(option)}
                      style={{
                        padding: '1.5rem 1rem',
                        fontSize: '1.5rem',
                        fontWeight: 'bold',
                        textAlign: 'center',
                        borderRadius: '12px',
                        border: isSelected 
                          ? (isYes ? '3px solid #16a34a' : '3px solid #dc2626') 
                          : '1px solid #cbd5e1',
                        backgroundColor: isSelected 
                          ? (isYes ? '#f0fdf4' : '#fef2f2') 
                          : '#ffffff',
                        color: isSelected 
                          ? (isYes ? '#15803d' : '#b91c1c') 
                          : '#334155',
                        cursor: isSubmitting ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: isSelected ? '0 4px 6px -1px rgba(0,0,0,0.1)' : 'none'
                      }}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={handleSubmit}
                disabled={!singleSelection || isSubmitting}
                style={{
                  marginTop: '1rem',
                  padding: '0.9rem',
                  backgroundColor: !singleSelection || isSubmitting ? '#94a3b8' : '#0284c7',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '1.05rem',
                  fontWeight: '600',
                  cursor: !singleSelection || isSubmitting ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.2s'
                }}
              >
                {isSubmitting ? 'שולח...' : 'שלח תשובה'}
              </button>
            </div>
          )}

          {/* Multi Choice Checkboxes */}
          {activeStage.type === 'multi_choice' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {activeStage.options.map((option, idx) => {
                const isChecked = multiSelection.includes(option);
                return (
                  <div
                    key={idx}
                    onClick={() => handleToggleMulti(option)}
                    style={{
                      padding: '1.1rem 1.25rem',
                      borderRadius: '10px',
                      border: isChecked ? '2px solid #0284c7' : '1px solid #cbd5e1',
                      backgroundColor: isChecked ? '#f0f9ff' : '#ffffff',
                      color: isChecked ? '#0369a1' : '#1e293b',
                      cursor: isSubmitting ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.85rem',
                      userSelect: 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}}
                      disabled={isSubmitting}
                      style={{ width: '20px', height: '20px', accentColor: '#0284c7', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '1.05rem', fontWeight: isChecked ? '600' : '400' }}>
                      {option}
                    </span>
                  </div>
                );
              })}

              <button
                onClick={handleSubmit}
                disabled={multiSelection.length === 0 || isSubmitting}
                style={{
                  marginTop: '1.25rem',
                  padding: '0.9rem',
                  backgroundColor: multiSelection.length === 0 || isSubmitting ? '#94a3b8' : '#0284c7',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '1.05rem',
                  fontWeight: '600',
                  cursor: multiSelection.length === 0 || isSubmitting ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.2s'
                }}
              >
                {isSubmitting ? 'שולח...' : 'שלח תשובה'}
              </button>
            </div>
          )}

          {/* Short Text Input */}
          {activeStage.type === 'short_text' && (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={activeStage.placeholder}
                disabled={isSubmitting}
                style={{
                  padding: '0.9rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '1.05rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <button
                type="submit"
                disabled={!textInput.trim() || isSubmitting}
                style={{
                  padding: '0.9rem',
                  backgroundColor: !textInput.trim() || isSubmitting ? '#94a3b8' : '#0284c7',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1.05rem',
                  fontWeight: '600',
                  cursor: !textInput.trim() || isSubmitting ? 'not-allowed' : 'pointer'
                }}
              >
                {isSubmitting ? 'שולח...' : 'שלח תשובה'}
              </button>
            </form>
          )}

          {/* Long Textarea Input */}
          {activeStage.type === 'long_text' && (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <textarea
                rows={4}
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={activeStage.placeholder}
                disabled={isSubmitting}
                style={{
                  padding: '0.9rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '1.05rem',
                  fontFamily: 'inherit',
                  outline: 'none',
                  boxSizing: 'border-box',
                  resize: 'vertical'
                }}
              />
              <button
                type="submit"
                disabled={!textInput.trim() || isSubmitting}
                style={{
                  padding: '0.9rem',
                  backgroundColor: !textInput.trim() || isSubmitting ? '#94a3b8' : '#0284c7',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1.05rem',
                  fontWeight: '600',
                  cursor: !textInput.trim() || isSubmitting ? 'not-allowed' : 'pointer'
                }}
              >
                {isSubmitting ? 'שולח...' : 'שלח תשובה'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
