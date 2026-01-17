'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// Calculate the focal letter index based on word length
function getFocalIndex(word: string): number {
  const length = word.length;
  
  // Remove punctuation for length calculation but keep it for display
  const cleanLength = word.replace(/[^\w]/g, '').length;
  
  if (cleanLength <= 2) return 1;
  if (cleanLength <= 4) return 2;
  if (cleanLength <= 6) return 3;
  if (cleanLength <= 9) return 4;
  if (cleanLength <= 13) return 5;
  return 6;
}

// Check if word ends with punctuation that requires a pause
function requiresPause(word: string): boolean {
  return /[.!?;:]$/.test(word);
}

// Calculate pause duration multiplier based on punctuation
function getPauseMultiplier(word: string): number {
  if (/[.!?]$/.test(word)) return 1.5; // Sentence end - longer pause
  if (/[;:]$/.test(word)) return 1.2; // Clause separator - medium pause
  if (/[,]$/.test(word)) return 1.1; // Comma - slight pause
  return 1.0; // No pause
}

// Split word into parts: before focal, focal, after focal
// Preserves original capitalization
function splitWord(word: string): { before: string; focal: string; after: string } {
  const cleanWord = word.replace(/[^\w]/g, '');
  
  // If no letters found, just return the word as-is
  if (cleanWord.length === 0) {
    return {
      before: word.slice(0, Math.floor(word.length / 2)),
      focal: word[Math.floor(word.length / 2)] || '',
      after: word.slice(Math.floor(word.length / 2) + 1),
    };
  }
  
  const focalIndex = getFocalIndex(word);
  
  // Find the actual position in the original word (accounting for punctuation)
  let charCount = 0;
  let focalPos = -1;
  const letterPositions: number[] = []; // Track all letter positions
  
  for (let i = 0; i < word.length; i++) {
    if (/[\w]/.test(word[i])) {
      letterPositions.push(i);
      charCount++;
      if (charCount === focalIndex) {
        focalPos = i;
      }
    }
  }
  
  // Fallback: use first letter if calculation failed
  if (focalPos === -1) {
    focalPos = letterPositions[0] ?? 0;
  }
  
  // Simply split the word at the focal position, preserving original capitalization
  return {
    before: word.slice(0, focalPos),
    focal: word[focalPos] || '',
    after: word.slice(focalPos + 1),
  };
}

export default function Home() {
  const [inputText, setInputText] = useState('');
  const [words, setWords] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(300); // words per minute (WPM)
  const [countdown, setCountdown] = useState<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const countdownStateRef = useRef<number | null>(null);

  // Parse text into words
  const parseText = (text: string): string[] => {
    // Split by whitespace and hyphens, then filter out empty strings
    // This handles hyphenated words like "well-known" by splitting them into separate words
    return text
      .trim()
      .split(/[\s-]+/)
      .filter(word => word.length > 0);
  };

  // Calculate delay with punctuation pauses
  const getWordDelay = useCallback((word: string): number => {
    const baseDelay = (60 / speed) * 1000;
    const multiplier = getPauseMultiplier(word);
    return baseDelay * multiplier;
  }, [speed]);

  // Toggle play/pause
  const togglePlay = useCallback(() => {
    if (words.length === 0) return;
    setIsPlaying((prev) => !prev);
  }, [words.length]);

  // Adjust speed
  const adjustSpeed = useCallback((delta: number) => {
    setSpeed((prev) => {
      const newSpeed = prev + delta;
      // Clamp between min and max
      return Math.max(100, Math.min(1000, newSpeed));
    });
  }, []);

  const hasStartedReading = words.length > 0;

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't interfere with typing in textarea
      if (e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          // If countdown is active, skip it and start reading
          if (countdownStateRef.current !== null) {
            setCountdown(null);
            setIsPlaying(true);
          } else {
            togglePlay();
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          adjustSpeed(-50); // Decrease speed by 50 WPM
          break;
        case 'ArrowRight':
          e.preventDefault();
          adjustSpeed(50); // Increase speed by 50 WPM
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [togglePlay, adjustSpeed]);

  // Prevent body scrolling when reading or paused
  useEffect(() => {
    if (hasStartedReading) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [hasStartedReading]);

  // Start/stop reading with punctuation pauses
  useEffect(() => {
    if (isPlaying && words.length > 0 && currentIndex < words.length) {
      const currentWord = words[currentIndex];
      const delay = getWordDelay(currentWord);

      timeoutRef.current = setTimeout(() => {
        setCurrentIndex((prev) => {
          if (prev >= words.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, delay);
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isPlaying, words, currentIndex, getWordDelay]);

  const handleStart = () => {
    if (inputText.trim()) {
      const parsedWords = parseText(inputText);
      setWords(parsedWords);
      setCurrentIndex(0);
      setIsPlaying(false);
      setCountdown(3);
    }
  };

  // Sync countdown state to ref
  useEffect(() => {
    countdownStateRef.current = countdown;
  }, [countdown]);

  // Handle countdown
  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      countdownRef.current = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
    } else if (countdown === 0) {
      setCountdown(null);
      setIsPlaying(true);
    }

    return () => {
      if (countdownRef.current) {
        clearTimeout(countdownRef.current);
      }
    };
  }, [countdown]);

  const handleStop = () => {
    setIsPlaying(false);
    setCountdown(null);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentIndex(0);
    setWords([]);
  };

  const currentWord = words[currentIndex] || '';
  const wordParts = currentWord ? splitWord(currentWord) : { before: '', focal: '', after: '' };
  
  // Calculate reading time remaining
  const calculateRemainingTime = () => {
    if (words.length === 0 || currentIndex >= words.length - 1) return 0;
    const remainingWords = words.slice(currentIndex + 1);
    const totalMs = remainingWords.reduce((acc, word) => acc + getWordDelay(word), 0);
    return Math.ceil(totalMs / 1000); // Convert to seconds
  };

  const remainingSeconds = calculateRemainingTime();
  const remainingMinutes = Math.floor(remainingSeconds / 60);
  const remainingSecs = remainingSeconds % 60;

  const isReadingMode = isPlaying && words.length > 0;

  return (
    <div className={`flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-50 via-blue-50/30 to-zinc-100 dark:from-black dark:via-zinc-950 dark:to-zinc-900 font-sans ${hasStartedReading ? 'overflow-hidden fixed inset-0' : ''}`}>
      <main className={`flex w-full max-w-6xl flex-col items-center justify-center px-6 sm:px-12 transition-all duration-500 ${isReadingMode ? 'min-h-screen py-0' : hasStartedReading ? 'min-h-screen py-0' : 'min-h-screen py-12'}`}>
        {/* Input Section - Fades out when reading */}
        <div className={`w-full max-w-4xl space-y-10 transition-all duration-500 ${isReadingMode ? 'opacity-0 pointer-events-none absolute -z-10' : hasStartedReading ? 'opacity-0 pointer-events-none absolute -z-10' : 'opacity-100'}`}>
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center">
              <div className="relative">
                <h1 className="text-5xl sm:text-6xl font-extrabold bg-gradient-to-r from-blue-600 via-purple-600 to-red-600 dark:from-blue-400 dark:via-purple-400 dark:to-red-400 bg-clip-text text-transparent">
                  Zoomer Digest
                </h1>
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-purple-600 to-red-600 dark:from-blue-400 dark:via-purple-400 dark:to-red-400 rounded-lg blur opacity-20 -z-10"></div>
              </div>
            </div>
            <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
              Spritz-style reading with optimal recognition points. Read faster by focusing on one word at a time.
            </p>
          </div>

          {/* Input Section */}
          <div className="space-y-3">
            <label htmlFor="text-input" className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Enter text to read
            </label>
            <div className="relative">
              <textarea
                id="text-input"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={`Paste or type your text here...\n\nTry pasting an article, essay, or any text you'd like to read quickly. The system will automatically position the optimal focal point for each word.`}
                className="w-full h-56 px-5 py-4 rounded-xl border-2 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 resize-none text-base shadow-sm hover:shadow-md transition-all duration-200"
                disabled={isPlaying}
              />
              <div className="absolute bottom-3 right-3 text-xs text-zinc-400 dark:text-zinc-500">
                {inputText.length > 0 && `${inputText.split(/\s+/).filter(w => w.length > 0).length} words`}
              </div>
              {!inputText.trim() && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <button
                    onClick={() => {
                      const sampleText = `Teddy the chihuahua was small enough to fit inside a hoodie pocket, but he carried himself like a dog ten times his size. His ears stood straight up, radar dishes tuned to danger, snacks, and the sound of the fridge opening. He ruled the apartment from the couch armrest, watching the world with the stern confidence of someone who believed everything existed for his approval.

Every morning, Teddy marched on his tiny paws to inspect his domain. The mailman was his sworn enemy. The vacuum was a demon. Sunbeams on the floor were sacred resting grounds. Despite his tough exterior, he had one weakness: blankets. The moment a blanket appeared, Teddy transformed from fearless guardian into a shivering burrito who demanded warmth and silence.

At night, Teddy curled up, heart pounding fast like all chihuahuas' hearts do, dreaming of heroic battles he definitely would have won. In his sleep, his legs twitched as if he were chasing something enormous and terrifying—probably a squirrel. And though the world saw a tiny dog, Teddy knew the truth: bravery isn't about size, it's about attitude, and he had plenty of that.`;
                      setInputText(sampleText);
                      // Start reading with the sample text
                      const parsedWords = parseText(sampleText);
                      setWords(parsedWords);
                      setCurrentIndex(0);
                      setIsPlaying(false);
                      setCountdown(3);
                    }}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 cursor-pointer pointer-events-auto"
                  >
                    Try Sample Text
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="flex gap-3">
                <button
                  onClick={handleStart}
                  disabled={isPlaying || !inputText.trim()}
                  className="px-8 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold hover:from-blue-700 hover:to-blue-800 disabled:from-zinc-400 disabled:to-zinc-500 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl disabled:shadow-none transform hover:scale-105 disabled:transform-none cursor-pointer"
                >
                  {hasStartedReading ? '▶ Resume' : '▶ Start Reading'}
                </button>
                {inputText.trim() && !isPlaying && (
                  <button
                    onClick={() => setInputText('')}
                    className="px-4 py-3 rounded-xl bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-semibold hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-all duration-200 shadow-md hover:shadow-lg cursor-pointer"
                    title="Clear text"
                  >
                    ✕ Clear
                  </button>
                )}
                {isPlaying && (
                  <button
                    onClick={handleStop}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-red-600 to-red-700 text-white font-semibold hover:from-red-700 hover:to-red-800 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 cursor-pointer"
                  >
                    ⏸ Stop
                  </button>
                )}
                {words.length > 0 && !isPlaying && (
                  <button
                    onClick={handleReset}
                    className="px-6 py-3 rounded-xl bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-semibold hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-all duration-200 shadow-md hover:shadow-lg cursor-pointer"
                  >
                    ↻ Reset
                  </button>
                )}
              </div>

              {/* Speed Control */}
              <div className="flex items-center gap-4 bg-white dark:bg-zinc-800 px-5 py-3 rounded-xl shadow-md border border-zinc-200 dark:border-zinc-700">
                <label htmlFor="speed" className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                  Speed: <span className="text-blue-600 dark:text-blue-400">{speed} WPM</span>
                </label>
                <input
                  id="speed"
                  type="range"
                  min="100"
                  max="1000"
                  step="50"
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  className="w-48 h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-600 hover:accent-blue-700 transition-colors"
                />
              </div>
            </div>

            {/* Progress info when paused */}
            {hasStartedReading && !isPlaying && (
              <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                    Reading Progress
                  </span>
                  <span className="text-xs text-blue-700 dark:text-blue-300">
                    {Math.round(((currentIndex + 1) / words.length) * 100)}% complete
                  </span>
                </div>
                <div className="w-full h-2 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300"
                    style={{ width: `${((currentIndex + 1) / words.length) * 100}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-blue-700 dark:text-blue-300">
                  <span>Word {currentIndex + 1} of {words.length}</span>
                  {remainingSeconds > 0 && (
                    <span>{remainingMinutes > 0 ? `${remainingMinutes}m ` : ''}{remainingSecs}s remaining</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Instructions */}
          {words.length === 0 && (
            <div className="mt-8 p-8 rounded-2xl bg-gradient-to-br from-white to-zinc-50 dark:from-zinc-800 dark:to-zinc-900 border-2 border-zinc-200 dark:border-zinc-700 shadow-xl">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Left side - How it works */}
                <div>
                  <div className="flex items-start gap-4 mb-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                      ℹ
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">
                        How it works
                      </h2>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        Speed reading made simple with science-backed techniques
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 text-xs font-bold mt-0.5">
                        1
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Enter your text</p>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400">Paste or type any text you want to read</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 text-xs font-bold mt-0.5">
                        2
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Start reading</p>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400">Click Start or press Space to begin</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 text-xs font-bold mt-0.5">
                        3
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Focus on the red letter</p>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400">Keep your eyes fixed on the center focal point</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Right side - Keyboard shortcuts and features */}
                <div className="space-y-3">
                  <div className="p-4 rounded-lg bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800">
                    <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50 mb-3 flex items-center gap-2">
                      <span className="text-lg">⌨️</span>
                      Keyboard Shortcuts
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 flex-shrink-0">Play/Pause</span>
                        <kbd className="px-2.5 py-1.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 rounded-md shadow-sm font-mono">
                          Space
                        </kbd>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 flex-shrink-0">Adjust Speed</span>
                        <div className="flex items-center gap-2">
                          <kbd className="px-2.5 py-1.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 rounded-md shadow-sm font-mono">
                            ←
                          </kbd>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">or</span>
                          <kbd className="px-2.5 py-1.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 rounded-md shadow-sm font-mono">
                            →
                          </kbd>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-800">
                    <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50 mb-3 flex items-center gap-2">
                      <span className="text-lg">✨</span>
                      Features
                    </p>
                    <ul className="space-y-2 text-xs text-zinc-700 dark:text-zinc-300">
                      <li className="flex items-start gap-2">
                        <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                        <span>Optimal recognition point positioning</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                        <span>Automatic punctuation pauses</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                        <span>Pattern recognition enhancement</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Countdown Overlay */}
        {countdown !== null && (
          <div 
            className="fixed inset-0 flex items-center justify-center z-50 bg-black/50 dark:bg-black/70 backdrop-blur-sm cursor-pointer"
            onClick={() => {
              setCountdown(null);
              setIsPlaying(true);
            }}
          >
            <div className="flex flex-col items-center justify-center px-4">
              <div className="text-6xl sm:text-8xl md:text-9xl font-bold text-white animate-pulse">
                {countdown}
              </div>
              <p className="text-lg sm:text-xl text-white/80 mt-3 sm:mt-4">Get ready...</p>
              <p className="text-xs sm:text-sm text-white/60 mt-2">Tap or click to start now</p>
            </div>
          </div>
        )}

        {/* Reading Display - Shows when reading or paused */}
        {hasStartedReading && (
          <div 
            className={`transition-all duration-500 fixed inset-0 flex items-center justify-center ${isReadingMode ? 'opacity-100' : 'opacity-100'} cursor-pointer`}
            onClick={(e) => {
              // Don't toggle if clicking on buttons or interactive elements
              const target = e.target as HTMLElement;
              if (target.tagName === 'BUTTON' || target.closest('button') || target.tagName === 'INPUT' || target.closest('input') || target.closest('label')) {
                return;
              }
              togglePlay();
            }}
          >
            <div className="flex flex-col items-center justify-center w-full h-full relative">
              {/* Controls when reading or paused */}
              <div className="absolute top-3 sm:top-6 left-0 right-0 flex flex-col items-center gap-3 sm:gap-4 z-10 px-2">
                <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 rounded-lg bg-black/10 dark:bg-white/10 backdrop-blur-sm max-w-full">
                  {!isPlaying && (
                    <span className="text-xs px-2 py-1 rounded bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 font-medium">
                      Paused
                    </span>
                  )}
                  <span className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 font-medium font-mono">
                    {speed} WPM
                  </span>
                  <span className="hidden sm:inline text-zinc-400 dark:text-zinc-500">•</span>
                  <span className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 font-mono">
                    <span className="hidden sm:inline">Word </span>{currentIndex + 1}<span className="hidden sm:inline"> of {words.length}</span>
                  </span>
                  <span className="hidden sm:inline text-zinc-400 dark:text-zinc-500">•</span>
                  <span className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 font-mono">
                    {Math.round(((currentIndex + 1) / words.length) * 100)}%
                  </span>
                  {remainingSeconds > 0 && (
                    <>
                      <span className="hidden sm:inline text-zinc-400 dark:text-zinc-500">•</span>
                      <span className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 font-mono">
                        {remainingMinutes > 0 ? `${remainingMinutes}m ` : ''}{remainingSecs}s<span className="hidden sm:inline"> left</span>
                      </span>
                    </>
                  )}
                  {isPlaying && (
                    <button
                      onClick={handleStop}
                      className="ml-1 sm:ml-2 px-2 sm:px-3 py-1 text-xs rounded bg-red-600 text-white font-medium hover:bg-red-700 transition-colors cursor-pointer"
                    >
                      Stop
                    </button>
                  )}
                  {!isPlaying && (
                    <button
                      onClick={() => {
                        setWords([]);
                        setCurrentIndex(0);
                      }}
                      className="ml-1 sm:ml-2 px-2 sm:px-3 py-1 text-xs rounded bg-zinc-600 text-white font-medium hover:bg-zinc-700 transition-colors cursor-pointer"
                    >
                      <span className="hidden sm:inline">Back to Input</span>
                      <span className="sm:hidden">Back</span>
                    </button>
                  )}
                </div>
                
                {/* Speed Control - Show when paused */}
                {!isPlaying && (
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 w-full px-2">
                    <button
                      onClick={handleStart}
                      className="px-4 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-md hover:shadow-lg cursor-pointer w-full sm:w-auto whitespace-nowrap"
                    >
                      ▶ Play
                    </button>
                    <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 px-4 sm:px-5 py-3 rounded-xl bg-white/90 dark:bg-zinc-800/90 backdrop-blur-sm shadow-lg border border-zinc-200 dark:border-zinc-700 w-full sm:w-auto">
                      <label htmlFor="speed-paused" className="text-xs sm:text-sm font-semibold text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                        Speed: <span className="text-blue-600 dark:text-blue-400">{speed} WPM</span>
                      </label>
                      <input
                        id="speed-paused"
                        type="range"
                        min="100"
                        max="1000"
                        step="50"
                        value={speed}
                        onChange={(e) => setSpeed(Number(e.target.value))}
                        className="w-full sm:w-64 h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-600 hover:accent-blue-700 transition-colors"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Word Display - Anchored focal letter at exact center */}
              <div className="relative w-full flex items-center justify-center flex-1 px-2 sm:px-4">
                <div className="relative w-full max-w-4xl h-24 sm:h-32 flex items-center justify-center">
                  {/* Vertical guide line */}
                  <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-red-500/20 dark:bg-red-400/20 pointer-events-none" />
                  
                  {/* Top horizontal line */}
                  <div className="absolute left-0 right-0 top-1/2 -translate-y-[calc(50%+5rem)] sm:-translate-y-[calc(50%+7rem)] h-px bg-zinc-300/30 dark:bg-zinc-600/30 pointer-events-none" />
                  
                  {/* Bottom horizontal line */}
                  <div className="absolute left-0 right-0 top-1/2 -translate-y-[calc(-50%-5rem)] sm:-translate-y-[calc(-50%-7rem)] h-px bg-zinc-300/30 dark:bg-zinc-600/30 pointer-events-none" />
                  
                  {/* Vertical line from top horizontal line down toward focal point - mobile */}
                  <div 
                    className="absolute left-1/2 w-px bg-zinc-300/30 dark:bg-zinc-600/30 pointer-events-none sm:hidden"
                    style={{ 
                      top: 'calc(50% - 5rem)',
                      height: '1rem',
                      transform: 'translateX(-50%)'
                    }}
                  />
                  {/* Vertical line from top horizontal line down toward focal point - desktop */}
                  <div 
                    className="absolute left-1/2 w-px bg-zinc-300/30 dark:bg-zinc-600/30 pointer-events-none hidden sm:block"
                    style={{ 
                      top: 'calc(50% - 7rem)', 
                      height: '1.5rem',
                      transform: 'translateX(-50%)'
                    }}
                  />
                  
                  {/* Vertical line from bottom horizontal line up toward focal point - mobile */}
                  <div 
                    className="absolute left-1/2 w-px bg-zinc-300/30 dark:bg-zinc-600/30 pointer-events-none sm:hidden"
                    style={{ 
                      bottom: 'calc(50% - 5rem)', 
                      height: '1rem',
                      transform: 'translateX(-50%)'
                    }}
                  />
                  {/* Vertical line from bottom horizontal line up toward focal point - desktop */}
                  <div 
                    className="absolute left-1/2 w-px bg-zinc-300/30 dark:bg-zinc-600/30 pointer-events-none hidden sm:block"
                    style={{ 
                      bottom: 'calc(50% - 7rem)', 
                      height: '1.5rem',
                      transform: 'translateX(-50%)'
                    }}
                  />
                  
                  {/* Fixed center anchor - left edge at 50% */}
                  <div className="absolute left-1/2 top-1/2 -translate-y-1/2 flex items-center">
                    {/* Focal letter container - centers the letter on the anchor point */}
                    <div className="relative -translate-x-1/2 transition-opacity duration-150">
                      <span className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-red-600 dark:text-red-500 leading-none font-mono inline-block drop-shadow-sm">
                        {wordParts.focal}
                      </span>
                      {/* Before text - ends right before focal letter (dimmed) */}
                      <span 
                        className="absolute right-full text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-zinc-900 dark:text-zinc-50 leading-none font-mono whitespace-nowrap pr-0.5 sm:pr-1 opacity-70 transition-opacity duration-150"
                      >
                        {wordParts.before}
                      </span>
                      {/* After text - starts right after focal letter (dimmed) */}
                      <span 
                        className="absolute left-full text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-zinc-900 dark:text-zinc-50 leading-none font-mono whitespace-nowrap pl-0.5 sm:pl-1 opacity-70 transition-opacity duration-150"
                      >
                        {wordParts.after}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress Indicator - Always visible when reading or paused */}
              <div className="absolute bottom-4 sm:bottom-8 left-0 right-0 flex justify-center px-2">
                <div className="w-full max-w-md">
                  <div className="mb-1 sm:mb-2 flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
                    <span>Progress</span>
                    <span>{Math.round(((currentIndex + 1) / words.length) * 100)}%</span>
                  </div>
                  <div className="w-full h-1.5 sm:h-2 bg-zinc-200/70 dark:bg-zinc-700/70 rounded-full overflow-hidden shadow-inner">
                    <div
                      className="h-full bg-gradient-to-r from-blue-600 to-blue-500 transition-all duration-300 ease-out"
                      style={{ width: `${((currentIndex + 1) / words.length) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
