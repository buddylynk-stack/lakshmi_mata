import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const NotFound = () => {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(5);
  const [phase, setPhase] = useState(0); // 0: initial, 1: pulling, 2: pulled

  useEffect(() => {
    // Animation sequence
    const timer1 = setTimeout(() => setPhase(1), 600);
    const timer2 = setTimeout(() => setPhase(2), 1400);

    // Countdown
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          navigate("/");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearInterval(interval);
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-950 via-purple-950 to-slate-950 flex items-center justify-center p-4 overflow-hidden relative">
      {/* Stars */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(60)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width: Math.random() * 3 + 1 + 'px',
              height: Math.random() * 3 + 1 + 'px',
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              opacity: Math.random() * 0.8 + 0.2,
              animation: `star-twinkle ${2 + Math.random() * 3}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 2}s`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes star-twinkle {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 1; }
        }
        @keyframes boy-walk {
          0% { transform: translateX(0); }
          100% { transform: translateX(-100px); }
        }
        @keyframes boy-walk-mobile {
          0% { transform: translateX(0); }
          100% { transform: translateX(-60px); }
        }
        @keyframes leg-walk-left {
          0%, 100% { transform: rotate(-15deg); }
          50% { transform: rotate(15deg); }
        }
        @keyframes leg-walk-right {
          0%, 100% { transform: rotate(15deg); }
          50% { transform: rotate(-15deg); }
        }
        @keyframes arm-reach {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(-60deg); }
        }
        @keyframes tv-fall {
          0% { transform: rotate(0deg) translateY(0); }
          30% { transform: rotate(-5deg) translateY(0); }
          60% { transform: rotate(5deg) translateY(0); }
          100% { transform: rotate(8deg) translateY(10px); }
        }
        @keyframes spark {
          0%, 100% { opacity: 0; transform: scale(0); }
          50% { opacity: 1; transform: scale(1); }
        }
        @keyframes float-text {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes plug-out {
          0% { transform: translateX(0) rotate(0deg); }
          100% { transform: translateX(-30px) rotate(-20deg); }
        }
      `}</style>

      <div className="relative z-10 text-center max-w-3xl w-full">
        {/* Main Scene */}
        <div className="relative h-64 sm:h-80 mb-4">
          
          {/* Floor/Ground */}
          <div className="absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-r from-transparent via-purple-800/30 to-transparent rounded-full blur-sm" />

          {/* === BOY CHARACTER === */}
          <div 
            className="absolute bottom-6 left-[15%] sm:left-[20%] z-20"
            style={{
              animation: phase >= 1 ? 'boy-walk 0.8s ease-out forwards' : 'none',
            }}
          >
            <svg width="100" height="160" viewBox="0 0 100 160" className="w-20 h-32 sm:w-24 sm:h-40">
              {/* Shadow */}
              <ellipse cx="50" cy="155" rx="25" ry="5" fill="rgba(0,0,0,0.3)" />
              
              {/* Left Leg */}
              <g style={{ 
                transformOrigin: '40px 95px',
                animation: phase === 1 ? 'leg-walk-left 0.3s ease-in-out 2' : 'none'
              }}>
                <rect x="35" y="95" width="12" height="45" rx="6" fill="#1e3a5f" />
                <rect x="33" y="135" width="16" height="10" rx="3" fill="#dc2626" />
              </g>
              
              {/* Right Leg */}
              <g style={{ 
                transformOrigin: '60px 95px',
                animation: phase === 1 ? 'leg-walk-right 0.3s ease-in-out 2' : 'none'
              }}>
                <rect x="53" y="95" width="12" height="45" rx="6" fill="#1e3a5f" />
                <rect x="51" y="135" width="16" height="10" rx="3" fill="#dc2626" />
              </g>
              
              {/* Body/Torso - Hoodie */}
              <path d="M30 50 Q30 45 50 42 Q70 45 70 50 L72 95 L28 95 Z" fill="#3b82f6" />
              <path d="M35 50 Q50 55 65 50 L65 60 Q50 65 35 60 Z" fill="#2563eb" />
              
              {/* Hoodie pocket */}
              <rect x="38" y="70" width="24" height="12" rx="3" fill="#2563eb" />
              
              {/* Left Arm (behind) */}
              <g>
                <rect x="20" y="52" width="12" height="35" rx="6" fill="#3b82f6" />
                <circle cx="26" cy="90" r="7" fill="#fcd34d" />
              </g>
              
              {/* Right Arm (pulling) */}
              <g style={{ 
                transformOrigin: '75px 55px',
                animation: phase >= 1 ? 'arm-reach 0.5s ease-out forwards' : 'none'
              }}>
                <rect x="68" y="52" width="12" height="38" rx="6" fill="#3b82f6" />
                {/* Hand gripping */}
                <circle cx="74" cy="92" r="8" fill="#fcd34d" />
                <circle cx="71" cy="89" r="3" fill="#fbbf24" />
                <circle cx="77" cy="89" r="3" fill="#fbbf24" />
                <circle cx="74" cy="95" r="3" fill="#fbbf24" />
              </g>
              
              {/* Neck */}
              <rect x="43" y="38" width="14" height="8" fill="#fcd34d" />
              
              {/* Head */}
              <circle cx="50" cy="25" r="22" fill="#fcd34d" />
              
              {/* Hair */}
              <path d="M28 20 Q30 5 50 3 Q70 5 72 20 Q70 15 50 12 Q30 15 28 20" fill="#4a3728" />
              <path d="M32 22 Q35 8 50 6 Q65 8 68 22" fill="#5c4033" />
              <ellipse cx="35" cy="15" rx="8" ry="5" fill="#4a3728" />
              <ellipse cx="65" cy="15" rx="8" ry="5" fill="#4a3728" />
              
              {/* Face */}
              {/* Eyes */}
              <ellipse cx="40" cy="25" rx="5" ry="6" fill="white" />
              <ellipse cx="60" cy="25" rx="5" ry="6" fill="white" />
              <circle cx="42" cy="26" r="3" fill="#1e293b" />
              <circle cx="62" cy="26" r="3" fill="#1e293b" />
              <circle cx="43" cy="25" r="1" fill="white" />
              <circle cx="63" cy="25" r="1" fill="white" />
              
              {/* Eyebrows */}
              <path d="M35 18 Q40 16 45 18" stroke="#4a3728" strokeWidth="2" fill="none" />
              <path d="M55 18 Q60 16 65 18" stroke="#4a3728" strokeWidth="2" fill="none" />
              
              {/* Nose */}
              <ellipse cx="50" cy="30" rx="2" ry="3" fill="#f59e0b" />
              
              {/* Mouth - mischievous smile */}
              <path d="M42 38 Q50 44 58 38" stroke="#92400e" strokeWidth="2" fill="none" strokeLinecap="round" />
              
              {/* Cheeks */}
              <ellipse cx="33" cy="32" rx="4" ry="3" fill="#fca5a5" opacity="0.5" />
              <ellipse cx="67" cy="32" rx="4" ry="3" fill="#fca5a5" opacity="0.5" />
              
              {/* Ear */}
              <ellipse cx="28" cy="28" rx="4" ry="6" fill="#fcd34d" />
              <ellipse cx="72" cy="28" rx="4" ry="6" fill="#fcd34d" />
            </svg>
          </div>

          {/* === CABLE === */}
          <svg 
            className="absolute bottom-16 sm:bottom-20 left-[30%] sm:left-[35%] w-[45%] sm:w-[40%] h-20 z-10"
            viewBox="0 0 200 60"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="cable-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#1f2937" />
                <stop offset="50%" stopColor="#374151" />
                <stop offset="100%" stopColor="#1f2937" />
              </linearGradient>
            </defs>
            
            {/* Cable wire */}
            <path
              d={phase >= 2 
                ? "M 10 30 C 30 50, 60 10, 90 40 C 120 70, 150 20, 170 30"
                : phase >= 1
                ? "M 10 30 C 40 40, 80 20, 120 35 C 150 45, 170 30, 190 30"
                : "M 10 30 C 50 30, 100 30, 150 30 C 170 30, 185 30, 190 30"
              }
              stroke="url(#cable-grad)"
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              style={{ transition: 'd 0.6s ease-out' }}
            />
            
            {/* Plug */}
            <g style={{
              animation: phase >= 2 ? 'plug-out 0.4s ease-out forwards' : 'none',
              transformOrigin: '190px 30px'
            }}>
              <rect x="185" y="22" width="15" height="16" rx="2" fill="#4b5563" />
              <rect x="195" y="26" width="8" height="3" fill="#9ca3af" />
              <rect x="195" y="31" width="8" height="3" fill="#9ca3af" />
            </g>
          </svg>

          {/* Sparks when unplugged */}
          {phase >= 2 && (
            <div className="absolute bottom-24 sm:bottom-32 right-[22%] sm:right-[28%]">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-2 h-2 bg-yellow-400 rounded-full"
                  style={{
                    animation: `spark 0.3s ease-out ${i * 0.1}s infinite`,
                    transform: `rotate(${i * 72}deg) translateY(-10px)`,
                  }}
                />
              ))}
              <div className="w-4 h-4 bg-yellow-300 rounded-full animate-ping" />
            </div>
          )}

          {/* === TV === */}
          <div 
            className="absolute bottom-6 right-[10%] sm:right-[18%] z-10"
            style={{
              animation: phase >= 2 ? 'tv-fall 0.5s ease-out forwards' : 'none',
              transformOrigin: 'bottom right'
            }}
          >
            <svg width="140" height="130" viewBox="0 0 140 130" className="w-28 h-26 sm:w-36 sm:h-32">
              {/* TV Shadow */}
              <ellipse cx="70" cy="125" rx="50" ry="5" fill="rgba(0,0,0,0.3)" />
              
              {/* Antenna */}
              <line x1="50" y1="15" x2="35" y2="0" stroke="#6b7280" strokeWidth="3" strokeLinecap="round" />
              <line x1="90" y1="15" x2="105" y2="0" stroke="#6b7280" strokeWidth="3" strokeLinecap="round" />
              <circle cx="35" cy="0" r="4" fill="#ef4444" />
              <circle cx="105" cy="0" r="4" fill="#ef4444" />
              
              {/* TV Body */}
              <rect x="15" y="15" width="110" height="85" rx="8" fill="#374151" />
              <rect x="18" y="18" width="104" height="79" rx="6" fill="#1f2937" />
              
              {/* Screen */}
              <rect x="25" y="25" width="90" height="60" rx="4" 
                fill={phase >= 2 ? "#111827" : "url(#screen-gradient)"} 
                style={{ transition: 'fill 0.3s' }}
              />
              
              {/* Screen content */}
              {phase >= 2 ? (
                <>
                  {/* Static lines */}
                  {[...Array(8)].map((_, i) => (
                    <line 
                      key={i}
                      x1="25" 
                      y1={30 + i * 7} 
                      x2="115" 
                      y2={30 + i * 7} 
                      stroke="#374151" 
                      strokeWidth="1"
                      opacity="0.5"
                    />
                  ))}
                  <text x="70" y="52" textAnchor="middle" fill="#4b5563" fontSize="10" fontWeight="bold">NO</text>
                  <text x="70" y="65" textAnchor="middle" fill="#4b5563" fontSize="10" fontWeight="bold">SIGNAL</text>
                </>
              ) : (
                <>
                  <rect x="35" y="35" width="30" height="20" rx="2" fill="#60a5fa" opacity="0.8" />
                  <rect x="75" y="35" width="30" height="20" rx="2" fill="#f472b6" opacity="0.8" />
                  <rect x="35" y="60" width="70" height="8" rx="2" fill="#a78bfa" opacity="0.6" />
                  <rect x="35" y="72" width="50" height="6" rx="2" fill="#34d399" opacity="0.6" />
                </>
              )}
              
              {/* TV buttons */}
              <circle cx="125" cy="50" r="4" fill="#4b5563" />
              <circle cx="125" cy="65" r="4" fill="#4b5563" />
              <circle cx="125" cy="80" r="3" fill={phase >= 2 ? "#374151" : "#22c55e"} style={{ transition: 'fill 0.3s' }} />
              
              {/* TV Stand */}
              <rect x="55" y="100" width="30" height="8" fill="#4b5563" />
              <rect x="45" y="108" width="50" height="6" rx="2" fill="#374151" />
              
              {/* Socket on TV */}
              <rect x="5" y="55" width="12" height="20" rx="2" fill="#4b5563" />
              <rect x="7" y="60" width="3" height="4" fill="#1f2937" />
              <rect x="7" y="66" width="3" height="4" fill="#1f2937" />
              
              <defs>
                <linearGradient id="screen-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="50%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#ec4899" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        {/* 404 Text */}
        <h1 
          className="text-7xl sm:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 mb-3"
          style={{ animation: 'float-text 3s ease-in-out infinite' }}
        >
          404
        </h1>

        <p className="text-xl sm:text-2xl text-white mb-1 font-semibold">Whoops! The plug got pulled!</p>
        <p className="text-gray-400 mb-6 text-sm sm:text-base">This page seems to have lost its connection.</p>

        {/* Countdown */}
        <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur px-5 py-2.5 rounded-full mb-8">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-gray-300">
            Going home in <span className="text-2xl font-bold text-purple-400 mx-1">{countdown}</span>
          </span>
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate("/")}
            className="px-8 py-3.5 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-white font-bold rounded-full hover:opacity-90 transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg shadow-purple-500/30"
          >
            🏠 Take Me Home
          </button>
          <button
            onClick={() => navigate(-1)}
            className="px-8 py-3.5 bg-white/10 backdrop-blur text-white font-semibold rounded-full hover:bg-white/20 transition-all duration-200 transform hover:scale-105 active:scale-95 border border-white/20"
          >
            ← Go Back
          </button>
        </div>

        <p className="mt-10 text-gray-600 text-xs">
          🔌 Looks like someone was curious about the cables...
        </p>
      </div>
    </div>
  );
};

export default NotFound;
