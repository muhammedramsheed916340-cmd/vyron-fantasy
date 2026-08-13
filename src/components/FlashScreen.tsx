'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface FlashScreenProps {
  onComplete: () => void;
  minDuration?: number; // minimum display time in ms
}

/**
 * VYRON Flash Screen — Premium 3D HD Quality
 * 
 * Multi-phase animation:
 * Phase 1: Dark void + particle field materializes
 * Phase 2: 3D VYRON text assembles with holographic effect
 * Phase 3: Energy ring pulse + tagline reveal
 * Phase 4: Full screen burst dissolve into app
 */
export default function FlashScreen({ onComplete, minDuration = 3200 }: FlashScreenProps) {
  const [phase, setPhase] = useState(0);
  const [progress, setProgress] = useState(0);

  // Phase timeline
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Phase 0: Dark void (initial)
    timers.push(setTimeout(() => setPhase(1), 200));   // Start particles
    timers.push(setTimeout(() => setPhase(2), 800));   // Logo reveal
    timers.push(setTimeout(() => setPhase(3), 1800));  // Tagline
    timers.push(setTimeout(() => setPhase(4), 2600));  // Dissolve prep
    timers.push(setTimeout(() => setPhase(5), minDuration)); // Final burst

    return () => timers.forEach(clearTimeout);
  }, [minDuration]);

  // Progress bar
  useEffect(() => {
    if (phase < 5) {
      const interval = setInterval(() => {
        setProgress(prev => Math.min(prev + 0.8, phase >= 4 ? 100 : phase * 20));
      }, 30);
      return () => clearInterval(interval);
    }
  }, [phase]);

  // Call onComplete when final phase triggers
  useEffect(() => {
    if (phase === 5) {
      const timer = setTimeout(onComplete, 600);
      return () => clearTimeout(timer);
    }
  }, [phase, onComplete]);

  // Particle field
  const particles = useCallback(() => {
    const items = [];
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * 100;
      const y = Math.random() * 100;
      const size = 1 + Math.random() * 3;
      const delay = Math.random() * 2;
      const duration = 1.5 + Math.random() * 2;
      items.push(
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            width: `${size}px`,
            height: `${size}px`,
            background: i % 3 === 0
              ? 'rgba(108, 99, 255, 0.7)'
              : i % 3 === 1
                ? 'rgba(0, 212, 170, 0.6)'
                : 'rgba(255, 215, 0, 0.5)',
            boxShadow: `0 0 ${size * 3}px ${i % 3 === 0 ? 'rgba(108, 99, 255, 0.4)' : i % 3 === 1 ? 'rgba(0, 212, 170, 0.3)' : 'rgba(255, 215, 0, 0.3)'}`,
            animation: phase >= 1
              ? `particleFloat ${duration}s ease-in-out ${delay}s infinite`
              : 'none',
            opacity: phase >= 1 ? 1 : 0,
            transition: 'opacity 0.6s ease',
          }}
        />
      );
    }
    return items;
  }, [phase]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at 50% 50%, #0d0d2b 0%, #060614 60%, #020208 100%)',
        // Final dissolve
        opacity: phase >= 5 ? 0 : 1,
        transition: phase >= 5 ? 'opacity 0.5s ease-out' : 'none',
      }}
    >
      {/* Ambient light rays */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Top-left warm glow */}
        <div
          className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(108,99,255,0.15) 0%, transparent 70%)',
            filter: 'blur(60px)',
            animation: phase >= 1 ? 'ambientPulse 4s ease-in-out infinite' : 'none',
            opacity: phase >= 1 ? 1 : 0,
            transition: 'opacity 1s ease',
          }}
        />
        {/* Bottom-right cool glow */}
        <div
          className="absolute -bottom-32 -right-32 w-[600px] h-[600px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(0,212,170,0.12) 0%, transparent 70%)',
            filter: 'blur(80px)',
            animation: phase >= 1 ? 'ambientPulse 5s ease-in-out 1s infinite' : 'none',
            opacity: phase >= 1 ? 1 : 0,
            transition: 'opacity 1s ease 0.3s',
          }}
        />
        {/* Center gold glow */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(255,215,0,0.08) 0%, transparent 70%)',
            filter: 'blur(50px)',
            animation: phase >= 2 ? 'ambientPulse 3s ease-in-out 0.5s infinite' : 'none',
            opacity: phase >= 2 ? 1 : 0,
            transition: 'opacity 0.8s ease',
          }}
        />
      </div>

      {/* Particle field */}
      <div className="absolute inset-0 pointer-events-none">
        {particles()}
      </div>

      {/* Scan line effect */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(108,99,255,0.03) 2px, rgba(108,99,255,0.03) 4px)',
        }}
      />

      {/* Main content container */}
      <div className="relative flex flex-col items-center justify-center">

        {/* ===== 3D ENERGY RING ===== */}
        <div
          className="relative mb-8"
          style={{
            opacity: phase >= 1 ? 1 : 0,
            transform: phase >= 1
              ? 'scale(1) rotate(0deg)'
              : 'scale(0.3) rotate(-180deg)',
            transition: 'all 1.2s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* Outer ring */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[160px] h-[160px] rounded-full"
            style={{
              border: '2px solid transparent',
              borderTopColor: 'rgba(108,99,255,0.6)',
              borderRightColor: 'rgba(0,212,170,0.4)',
              animation: phase >= 2 ? 'ringRotate 3s linear infinite' : 'none',
              boxShadow: '0 0 30px rgba(108,99,255,0.2), inset 0 0 30px rgba(108,99,255,0.1)',
            }}
          />
          {/* Inner ring */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120px] h-[120px] rounded-full"
            style={{
              border: '1.5px solid transparent',
              borderBottomColor: 'rgba(255,215,0,0.5)',
              borderLeftColor: 'rgba(108,99,255,0.3)',
              animation: phase >= 2 ? 'ringRotateReverse 2s linear infinite' : 'none',
              boxShadow: '0 0 20px rgba(0,212,170,0.15), inset 0 0 20px rgba(0,212,170,0.1)',
            }}
          />
          {/* Pulse ring */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100px] h-[100px] rounded-full"
            style={{
              border: '1px solid rgba(108,99,255,0.3)',
              animation: phase >= 2 ? 'pulseRing 2s ease-out infinite' : 'none',
            }}
          />

          {/* Center icon — Trophy */}
          <div
            className="relative w-20 h-20 flex items-center justify-center"
            style={{
              background: 'radial-gradient(circle at 30% 30%, rgba(108,99,255,0.2), rgba(0,212,170,0.1))',
              borderRadius: '50%',
              boxShadow: '0 0 40px rgba(108,99,255,0.3), 0 0 80px rgba(0,212,170,0.15), inset 0 0 30px rgba(255,255,255,0.05)',
            }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="url(#trophyGrad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <defs>
                <linearGradient id="trophyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FFD700" />
                  <stop offset="50%" stopColor="#FFA500" />
                  <stop offset="100%" stopColor="#FFD700" />
                </linearGradient>
              </defs>
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
              <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
              <path d="M4 22h16" />
              <path d="M10 16.66V17a2 2 0 0 1-2 2H6a1 1 0 0 0-1 1v1h14v-1a1 1 0 0 0-1-1h-2a2 2 0 0 1-2-2v-.34" />
              <path d="M7.5 4h9" />
              <path d="M8 4v5a4 4 0 0 0 8 0V4" />
            </svg>
            {/* Holographic shimmer */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: 'linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.08) 50%, transparent 70%)',
                animation: phase >= 2 ? 'holographicShimmer 3s ease-in-out infinite' : 'none',
              }}
            />
          </div>
        </div>

        {/* ===== VYRON 3D TEXT ===== */}
        <div
          className="relative mb-3"
          style={{
            opacity: phase >= 2 ? 1 : 0,
            transform: phase >= 2
              ? 'translateY(0) scale(1)'
              : 'translateY(30px) scale(0.8)',
            transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* 3D depth layers (back to front) */}
          <span
            className="absolute top-0 left-0 text-5xl font-black tracking-[0.15em] select-none"
            style={{
              color: 'rgba(30,20,80,0.5)',
              transform: 'translate(3px, 3px)',
              WebkitTextStroke: '1px rgba(108,99,255,0.15)',
            }}
          >
            VYRON
          </span>
          <span
            className="absolute top-0 left-0 text-5xl font-black tracking-[0.15em] select-none"
            style={{
              color: 'rgba(50,30,120,0.6)',
              transform: 'translate(2px, 2px)',
              WebkitTextStroke: '1px rgba(108,99,255,0.2)',
            }}
          >
            VYRON
          </span>
          <span
            className="absolute top-0 left-0 text-5xl font-black tracking-[0.15em] select-none"
            style={{
              color: 'rgba(80,50,180,0.7)',
              transform: 'translate(1px, 1px)',
              WebkitTextStroke: '1px rgba(0,212,170,0.2)',
            }}
          >
            VYRON
          </span>
          {/* Front face — gradient text */}
          <h1
            className="relative text-5xl font-black tracking-[0.15em] select-none"
            style={{
              background: 'linear-gradient(135deg, #6C63FF 0%, #00D4AA 40%, #FFD700 70%, #6C63FF 100%)',
              backgroundSize: '200% 200%',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              animation: phase >= 2 ? 'gradientShift 4s ease-in-out infinite' : 'none',
              filter: 'drop-shadow(0 0 20px rgba(108,99,255,0.4)) drop-shadow(0 0 40px rgba(0,212,170,0.2))',
            }}
          >
            VYRON
          </h1>
          {/* Holographic sweep */}
          <div
            className="absolute top-0 left-0 right-0 bottom-0 overflow-hidden"
            style={{
              animation: phase >= 2 ? 'holoSweep 2.5s ease-in-out 0.5s infinite' : 'none',
            }}
          >
            <div
              className="h-full w-8"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)',
                transform: 'translateX(-100%)',
              }}
            />
          </div>
        </div>

        {/* ===== TAGLINE ===== */}
        <div
          className="flex flex-col items-center gap-2"
          style={{
            opacity: phase >= 3 ? 1 : 0,
            transform: phase >= 3 ? 'translateY(0)' : 'translateY(15px)',
            transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <p
            className="text-sm font-medium tracking-[0.3em] uppercase"
            style={{
              background: 'linear-gradient(90deg, #00D4AA, #6C63FF)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            AI Fantasy Cricket Platform
          </p>

          {/* Feature badges */}
          <div className="flex items-center gap-3 mt-3">
            {['Dream11', 'My11Circle', 'AI Teams'].map((label, i) => (
              <span
                key={label}
                className="text-[10px] font-semibold tracking-wider uppercase px-2.5 py-1 rounded-full"
                style={{
                  background: i === 0
                    ? 'rgba(108,99,255,0.15)'
                    : i === 1
                      ? 'rgba(0,212,170,0.15)'
                      : 'rgba(255,215,0,0.15)',
                  color: i === 0
                    ? '#8B83FF'
                    : i === 1
                      ? '#00D4AA'
                      : '#FFD700',
                  border: `1px solid ${i === 0 ? 'rgba(108,99,255,0.3)' : i === 1 ? 'rgba(0,212,170,0.3)' : 'rgba(255,215,0,0.3)'}`,
                  animation: phase >= 3 ? `badgeFadeIn 0.5s ease ${0.1 * i}s both` : 'none',
                }}
              >
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* ===== PROGRESS BAR ===== */}
        <div
          className="mt-10 w-48"
          style={{
            opacity: phase >= 2 ? 0.6 : 0,
            transition: 'opacity 0.5s ease',
          }}
        >
          <div className="h-[2px] rounded-full overflow-hidden" style={{ background: 'rgba(108,99,255,0.15)' }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(progress, 100)}%`,
                background: 'linear-gradient(90deg, #6C63FF, #00D4AA)',
                boxShadow: '0 0 8px rgba(108,99,255,0.4)',
                transition: 'width 0.1s linear',
              }}
            />
          </div>
          <p className="text-[9px] text-center mt-2 tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>
            {progress < 100 ? 'INITIALIZING' : 'READY'}
          </p>
        </div>
      </div>

      {/* Corner accents */}
      <div className="absolute top-4 left-4 w-8 h-8" style={{ borderTop: '1px solid rgba(108,99,255,0.3)', borderLeft: '1px solid rgba(108,99,255,0.3)' }} />
      <div className="absolute top-4 right-4 w-8 h-8" style={{ borderTop: '1px solid rgba(0,212,170,0.3)', borderRight: '1px solid rgba(0,212,170,0.3)' }} />
      <div className="absolute bottom-4 left-4 w-8 h-8" style={{ borderBottom: '1px solid rgba(0,212,170,0.3)', borderLeft: '1px solid rgba(0,212,170,0.3)' }} />
      <div className="absolute bottom-4 right-4 w-8 h-8" style={{ borderBottom: '1px solid rgba(255,215,0,0.3)', borderRight: '1px solid rgba(255,215,0,0.3)' }} />

      {/* Version text */}
      <div
        className="absolute bottom-6 left-0 right-0 text-center"
        style={{ opacity: phase >= 3 ? 0.3 : 0, transition: 'opacity 0.5s ease' }}
      >
        <p className="text-[9px] tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>v1.0.0</p>
      </div>

      {/* ===== CSS KEYFRAMES ===== */}
      <style>{`
        @keyframes particleFloat {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.4; }
          25% { transform: translateY(-8px) translateX(4px); opacity: 0.8; }
          50% { transform: translateY(-4px) translateX(-3px); opacity: 0.6; }
          75% { transform: translateY(-10px) translateX(2px); opacity: 0.9; }
        }

        @keyframes ambientPulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.1); }
        }

        @keyframes ringRotate {
          0% { transform: translate(-50%, -50%) rotate(0deg); }
          100% { transform: translate(-50%, -50%) rotate(360deg); }
        }

        @keyframes ringRotateReverse {
          0% { transform: translate(-50%, -50%) rotate(0deg); }
          100% { transform: translate(-50%, -50%) rotate(-360deg); }
        }

        @keyframes pulseRing {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; }
          100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
        }

        @keyframes holographicShimmer {
          0%, 100% { opacity: 0; transform: rotate(0deg); }
          50% { opacity: 1; transform: rotate(3deg); }
        }

        @keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }

        @keyframes holoSweep {
          0% { transform: translateX(-200%); }
          100% { transform: translateX(400%); }
        }

        @keyframes badgeFadeIn {
          0% { opacity: 0; transform: translateY(8px) scale(0.9); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
