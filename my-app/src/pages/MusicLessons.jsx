import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

// Guitar Fretboard Game Component
function GuitarFretboardGame({ onComplete }) {
  const [score, setScore] = useState(0)
  const [currentRound, setCurrentRound] = useState(0)
  const [targetNote, setTargetNote] = useState(0)
  const [selectedFret, setSelectedFret] = useState(null)
  const [selectedString, setSelectedString] = useState(null)
  const [feedback, setFeedback] = useState('')
  const [gameComplete, setGameComplete] = useState(false)
  const audioContextRef = useRef(null)

  // Guitar strings (starting notes from low to high)
  const strings = ['E', 'A', 'D', 'G', 'B', 'E']
  const notes = ['E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'C', 'C#', 'D', 'D#']
  
  // Target notes for the game (simpler for learning)
  const targetNotes = ['E', 'A', 'D', 'G', 'B', 'E', 'F', 'G', 'A', 'B']

  // Play guitar sound using Web Audio API
  const playGuitarSound = (frequency, isCorrect = true) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }

    const ctx = audioContextRef.current
    const now = ctx.currentTime

    try {
      // Create oscillator for guitar-like sound
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const filter = ctx.createBiquadFilter()

      // Guitar-like setup
      osc.type = 'triangle'
      osc.frequency.value = frequency
      filter.type = 'lowpass'
      filter.frequency.value = isCorrect ? 3000 : 1500

      // Connect the chain
      osc.connect(filter)
      filter.connect(gain)
      gain.connect(ctx.destination)

      // Attack, decay, sustain, release
      gain.gain.setValueAtTime(0.3, now)
      gain.gain.exponentialRampToValueAtTime(0.05, now + 0.1)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5)

      osc.start(now)
      osc.stop(now + 0.5)

      // Frequency modulation for guitar-like effect
      osc.frequency.exponentialRampToValueAtTime(frequency * 0.95, now + 0.05)
    } catch (e) {
      console.log('Audio playback not available')
    }
  }

  // Get the note at a specific fret on a string
  const getNoteAtFret = (stringIdx, fretIdx) => {
    const startNote = strings[stringIdx]
    const startNoteIdx = notes.indexOf(startNote)
    return notes[(startNoteIdx + fretIdx) % 12]
  }

  // Handle fret click
  const handleFretClick = (stringIdx, fretIdx) => {
    const clickedNote = getNoteAtFret(stringIdx, fretIdx)
    const target = targetNotes[currentRound]

    setSelectedString(stringIdx)
    setSelectedFret(fretIdx)

    if (clickedNote === target) {
      // Correct!
      playGuitarSound(440, true) // A4 frequency
      setFeedback('✅ Correct!')
      const newScore = score + 1
      setScore(newScore)

      // Move to next round after delay
      setTimeout(() => {
        if (currentRound < 9) {
          setCurrentRound(currentRound + 1)
          setSelectedString(null)
          setSelectedFret(null)
          setFeedback('')
        } else {
          setGameComplete(true)
        }
      }, 800)
    } else {
      // Incorrect
      playGuitarSound(100, false) // Lower frequency for wrong answer
      setFeedback(`❌ Wrong! That's ${clickedNote}`)
      setTimeout(() => {
        setFeedback('')
      }, 1500)
    }
  }

  if (gameComplete) {
    return (
      <div className="text-center py-12">
        <h2 className="text-5xl font-bold mb-12 animate-pulse">🎸 Game Complete! 🎸</h2>
        
        <div className="bg-gradient-to-br from-[#2a2a2a] to-[#1f1f1f] p-12 rounded-lg border-2 border-[#ffd700]/50 mb-10 shadow-2xl max-w-2xl mx-auto">
          <div className="mb-8">
            <p className="text-7xl font-black text-[#ffd700] drop-shadow-lg">{score} / 10</p>
            <p className="text-3xl text-[#bbb] mt-4">Notes Found: {score}/10</p>
          </div>
          
          <div className="mb-8 p-4 bg-[#1b1b1b] rounded-lg border border-[#ffd700]/30">
            {score === 10 && (
              <p className="text-2xl text-[#ffd700] font-bold">🌟 PERFECT! You're a Fretboard Master! 🌟</p>
            )}
            {score >= 8 && score < 10 && (
              <p className="text-2xl text-[#ffd700] font-bold">⭐ Excellent! Great fretboard knowledge! ⭐</p>
            )}
            {score >= 6 && score < 8 && (
              <p className="text-2xl text-[#ffd700] font-bold">👏 Good Job! Keep practicing! 👏</p>
            )}
            {score < 6 && (
              <p className="text-2xl text-[#ffd700] font-bold">💪 Great start! Practice more to master the fretboard! 💪</p>
            )}
          </div>
          
          <button
            onClick={onComplete}
            className="bg-[#ffd700] hover:bg-[#ffe44c] text-black font-bold py-4 px-8 rounded-lg transition shadow-lg text-lg transform hover:scale-105"
          >
            🏠 Back to Lessons
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto py-8">
      {/* Game Header */}
      <div className="text-center mb-8">
        <h2 className="text-4xl font-bold text-[#ffd700] mb-4">🎸 The Fretboard Master</h2>
        <p className="text-[#bbb] text-lg mb-6">Click the fret to find the note: <span className="text-[#ffd700] text-2xl font-bold">{targetNotes[currentRound]}</span></p>
        
        {/* Progress and Score */}
        <div className="flex justify-between items-center mb-6 bg-[#2a2a2a] p-4 rounded-lg border border-[#ffd700]/30">
          <div>
            <p className="text-[#bbb]">Round {currentRound + 1} of 10</p>
          </div>
          <div className="w-40 h-2 bg-[#1b1b1b] rounded-full overflow-hidden">
            <div 
              className="h-full bg-[#ffd700] transition-all duration-300"
              style={{width: `${(currentRound / 10) * 100}%`}}
            ></div>
          </div>
          <div>
            <p className="text-[#ffd700] font-bold">Score: {score}/10</p>
          </div>
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`text-center mb-6 text-2xl font-bold animate-bounce ${feedback.includes('✅') ? 'text-green-400' : 'text-red-400'}`}>
          {feedback}
        </div>
      )}

      {/* Guitar Fretboard SVG */}
      <div className="flex justify-center mb-8 bg-[#2a2a2a] p-8 rounded-lg border border-[#ffd700]/30">
        <svg width="100%" height="400" viewBox="0 0 1200 400" className="max-w-full">
          {/* Guitar Wood Background */}
          <rect width="1200" height="400" fill="#3d2817" rx="10"/>
          
          {/* Frets (vertical lines) */}
          {Array.from({ length: 6 }).map((_, i) => (
            <line
              key={`fret-${i}`}
              x1={100 + i * 170}
              y1="80"
              x2={100 + i * 170}
              y2="320"
              stroke="#8B7355"
              strokeWidth="3"
            />
          ))}

          {/* Strings (horizontal lines) and clickable frets */}
          {strings.map((string, stringIdx) => {
            const y = 80 + stringIdx * 40
            return (
              <g key={`string-${stringIdx}`}>
                {/* String line */}
                <line
                  x1="100"
                  y1={y}
                  x2="1020"
                  y2={y}
                  stroke="#DAA520"
                  strokeWidth="2"
                />

                {/* String label */}
                <text
                  x="40"
                  y={y + 5}
                  fill="#ffd700"
                  fontSize="16"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {string}
                </text>

                {/* Frets on this string */}
                {Array.from({ length: 5 }).map((_, fretIdx) => {
                  const x = 100 + fretIdx * 170
                  const note = getNoteAtFret(stringIdx, fretIdx + 1)
                  const isTarget = note === targetNotes[currentRound]
                  const isSelected = selectedString === stringIdx && selectedFret === fretIdx + 1

                  return (
                    <g key={`fret-${stringIdx}-${fretIdx}`}>
                      {/* Fret dot (clickable) */}
                      <circle
                        cx={x}
                        cy={y}
                        r="18"
                        fill={isSelected ? (feedback.includes('✅') ? '#22c55e' : '#ef4444') : '#555'}
                        stroke={isTarget && !isSelected ? '#ffd700' : '#888'}
                        strokeWidth={isTarget && !isSelected ? '3' : '1'}
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleFretClick(stringIdx, fretIdx + 1)}
                        className="hover:fill-[#ffd700] transition"
                      />

                      {/* Note label */}
                      <text
                        x={x}
                        y={y + 5}
                        fill="white"
                        fontSize="12"
                        fontWeight="bold"
                        textAnchor="middle"
                        pointerEvents="none"
                      >
                        {note}
                      </text>

                      {/* Fret number at bottom */}
                      {stringIdx === 5 && (
                        <text
                          x={x}
                          y="360"
                          fill="#ffd700"
                          fontSize="14"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {fretIdx + 1}
                        </text>
                      )}
                    </g>
                  )
                })}
              </g>
            )
          })}

          {/* Open strings (fret 0) */}
          {strings.map((string, stringIdx) => {
            const y = 80 + stringIdx * 40
            return (
              <g key={`open-${stringIdx}`}>
                <circle
                  cx="100"
                  cy={y}
                  r="18"
                  fill={selectedString === stringIdx && selectedFret === 0 ? (feedback.includes('✅') ? '#22c55e' : '#ef4444') : '#555'}
                  stroke="#888"
                  strokeWidth="1"
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleFretClick(stringIdx, 0)}
                  className="hover:fill-[#ffd700] transition"
                />
                <text
                  x="100"
                  y={y + 5}
                  fill="white"
                  fontSize="10"
                  fontWeight="bold"
                  textAnchor="middle"
                  pointerEvents="none"
                >
                  O
                </text>
              </g>
            )
          })}

          {/* Legend */}
          <text x="50" y="395" fill="#bbb" fontSize="12">
            Open (O) • Click circles to find notes
          </text>
        </svg>
      </div>

      {/* Instructions */}
      <div className="bg-[#2a2a2a] border border-[#ffd700]/30 rounded-lg p-4">
        <p className="text-[#bbb] text-sm">
          <span className="text-[#ffd700] font-bold">Goal:</span> Click on the correct fret to find the highlighted note. Correct answers light up green and play a sound. You have 10 rounds to find all the notes!
        </p>
      </div>
    </div>
  )
}

// Piano Simon Says Game Component
function PianoSimonGame({ onComplete }) {
  const [sequence, setSequence] = useState([])
  const [userSequence, setUserSequence] = useState([])
  const [gameStarted, setGameStarted] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [gameWon, setGameWon] = useState(false)
  const [maxSequenceLength, setMaxSequenceLength] = useState(3)
  const audioContextRef = useRef(null)

  // Piano keys from C4 to C5
  const pianoKeys = [
    { note: 'C', octave: 4, freq: 261.63, color: 'white' },
    { note: 'C#', octave: 4, freq: 277.18, color: 'black' },
    { note: 'D', octave: 4, freq: 293.66, color: 'white' },
    { note: 'D#', octave: 4, freq: 311.13, color: 'black' },
    { note: 'E', octave: 4, freq: 329.63, color: 'white' },
    { note: 'F', octave: 4, freq: 349.23, color: 'white' },
    { note: 'F#', octave: 4, freq: 369.99, color: 'black' },
    { note: 'G', octave: 4, freq: 392.00, color: 'white' },
    { note: 'G#', octave: 4, freq: 415.30, color: 'black' },
    { note: 'A', octave: 4, freq: 440.00, color: 'white' },
    { note: 'A#', octave: 4, freq: 466.16, color: 'black' },
    { note: 'B', octave: 4, freq: 493.88, color: 'white' },
    { note: 'C', octave: 5, freq: 523.25, color: 'white' }
  ]

  const playPianoSound = (frequency, duration = 0.3) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }

    const ctx = audioContextRef.current
    const now = ctx.currentTime

    try {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.value = frequency

      osc.connect(gain)
      gain.connect(ctx.destination)

      gain.gain.setValueAtTime(0.3, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + duration)

      osc.start(now)
      osc.stop(now + duration)
    } catch (e) {
      console.log('Audio playback not available')
    }
  }

  const startGame = () => {
    setSequence([])
    setUserSequence([])
    setGameStarted(true)
    setGameOver(false)
    setGameWon(false)
    setMaxSequenceLength(3)
    playNextRound([])
  }

  const playNextRound = async (currentSequence) => {
    setIsPlaying(true)
    
    // Add a new random key to the sequence
    const randomIndex = Math.floor(Math.random() * pianoKeys.length)
    const newSequence = [...currentSequence, randomIndex]
    setSequence(newSequence)

    // Wait a moment before playing
    await new Promise(resolve => setTimeout(resolve, 500))

    // Play the entire sequence
    for (let i = 0; i < newSequence.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 300))
      const keyIndex = newSequence[i]
      playPianoSound(pianoKeys[keyIndex].freq, 0.4)
      
      // Visual feedback
      const keyElement = document.getElementById(`key-${keyIndex}`)
      if (keyElement) {
        keyElement.style.opacity = '0.5'
        setTimeout(() => {
          keyElement.style.opacity = '1'
        }, 200)
      }
    }

    setUserSequence([])
    setIsPlaying(false)
  }

  const handleKeyPress = (keyIndex) => {
    if (isPlaying || gameOver || gameWon) return

    playPianoSound(pianoKeys[keyIndex].freq, 0.3)

    // Visual feedback
    const keyElement = document.getElementById(`key-${keyIndex}`)
    if (keyElement) {
      keyElement.style.transform = 'scaleY(0.95)'
      setTimeout(() => {
        keyElement.style.transform = 'scaleY(1)'
      }, 150)
    }

    const newUserSequence = [...userSequence, keyIndex]
    setUserSequence(newUserSequence)

    // Check if the user's press is correct
    if (newUserSequence[newUserSequence.length - 1] !== sequence[newUserSequence.length - 1]) {
      // Wrong key pressed
      setGameOver(true)
      playPianoSound(100, 0.5) // Error sound
      return
    }

    // Check if user has completed this round
    if (newUserSequence.length === sequence.length) {
      // User completed the sequence correctly
      if (sequence.length >= maxSequenceLength) {
        // Game won!
        setGameWon(true)
        playPianoSound(523.25, 0.2) // C5
        setTimeout(() => playPianoSound(659.25, 0.2), 200) // E5
        setTimeout(() => playPianoSound(783.99, 0.3), 400) // G5
        return
      }

      // Move to next round
      setTimeout(() => {
        playNextRound(sequence)
      }, 1000)
    }
  }

  if (!gameStarted) {
    return (
      <div className="text-center py-12">
        <h2 className="text-4xl font-bold text-[#ffd700] mb-6">🎹 Simon Says Keys</h2>
        <p className="text-[#bbb] text-lg mb-8 max-w-2xl mx-auto">
          Watch the sequence of piano keys light up and play sounds. Then click the same keys in the same order. 
          Each time you get it right, the sequence gets longer. Can you remember up to 8 notes?
        </p>
        <button
          onClick={startGame}
          className="bg-gradient-to-r from-[#ffd700] to-[#ffe44c] hover:from-[#ffe44c] hover:to-[#ffd700] text-black font-bold py-4 px-8 rounded-xl transition shadow-lg shadow-[#ffd700]/50 text-lg transform hover:scale-105"
        >
          🎮 Start Game
        </button>
      </div>
    )
  }

  if (gameWon) {
    return (
      <div className="text-center py-12">
        <h2 className="text-5xl font-bold mb-12 animate-pulse">🎉 You Won! 🎉</h2>
        
        <div className="bg-gradient-to-br from-[#2a2a2a] to-[#1f1f1f] p-12 rounded-lg border-2 border-[#ffd700]/50 mb-10 shadow-2xl max-w-2xl mx-auto">
          <div className="mb-8">
            <p className="text-6xl font-black text-[#ffd700] drop-shadow-lg">{sequence.length}</p>
            <p className="text-2xl text-[#bbb] mt-4">Notes Remembered</p>
          </div>
          
          <div className="mb-8 p-4 bg-[#1b1b1b] rounded-lg border border-[#ffd700]/30">
            <p className="text-xl text-[#ffd700] font-bold">🌟 You mastered the piano memory challenge! 🌟</p>
          </div>
          
          <button
            onClick={onComplete}
            className="bg-[#ffd700] hover:bg-[#ffe44c] text-black font-bold py-4 px-8 rounded-lg transition shadow-lg text-lg transform hover:scale-105"
          >
            🏠 Back to Lessons
          </button>
        </div>
      </div>
    )
  }

  if (gameOver) {
    return (
      <div className="text-center py-12">
        <h2 className="text-5xl font-bold mb-12 animate-pulse">❌ Game Over</h2>
        
        <div className="bg-gradient-to-br from-[#2a2a2a] to-[#1f1f1f] p-12 rounded-lg border-2 border-[#ff4444]/50 mb-10 shadow-2xl max-w-2xl mx-auto">
          <div className="mb-8">
            <p className="text-6xl font-black text-[#ff6b6b] drop-shadow-lg">{sequence.length - 1}</p>
            <p className="text-2xl text-[#bbb] mt-4">Sequences Completed</p>
          </div>
          
          <div className="mb-8 p-4 bg-[#1b1b1b] rounded-lg border border-[#ff4444]/30">
            <p className="text-xl text-[#ff6b6b] font-bold">You were on a {sequence.length - 1} note sequence!</p>
            <p className="text-sm text-[#bbb] mt-2">Try again to beat your score!</p>
          </div>
          
          <button
            onClick={startGame}
            className="bg-gradient-to-r from-[#ffd700] to-[#ffe44c] hover:from-[#ffe44c] hover:to-[#ffd700] text-black font-bold py-4 px-8 rounded-lg transition shadow-lg shadow-[#ffd700]/50 text-lg transform hover:scale-105 mr-4"
          >
            🔄 Try Again
          </button>
          
          <button
            onClick={onComplete}
            className="bg-[#444] hover:bg-[#555] text-white font-bold py-4 px-8 rounded-lg transition shadow-lg text-lg transform hover:scale-105"
          >
            🏠 Back to Lessons
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto py-8">
      {/* Game Header */}
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-[#ffd700] mb-4">🎹 Simon Says Keys</h2>
        
        {/* Progress */}
        <div className="flex justify-between items-center mb-6 bg-[#2a2a2a] p-4 rounded-lg border border-[#ffd700]/30 max-w-md mx-auto">
          <div>
            <p className="text-[#bbb] text-sm">Current Sequence</p>
            <p className="text-[#ffd700] font-bold text-xl">{sequence.length} Notes</p>
          </div>
          <div>
            <p className="text-[#bbb] text-sm">Target</p>
            <p className="text-[#ffd700] font-bold text-xl">{maxSequenceLength} Notes</p>
          </div>
          <div>
            <p className="text-[#bbb] text-sm">Your Input</p>
            <p className="text-[#ffd700] font-bold text-xl">{userSequence.length}/{sequence.length}</p>
          </div>
        </div>

        {/* Status */}
        {isPlaying && (
          <p className="text-lg text-[#ffd700] font-bold animate-pulse mb-4">🎵 Listen to the sequence...</p>
        )}
        {!isPlaying && sequence.length > 0 && (
          <p className="text-lg text-[#bbb] mb-4">👆 Now it's your turn! Click the keys in order...</p>
        )}
      </div>

      {/* Piano Keyboard */}
      <div className="bg-gradient-to-b from-[#3d2817] to-[#2a1810] p-8 rounded-2xl border-2 border-[#8B7355] shadow-2xl mb-8">
        <div className="flex justify-center items-end gap-0.5 h-80 relative">
          {pianoKeys.map((key, idx) => (
            <div key={idx} className="relative">
              {key.color === 'white' ? (
                <button
                  id={`key-${idx}`}
                  onClick={() => handleKeyPress(idx)}
                  disabled={isPlaying}
                  className="w-16 h-64 bg-white border-4 border-gray-800 rounded-b-lg shadow-xl hover:bg-gray-100 active:bg-gray-200 transition-all disabled:opacity-70 disabled:cursor-not-allowed hover:shadow-2xl"
                  style={{
                    transform: 'scaleY(1)',
                    transformOrigin: 'top'
                  }}
                >
                  <div className="text-xs font-bold text-gray-800 mt-56">
                    {key.note}
                  </div>
                </button>
              ) : (
                <button
                  id={`key-${idx}`}
                  onClick={() => handleKeyPress(idx)}
                  disabled={isPlaying}
                  className="absolute w-12 h-40 bg-black border-2 border-gray-900 rounded-b-lg shadow-xl hover:bg-gray-900 active:bg-gray-800 transition-all disabled:opacity-70 disabled:cursor-not-allowed hover:shadow-2xl z-10"
                  style={{
                    left: idx === 1 || idx === 2 ? '65%' : idx === 4 || idx === 5 || idx === 6 ? '60%' : '65%',
                    transform: 'scaleY(1)',
                    transformOrigin: 'top'
                  }}
                >
                  <div className="text-xs font-bold text-white mt-32">
                    {key.note}
                  </div>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#2a2a2a] border border-[#ffd700]/30 rounded-lg p-4">
          <p className="text-[#ffd700] font-bold mb-2">👀 Watch</p>
          <p className="text-[#bbb] text-sm">Keys light up and make sounds</p>
        </div>
        <div className="bg-[#2a2a2a] border border-[#ffd700]/30 rounded-lg p-4">
          <p className="text-[#ffd700] font-bold mb-2">👂 Listen</p>
          <p className="text-[#bbb] text-sm">Remember the sequence</p>
        </div>
        <div className="bg-[#2a2a2a] border border-[#ffd700]/30 rounded-lg p-4">
          <p className="text-[#ffd700] font-bold mb-2">👆 Repeat</p>
          <p className="text-[#bbb] text-sm">Click keys in the same order</p>
        </div>
      </div>
    </div>
  )
}

export default function MusicLessons() {
  const navigate = useNavigate()
  const [selectedLesson, setSelectedLesson] = useState(null)
  const [lessonProgress, setLessonProgress] = useState(0)
  const [quizStarted, setQuizStarted] = useState(false)
  const [quizScore, setQuizScore] = useState(0)
  const [quizAnswered, setQuizAnswered] = useState(0)
  const [showResults, setShowResults] = useState(false)
  const [streak, setStreak] = useState(0)
  const [answered, setAnswered] = useState(new Set())
  const [selectedAnswer, setSelectedAnswer] = useState(null)

  const lessons = [
    {
      id: 1,
      title: "Guitar Basics",
      icon: "🎸",
      description: "Learn the fundamentals of guitar playing",
      content: [
        { 
          title: "Parts of a Guitar", 
          text: "A guitar consists of several key parts:\n\n🎯 BODY: The large hollow chamber that resonates sound. Acoustic guitars have a larger body for louder projection.\n\n🎯 NECK: The long, thin part where you place your fingers. Contains frets (metal strips) that divide it into sections.\n\n🎯 HEADSTOCK: Located at the end of the neck with tuning pegs (also called tuning machines) that tighten or loosen each string.\n\n🎯 FRETS: Thin metal strips on the neck that divide it into half-step intervals. Pressing a string against a fret changes its pitch.\n\n🎯 STRINGS: Typically 6 strings (E, A, D, G, B, E from thickest to thinnest). They vibrate to produce sound.\n\n🎯 PICKGUARD: A protective plate below the sound hole that prevents pick scratches when strumming.\n\n🎯 BRIDGE: Holds the strings in place at the body's bottom and transfers vibrations to the sound board.\n\n💡 TIP: Memorizing these parts helps you understand how to maintain and care for your guitar!",
          details: ["6 main parts to learn", "Each serves a specific purpose", "Understanding them improves maintenance"]
        },
        { 
          title: "How to Hold a Guitar", 
          text: "Proper positioning is CRUCIAL for comfort and preventing injury:\n\n✓ SITTING POSITION:\n- Sit up straight in a sturdy chair\n- Keep your back against the chair for support\n- Position the guitar's curved body on your left thigh\n- The body should lean toward your chest at about 45 degrees\n\n✓ HAND POSITION:\n- Left hand: Thumb wraps behind the neck (not visible from front)\n- Fingers curved like you're holding an invisible ball\n- Keep wrists relatively straight to avoid tension\n\n✓ RIGHT HAND (Strumming):\n- Relax your arm on top of the guitar body\n- Keep your wrist loose but controlled\n- Fingers slightly curved, not rigid\n\n✓ COMMON MISTAKES TO AVOID:\n❌ Slouching - causes back pain and reduces control\n❌ Gripping too tightly - creates tension and fatigue\n❌ Thumb over the neck - limits reach and mobility\n❌ Straight wrists - causes pain and reduces flexibility\n\n⚡ EXERCISES:\n1. Practice maintaining position for 10 minutes daily\n2. Record yourself to check posture\n3. Take breaks before discomfort sets in",
          details: ["Sit up straight", "Curved fingers", "Relaxed wrists", "Practice daily"]
        },
        { 
          title: "Basic Chord Shapes", 
          text: "Start with the 'Big 3' chords - you can play hundreds of songs with just these!\n\n🟢 G MAJOR CHORD:\nFinger positions:\n- 1st finger: 2nd fret, A string (3rd string)\n- 2nd finger: 3rd fret, high e string (6th string)\n- 3rd finger: 3rd fret, B string (2nd string)\n- Strum from the A string down (skip the low E string)\nSound: Bright, major, happy feel\n\n🔴 D MAJOR CHORD:\nFinger positions:\n- 1st finger: 1st fret, G string (3rd string)\n- 2nd finger: 2nd fret, high E string (1st string)\n- 3rd finger: 3rd fret, B string (2nd string)\n- Strum from the D string down (only top 4 strings)\nSound: Crisp, warm, very common\n\n🔵 A MAJOR CHORD:\nFinger positions:\n- 1st finger: 1st fret, B string (2nd string)\n- 2nd finger: 2nd fret, G string (3rd string)\n- 3rd finger: 2nd fret, high E string (1st string)\n- Strum only the top 5 strings (skip low E)\nSound: Bright, versatile, beginner-friendly\n\n💡 PRACTICE TIP: These 3 chords work together! Learn to switch between them smoothly.",
          details: ["3 essential chords", "G, D, A are most common", "Hundreds of songs use these", "Practice switching between them"]
        },
        { 
          title: "Strumming Patterns", 
          text: "Strumming is about rhythm and consistency, not speed!\n\n🎵 BASIC DOWN STROKES:\n- Start with all downstrokes: ↓ ↓ ↓ ↓ (one per beat)\n- Focus on hitting all strings cleanly\n- Keep a steady tempo using a metronome\n- Practice at 60 BPM first, gradually increase\n\n🎵 DOWN-UP PATTERN (Most Common):\n↓ ↑ ↓ ↑ ↓ ↑ ↓ ↑\n- Down on the beat, up off the beat\n- This creates a bouncy, natural rhythm\n- Used in countless songs\n\n🎵 ADVANCED PATTERNS:\n↓ ↓ ↑ ↓ ↑ (Folk/Acoustic style)\n↓ ↑ ↓ ↑ ↓ ↓ ↑ ↓ (Pop/Rock style)\n\n⚡ KEY PRINCIPLES:\n1. CONSISTENCY: Even rhythm matters more than speed\n2. RELAXATION: Keep your wrist loose and bouncy\n3. PRACTICE: Use a metronome to build timing\n4. START SLOW: Master at 80 BPM before speeding up\n\n📊 PRACTICE PROGRESSION:\nWeek 1: All downstrokes at 60 BPM\nWeek 2: Down-up pattern at 60 BPM  \nWeek 3: Down-up pattern at 80 BPM\nWeek 4: Down-up pattern at 100 BPM+",
          details: ["Rhythm over speed", "Use a metronome", "Practice slowly first", "Loose wrist = better sound"]
        }
      ],
      quiz: [
        { q: "🎯 How many strings does a standard guitar have?", opts: ["4 strings", "6 strings", "8 strings", "12 strings"], ans: 1, tip: "The standard tuning is E-A-D-G-B-E" },
        { q: "🎯 What should your thumb do when gripping the neck?", opts: ["Point forward", "Wrap behind the neck", "Stay flat on top", "Stick straight out"], ans: 1, tip: "This gives you better reach and control" },
        { q: "🎯 Which of these is a basic 'Big 3' chord?", opts: ["F Major", "G Major", "B Minor", "Dm7"], ans: 1, tip: "G, D, and A are the essential beginner chords" },
        { q: "🎯 What's more important in strumming?", opts: ["Playing fast", "Consistent rhythm", "Loud volume", "Perfect technique"], ans: 1, tip: "Rhythm foundation comes before speed!" },
        { q: "🎯 What does the pickguard protect?", opts: ["The strings", "The body from scratches", "The neck", "The tuning pegs"], ans: 1, tip: "It's especially useful if you use a pick a lot" }
      ]
    },
    {
      id: 2,
      title: "Piano Fundamentals",
      icon: "🎹",
      description: "Master the basics of piano and keyboard",
      content: [
        { 
          title: "The Piano Keyboard", 
          text: "Understanding the keyboard layout is your foundation:\n\n🎹 STANDARD PIANO:\n- 88 keys total (from A0 to C8)\n- Arranged in repeating octaves (groups of 8 notes)\n- Each octave: C-D-E-F-G-A-B (then repeats)\n\n⚪ WHITE KEYS:\n- 52 white keys on a standard piano\n- These are the 'natural' notes\n- Form the C major scale\n- Easier for beginners to start with\n\n⚫ BLACK KEYS:\n- 36 black keys total\n- Positioned in groups of 2 and 3\n- Create sharps (#) and flats (♭)\n- Located between most white keys\n- Used to create all other scales and chords\n\n🔍 KEY PATTERN:\nLook for the groups of 2 black keys - C is always the white key to the LEFT of the 2 black keys. This helps you navigate!\n\nPattern repeats:\n[C-2 black]-[D-E-3 black]-[F-G-A-B] then repeats\n\n🎵 MIDDLE C:\n- C4 (called \"middle C\") is the center reference\n- Approximately in the middle of 88-key piano\n- Starting point for reading treble and bass clef\n- Reference for understanding ranges\n\n📍 OCTAVE NUMBERS:\n- C1-B1: Very low (bass region)\n- C2-B2: Low-mid region\n- C3-B3: Mid-low region\n- C4-B4: Middle region (Middle C is C4)\n- C5-B5: Mid-high region\n- C6-B6: High region\n- C7-B7: Very high (treble region)\n- C8: Highest note on 88-key piano\n\n💡 MEMORIZATION TIP:\nUse: \"Can Dogs Eat Fresh Green Apple Bits?\" for C-D-E-F-G-A-B\n\nAlso note the 2-3 pattern of black keys - this is ALWAYS the same!",
          details: ["88 keys total", "White keys = naturals", "Black keys = sharps/flats", "Pattern repeats every octave"]
        },
        { 
          title: "Proper Hand Position", 
          text: "Proper positioning prevents injury and maximizes control:\n\n✓ FINGER CURVED POSITION:\n- Imagine holding a small ball in your hand\n- Fingers should be gently curved, NOT flat\n- Fingertips should strike keys, not the pads\n- Thumb plays white keys directly below it\n\n✓ WRIST ALIGNMENT:\n- Keep wrist level (same height as your hand)\n- Slightly elevated (not drooping down)\n- Should form a straight line from forearm to fingers\n- Allows for smooth movement across keys\n\n✓ ARM POSITION:\n- Elbows at roughly 90 degrees\n- Upper arm hangs naturally at your side\n- Shoulders relaxed, not tense\n- Allow wrist to rotate naturally for scale passages\n\n✓ POSTURE:\n- Sit at the center of the keyboard\n- Back straight, not slouched\n- Feet flat on floor or pedals (if available)\n- About 12 inches from keyboard\n\n⚠️ COMMON MISTAKES:\n❌ Flat fingers (like claws) = tension and poor control\n❌ Drooping wrist = reduced flexibility and speed\n❌ Stiff shoulders = fatigue and reduced range\n❌ Sitting too close/far = awkward arm angles\n\n🎯 EXERCISE:\nPractice pressing each finger down individually while keeping others curved and ready. This builds independence!\n\n💪 HAND INDEPENDENCE DRILLS:\n- Play C with thumb while keeping other fingers curved\n- Repeat for each finger independently\n- Builds muscle memory and dexterity\n- Practice 5 minutes daily",
          details: ["Curved fingers like a ball", "Level wrist", "Straight posture", "Fingertips strike keys"]
        },
        { 
          title: "Reading Sheet Music", 
          text: "Music notation is like a language - here's how to read it:\n\n📝 THE STAFF:\n- 5 horizontal lines with 4 spaces between them\n- Each line and space represents a different note\n- Different clefs show different ranges\n\n🎼 TREBLE CLEF (Right Hand):\n- Used for higher notes\n- Curly symbol at the beginning of each line\n- Lines: E-G-B-D-F (Remember: \"Every Good Boy Does Fine\")\n- Spaces: F-A-C-E (Remember: \"FACE\")\n- Starts on middle C and goes up\n\n🎼 BASS CLEF (Left Hand):\n- Used for lower notes\n- Symbol looks like a backwards C with dots\n- Lines: G-B-D-F-A (Remember: \"Good Boys Do Fine Always\")\n- Spaces: A-C-E-G (Remember: \"All Cows Eat Grass\")\n- Starts lower than treble clef\n\n📊 NOTE VALUES:\n- Whole note = 4 beats (○)\n- Half note = 2 beats (◐ with stem)\n- Quarter note = 1 beat (● with stem)\n- Eighth note = 1/2 beat (● with two beams)\n\n⏱️ TIME SIGNATURES:\n- Top number = beats per measure\n- Bottom number = note value per beat\n- 4/4 = 4 quarter notes per measure (most common)\n\n💡 PRACTICE:\nSpend 5 minutes daily just naming notes without playing. Speed comes with repetition!",
          details: ["5-line staff system", "Treble and bass clefs", "Learn mnemonic devices", "Practice note recognition"]
        },
        { 
          title: "Simple Melodies", 
          text: "Starting your playing journey:\n\n🎵 WHY START WITH SIMPLE MELODIES?\n- Builds finger coordination\n- Teaches you to read notes\n- Develops rhythm and timing\n- Confidence builder before complex pieces\n- Foundation for advanced playing\n\n🎯 BEGINNER-FRIENDLY SONGS:\n\n1. \"TWINKLE TWINKLE LITTLE STAR\"\n- Notes: C C G G | A A G | F F E E | D D C\n- All white keys (C major scale)\n- Perfect for beginners\n- Pattern repeats making it easy\n\n2. \"MARY HAD A LITTLE LAMB\"\n- Notes: E D C D E | E E | E F G | C D E | F G\n- Uses 7 consecutive white keys\n- Very recognizable melody\n- Slightly more complex rhythm\n\n3. \"HAPPY BIRTHDAY\"\n- Mix of steps and jumps\n- Familiar tune helps timing\n- Good for developing comfort\n\n4. \"JINGLE BELLS\"\n- Longer melody with pattern\n- Teaches phrasing and breathing\n- Fun and motivating\n\n✓ PRACTICE STEPS:\n1. Read the note names BEFORE playing\n2. Play very slowly (1 note per 2 seconds)\n3. Focus on accuracy, NOT speed\n4. Play hands separately (right hand first)\n5. Once comfortable, speed up gradually\n6. Add left hand (simple bass notes)\n\n⏱️ PRACTICE SCHEDULE:\nWeek 1: One simple melody, very slowly\nWeek 2: Same melody, increase tempo gradually\nWeek 3: Add a second simple melody\nWeek 4: Combine melodies or add basic bass\n\n🎯 COMMON BEGINNER MISTAKES:\n❌ Playing too fast too soon\n❌ Not reading notes first\n❌ Skipping practice days\n❌ Adding hands before ready\n❌ Getting frustrated and quitting\n\n✅ DO THIS INSTEAD:\n✓ Play slowly and accurately\n✓ Read notes on paper first\n✓ Practice consistently (15-30 min daily)\n✓ Master with one hand before adding second\n✓ Celebrate small wins!\n\n💡 MOTIVATIONAL TIP:\nEven simple melodies sound beautiful on piano. You'll be amazed at what you can play in just a few weeks!",
          details: ["Start with all white keys", "Twinkle Twinkle is perfect", "Slow and accurate first", "Build up gradually"]
        }
      ],
      quiz: [
        { q: "🎹 How many keys does a standard piano have?", opts: ["61 keys", "76 keys", "88 keys", "108 keys"], ans: 2, tip: "The 88 keys span from A0 to C8" },
        { q: "🎹 What should your wrist position be while playing?", opts: ["Bent downward", "Level and slightly elevated", "Twisted outward", "Completely relaxed"], ans: 1, tip: "Level wrist prevents strain and injury" },
        { q: "🎹 Which mnemonic helps you remember treble staff lines?", opts: ["All Cows Eat Grass", "Every Good Boy Does Fine", "Good Boys Do Fine Always", "Can Dogs Eat Fresh Green?"], ans: 1, tip: "E-G-B-D-F = Every Good Boy Does Fine" },
        { q: "🎹 What pattern helps you find C on the keyboard?", opts: ["Between 3 black keys", "To the left of 2 black keys", "To the right of 3 black keys", "It's the biggest key"], ans: 1, tip: "C is always LEFT of the 2-black-key group" },
        { q: "🎹 What should you focus on when learning simple melodies?", opts: ["Playing fast", "Accuracy and correctness", "Using both hands", "Showing off"], ans: 1, tip: "Slow and accurate builds better habits!" }
      ]
    },
    {
      id: 3,
      title: "Drum Basics",
      icon: "🥁",
      description: "Learn rhythm and drumming fundamentals",
      content: [
        { 
          title: "Drum Kit Overview", 
          text: "A complete drum kit is a percussion instrument system with distinct components:\n\n🥁 THE 5 MAIN COMPONENTS:\n\n1️⃣ KICK DRUM (Bass Drum):\n- Largest drum, operated by foot pedal\n- Deep, booming sound\n- Foundation of the beat\n- Usually hits on beats 1 and 3\n\n2️⃣ SNARE DRUM:\n- Medium-sized drum with metal wires underneath\n- Crisp, sharp \"crack\" sound\n- Usually hits on beats 2 and 4\n- Most distinctive sound in the kit\n\n3️⃣ TOM-TOMS:\n- Come in 2-3 different sizes (high, mid, low)\n- No snare wires, warmer tone than snare\n- Used for fills and transitions\n- Sound: Mid-range pitch and tone\n\n4️⃣ HI-HATS (High-Hat Cymbals):\n- Two cymbals operated by foot pedal\n- Operated closed (foot down) or open (foot up)\n- Bright, metallic \"tsss\" sound\n- Keeps time and provides texture\n\n5️⃣ CRASH CYMBALS:\n- Large cymbals suspended above kit\n- Loud, dramatic crash sound\n- Used for emphasis and transitions\n- Can take several seconds to fade\n\n🎯 BASIC SETUP:\nKick and hi-hat (feet) | Snare (hands) | Toms and crash (hands/sticks)\n\n💡 PRO TIP:\nMost rock/pop songs follow: Kick + HH on beat, Snare on 2 & 4, creating the classic \"boom-chick\" pattern.",
          details: ["5 main drum components", "Each has unique sound", "Kick and snare are foundation", "Hi-hats keep time"]
        },
        { 
          title: "Stick Grip and Posture", 
          text: "Proper technique prevents injury and enables control:\n\n🤲 TWO GRIP STYLES:\n\n1. MATCHED GRIP (Most Common):\n- Both hands hold sticks the same way\n- Best for learning and general playing\n- Easy transition between different styles\n- Steps:\n  • Hold stick loosely (not death grip!)\n  • Thumb and index finger support it\n  • Other fingers curved underneath for control\n  • Fulcrum point: between thumb and index\n  • Let stick bounce naturally off drums\n\n2. TRADITIONAL GRIP (Jazz/Orchestral):\n- Left hand rotated inward at different angle\n- Right hand standard position\n- Used mainly in jazz and concert percussion\n- More advanced - start with matched grip first!\n\n✓ POSTURE AT THE KIT:\n- Sit up straight in drum throne\n- Throne height: knees slightly lower than hips\n- Kick pedal positioned comfortably (slight bend)\n- Relax shoulders - tension kills speed\n- Elbows at 90-degree angle\n- Drum and cymbal angles face you naturally\n\n⚠️ GRIP MISTAKES:\n❌ Squeezing too hard = fatigue and loss of control\n❌ Flat grip = no bounce, exhausting\n❌ Wrist too stiff = reduced speed and dynamics\n❌ Elbows flying out = poor stability\n\n💪 EXERCISES:\n- Practice stick control on practice pad before drums\n- Focus on BOUNCE - let stick do the work\n- Build speed gradually, never force it\n- Daily 10-minute warm-ups prevent injury",
          details: ["Matched grip recommended", "Relaxed grip for bounce", "Proper posture prevents injury", "Wrist stays flexible"]
        },
        { 
          title: "Basic Beats and Rhythm", 
          text: "The fundamental pattern every drummer learns:\n\n📊 UNDERSTANDING 4/4 TIME:\n- 4 beats per measure\n- Quarter note gets one beat\n- Most common time signature in pop/rock\n- Count: 1-2-3-4, 1-2-3-4...\n\n🎵 THE CLASSIC ROCK BEAT:\nBeat 1: KICK (bass drum)\nBeat 2: SNARE (with kick)\nBeat 3: KICK\nBeat 4: SNARE\nHi-hat throughout: Continuous 8th notes (or 16ths)\n\nVisually:\n  Beat: 1  &  2  &  3  &  4  &\n  Kick: X     X     X\n  Snare:   X     X     X\n  HH-Hat:  X  X  X  X  X  X  X  X\n\n⏱️ THE \"BOOM-CHICK\" PATTERN:\n- \"BOOM\" = Kick drum (deep, foundational)\n- \"CHICK\" = Snare drum (snappy, on-beat)\n- This pattern is in 80% of pop songs!\n\n🎯 PRACTICE PROGRESSION:\nWeek 1: Just kick and snare - no hi-hat (focus on timing)\nWeek 2: Add simple hi-hat pattern\nWeek 3: Increase hi-hat complexity (16th notes)\nWeek 4: Combine with kick and snare variations\n\n🎧 TEMPO GUIDE:\nStart at 60 BPM and gradually increase\n80 BPM = Slow ballad\n100-110 BPM = Pop/Medium tempo\n140+ BPM = Rock/Fast\n\n💡 PRO TIP:\nUse a metronome! Your timing accuracy is more important than speed. Sloppy fast beats sound worse than clean slow beats.",
          details: ["4/4 time most common", "Kick-snare pattern foundation", "Hi-hat provides texture", "Metronome practice essential"]
        },
        { 
          title: "Coordination Exercises", 
          text: "The key challenge - different limbs doing different things:\n\n🎯 WHY COORDINATION MATTERS:\n- Limbs must work independently (hands vs feet)\n- Each plays different rhythms simultaneously\n- Takes time to build muscle memory\n- Like patting head while rubbing stomach, but harder!\n\n⚡ BEGINNER COORDINATION EXERCISE:\nSTEP 1: Start with kick drum only\n- Practice 4 kicks per measure: 1-2-3-4\n- No other limbs\n- Get comfortable at 80 BPM\n\nSTEP 2: Add snare\n- Kick on 1 and 3\n- Snare on 2 and 4\n- Both hands and feet moving\n- Practice until smooth\n\nSTEP 3: Add hi-hat (beginner version)\n- Hi-hat on every beat: 1-2-3-4\n- Kick on 1 and 3\n- Snare on 2 and 4\n- All three limbs active!\n\nSTEP 4: Hi-hat with 8th notes\n- Hi-hat now hits twice per beat: 1-&-2-&-3-&-4-&\n- Kick and snare pattern stays same\n- More complex independence needed\n\n📈 PROGRESSION TIMELINE:\nWeek 1-2: Just kick (build foot independence)\nWeek 3: Add snare (hands independent from feet)\nWeek 4-5: Add simple hi-hat\nWeek 6+: Hi-hat 8th notes (full coordination)\n\n💪 DAILY PRACTICE:\n5 min: Kick drum only\n5 min: Kick + Snare\n5 min: Simple beat with hi-hat\n5 min: More complex patterns\n\n🎯 MENTAL TECHNIQUE:\n- Don't think of individual limbs\n- \"Hear\" the pattern in your head first\n- Feel it like a dancer feels rhythm\n- Repetition = automatic muscle memory\n\n⚠️ COMMON MISTAKES:\n❌ Trying complex patterns too soon = frustration\n❌ No metronome = sloppy timing\n❌ Stiff limbs = limited speed\n✅ Build progressively (1 limb at a time)\n✅ Always use metronome\n✅ Stay relaxed and patient!",
          details: ["Build one limb at a time", "Kick-snare-hihat progression", "Metronome essential", "Patience and consistency key"]
        }
      ],
      quiz: [
        { q: "🥁 What is the main component that creates the bass sound?", opts: ["Snare drum", "Bass/Kick drum", "Cymbals", "Tom-tom"], ans: 1, tip: "The kick drum is operated by foot pedal" },
        { q: "🥁 What time signature is most common in popular music?", opts: ["3/4 time", "2/4 time", "4/4 time", "5/4 time"], ans: 2, tip: "Most pop, rock, and hip-hop use 4/4" },
        { q: "🥁 What is the 'boom-chick' pattern in drumming?", opts: ["A cymbal brand", "Kick and snare on alternating beats", "A fast fill", "A song title"], ans: 1, tip: "BOOM (kick) - CHICK (snare) - most common pattern" },
        { q: "🥁 Why is coordination important for drummers?", opts: ["Looking cool", "Each limb plays independently", "Making noise", "Showing off"], ans: 1, tip: "All 4 limbs must do different things simultaneously" },
        { q: "🥁 When learning coordination, what should you do first?", opts: ["Play fast patterns", "Learn kick and snare separately", "Use all limbs at once", "Just wing it"], ans: 1, tip: "Build progressively - one limb at a time!" }
      ]
    },
    {
      id: 4,
      title: "Vocal Training 101",
      icon: "🎤",
      description: "Develop your singing voice and technique",
      content: [
        { 
          title: "Proper Breathing Techniques", 
          text: "Breath control is the foundation of all good singing:\n\n🫁 DIAPHRAGMATIC BREATHING:\nWhy it matters:\n- Provides consistent air pressure for power and control\n- Reduces strain on vocal cords\n- Enables longer phrase lengths\n- Essential for any singing style\n\nHow your diaphragm works:\n- Large muscle below your lungs\n- Contracts down when you breathe in\n- This creates space for lungs to expand\n- Pushes air out when you sing (not throat muscles!)\n\n✓ CORRECT TECHNIQUE:\n1. Stand up straight or sit with good posture\n2. Place hand on belly, just above hip bones\n3. Breathe in through nose slowly (4 count)\n4. Feel your belly expand OUTWARD (not up)\n5. Sing phrase on one steady stream of air\n6. Feel your belly pull in as air exits\n\n⚠️ WRONG WAY (Chest Breathing):\n❌ Shoulders rise when breathing in\n❌ Breath feels shallow and short\n❌ Neck and throat get tense\n❌ Voice sounds strained or breathy\n❌ Can't hold long phrases\n\n✅ RIGHT WAY (Belly Breathing):\n✓ Shoulders stay relaxed and down\n✓ Belly expands outward\n✓ Breath feels deep and full\n✓ Throat stays open and relaxed\n✓ Can sustain longer phrases easily\n\n🎯 DAILY EXERCISE (5 minutes):\n- Lie on back, hand on belly\n- Breathe in through nose (belly expands)\n- Say \"Hhhh\" on exhale (long stream)\n- Repeat 10 times\n- Builds muscle memory for proper technique\n\n💡 PRO TIP:\nWhen you laugh naturally, you breathe from your diaphragm! Singers just learn to control it intentionally.",
          details: ["Diaphragm is key", "Not chest or throat", "Belly expands outward", "Provides consistent power"]
        },
        { 
          title: "Warming Up Your Voice", 
          text: "Never sing full power without warming up!\n\n🎵 WHY WARM UP IS CRITICAL:\n- Voice is a muscle that needs preparation\n- Cold vocal cords are tight and injury-prone\n- Warm-up increases blood flow to vocal tissues\n- Improves tone quality and range\n- Prevents hoarseness and damage\n- Mentally prepares you for performance\n\n⏱️ WARM-UP ROUTINE (10-15 minutes):\n\n1️⃣ LIP TRILLS (\"Lip bubbles\")\nHow: Close lips and blow air, making a \"brrrr\" sound\nWhy: Loosens facial muscles and vocal cords\nReps: 3 times, each for 5 seconds\nVariation: Do it on different pitches (low to high)\n\n2️⃣ SIRENS (\"Engine sound\")\nHow: Say \"nnngggg\" while sliding pitch from low to high like a siren\nWhy: Stretches vocal cords safely\nReps: 5 times up and down\nLength: Hold each siren for 5-8 seconds\n\n3️⃣ MAJOR SCALES\nHow: Sing \"Ah\" on major scale: Do-Re-Mi-Fa-Sol-La-Ti-Do\nWhy: Coordinates breathing with pitching\nReps: 5 times on different starting notes\nTempo: Slow and controlled, not fast\n\n4️⃣ OCTAVE JUMPS\nHow: Jump between low and high notes on \"Ah\"\nWhy: Builds coordination and range awareness\nReps: 10 times at different intervals\n\n5️⃣ GENTLE SINGING\nHow: Sing familiar simple songs at medium volume\nWhy: Final preparation before full performance\nSongs: \"Happy Birthday,\" \"Twinkle Twinkle Little Star\"\n\n🎯 WARM-UP PROGRESSION:\nMinutes 0-3: Lip trills and sirens (only)\nMinutes 3-8: Add scales and octave jumps\nMinutes 8-15: Add gentle song singing\nMinutes 15+: Ready for full performance!\n\n❌ DO NOT:\n- Sing loudly without warming up first\n- Skip warm-ups to save time\n- Do intense exercises on cold voice\n- Sing through pain\n\n✅ DO:\n- Warm up every time you sing\n- Stay hydrated before and during\n- Take breaks if voice gets tired\n- Keep warm-ups gentle and relaxed",
          details: ["15-min warm-up routine", "Lip trills and sirens first", "Scales and gentle singing", "Prevents vocal damage"]
        },
        { 
          title: "Finding Your Range", 
          text: "Understanding your vocal range helps you choose appropriate songs:\n\n🎤 WHAT IS VOCAL RANGE?\n- The span from your lowest to highest note\n- Unique to each voice, like fingerprints\n- Determines which songs suit you best\n- Can be expanded with training (gradually)\n\n🎵 MAIN VOCAL CATEGORIES:\n\nFOR FEMALES:\n✓ SOPRANO: Highest female voice (like Ariana Grande, Mariah Carey)\n  Range: Typically C4 to C6\n  Sound: Bright, soaring, powerful in high notes\n  Songs: Disney characters, classical operatic roles\n\n✓ MEZZO-SOPRANO: Middle female voice (like Beyoncé, Adele)\n  Range: Typically A3 to A5\n  Sound: Rich, warm, versatile, best in middle/lower registers\n  Songs: Most popular music, R&B, soul\n\n✓ ALTO: Lower female voice (like Cher, Amy Winehouse)\n  Range: Typically F3 to F5\n  Sound: Deep, rich, powerful lower notes\n  Songs: Blues, soul, rock, jazz\n\nFOR MALES:\n✓ TENOR: Higher male voice (like Justin Timberlake, Freddie Mercury)\n  Range: Typically C3 to C5\n  Sound: Bright, penetrating, agile\n  Songs: Leading roles, rock vocals\n\n✓ BARITONE: Middle male voice (like Bruno Mars, Frank Sinatra)\n  Range: Typically A2 to A4\n  Sound: Warm, resonant, most common\n  Songs: Most popular male singers are baritones\n\n✓ BASS: Lower male voice (like Barry White, Johnny Cash)\n  Range: Typically E2 to E4\n  Sound: Deep, booming, authoritative\n  Songs: Classical bass roles, deep ballads\n\n🎯 HOW TO FIND YOUR RANGE:\n1. Sing a comfortable note (should feel easy)\n2. Go DOWN until you reach your lowest note\n3. Go UP from comfortable note to highest\n4. Note both extremes\n5. Your range = lowest to highest\n\n💡 FINDING YOUR \"SWEET SPOT\":\n- This is where your voice sounds best\n- Usually middle of your total range\n- Choose songs that stay in this zone\n- Easier to sing, sounds more natural\n\n⚠️ IMPORTANT:\n- Range can expand with training (but slowly)\n- Forcing high/low notes = vocal damage\n- Stay comfortable within your current range\n- Different songs suit different voices",
          details: ["6 main vocal types", "Soprano/Alto/Mezzo-S (female)", "Tenor/Baritone/Bass (male)", "Unique to each person"]
        },
        { 
          title: "Pitch Control and Accuracy", 
          text: "The ability to hit the right note every time:\n\n🎯 WHAT IS PITCH?\n- The highness or lowness of a sound\n- Measured in frequency (Hz)\n- A4 (concert A) = 440 Hz (standard tuning)\n- Each note has a specific pitch\n\n✓ DEVELOPING PITCH ACCURACY:\n\n1. REFERENCE TONE TRAINING:\n- Sing a note you hear from a piano or app\n- Listen carefully to the exact pitch\n- Try to match it with your voice\n- Hold it for 5 seconds\n- Repeat daily, 10 minutes\n- Start with familiar songs first\n\n2. INTERVAL RECOGNITION:\n- Learn \"shapes\" of intervals between notes\n- \"Happy Birthday\" starts with a skip up (interval)\n- \"Twinkle Twinkle\" is all steps (intervals)\n- Recognizing patterns helps accuracy\n\n3. SOLFÈGE METHOD:\nDo - Do (same note, unison)\nDo-Re (step up)\nDo-Mi (skip up)\nPractice: Sing these on different starting notes\n\n🎧 TOOLS FOR PRACTICE:\n✓ Piano or keyboard (most reliable)\n✓ Tuner apps (show if you're sharp/flat)\n✓ Sheet music (provides visual reference)\n✓ Recordings (sing along and match)\n✓ Teacher or friend (provide feedback)\n\n📊 SHARP VS FLAT:\n- SHARP: Singing too HIGH (above target pitch)\n- FLAT: Singing too LOW (below target pitch)\n- Tuner apps show red if flat, green if perfect\n\n⚡ DAILY PRACTICE ROUTINE:\nWeek 1: Match 5 single notes from piano\nWeek 2: Match simple melodies (nursery rhymes)\nWeek 3: Match more complex songs\nWeek 4: Sight-read new melodies\n\n💡 TIPS FOR IMPROVEMENT:\n✓ Listen intently - 80% of pitch training\n✓ Sing slowly - speed hides mistakes\n✓ Use a tuner app for immediate feedback\n✓ Record yourself to hear actual mistakes\n✓ Practice consistently (daily > occasional)\n✓ Be patient - this takes months to master\n\n⚠️ COMMON MISTAKES:\n❌ Singing before listening carefully\n❌ Going too fast and missing pitches\n❌ Not using a tuner or reference\n❌ Practicing only when it's easy\n✅ Listen first, then sing\n✅ Go slowly at first\n✅ Use tools for feedback\n✅ Practice the hard songs more!",
          details: ["Listen before singing", "Use reference pitch", "Match tone carefully", "Practice daily with app"]
        }
      ],
      quiz: [
        { q: "🎤 Where should you breathe from when singing?", opts: ["Chest/shoulders", "Throat muscles", "Diaphragm/belly", "Nose"], ans: 2, tip: "Belly breathing gives you consistent power and control" },
        { q: "🎤 Why is warming up important before singing?", opts: ["Tradition", "Prevents strain and improves performance", "Makes you famous", "Looks professional"], ans: 1, tip: "Cold vocal cords are tight and injury-prone!" },
        { q: "🎤 What are the three female vocal types?", opts: ["Alto/Mezzo/Tenor", "Soprano/Alto/Mezzo", "Bass/Baritone/Soprano", "Treble/Middle/Deep"], ans: 1, tip: "From highest to lowest: Soprano, Mezzo-Soprano, Alto" },
        { q: "🎤 What does it mean if you're singing 'sharp'?", opts: ["You have sharp technique", "Singing too HIGH", "Singing too LOW", "Singing off-key"], ans: 1, tip: "Sharp = above the target pitch" },
        { q: "🎤 What's the best way to improve pitch accuracy?", opts: ["Sing louder", "Practice matching reference tones daily", "Don't practice", "Sing randomly"], ans: 1, tip: "Daily practice with a tuner app or piano is key!" }
      ]
    },
    {
      id: 5,
      title: "Music Theory Essentials",
      icon: "🎼",
      description: "Understand the fundamentals of music theory",
      content: [
        { 
          title: "The Musical Alphabet", 
          text: "Music uses only 7 letters, repeating infinitely:\n\n🎵 THE 7 NOTES (in order):\nA - B - C - D - E - F - G\n(Then repeat: A - B - C - D - E - F - G...)\n\nWhy only 7?\n- Historical reason based on ancient Greek music\n- Creates musical \"octaves\" (8-note repeating pattern)\n- Most efficient system for Western music\n\n🔄 THE OCTAVE CONCEPT:\nWhen you go from C to the next C, that's an OCTAVE\n- Same letter = same note name\n- Different pitch (one is double the frequency)\n- Example: C3, C4, C5 are all \"C\" but at different heights\n- Each octave follows the same pattern\n\n📊 HOW OCTAVES WORK ON PIANO:\nC1 - C2 - C3 - C4 - C5 - C6 - C7 - C8\nLower pitch      Middle C (C4)      Higher pitch\n(Bass range)     (Reference point)   (Treble range)\n\n🎯 NATURAL VS ACCIDENTAL NOTES:\nNatural notes: A B C D E F G (white keys on piano)\nAccidentals:\n- SHARP (#): Raise a note by 1 half-step (black key up)\n- FLAT (♭): Lower a note by 1 half-step (black key down)\nExample: C# is higher than C, D♭ is lower than D\n\n📝 HOW INTERVALS WORK:\nDistance between notes is measured in semitones:\n- C to C# = 1 semitone (half-step)\n- C to D = 2 semitones (whole step)\n- C to E = 4 semitones (major third)\n- C to G = 7 semitones (perfect fifth)\n\n🎓 CHROMATIC SCALE (All 12 notes):\nC - C# - D - D# - E - F - F# - G - G# - A - A# - B (repeat)\nIncludes all natural notes + all sharps/flats\n\n💡 WHY THIS MATTERS:\n- Every song uses these 7 notes (plus variations)\n- Understanding letter names helps you read music\n- Pattern recognition makes learning easier\n- Foundation for composing and improvising",
          details: ["7 natural notes", "Repeating pattern", "A-B-C-D-E-F-G", "12 semitones total"]
        },
        { 
          title: "Major and Minor Scales", 
          text: "The emotional foundation of all Western music:\n\n🎵 WHAT IS A SCALE?\n- A series of notes in ascending/descending order\n- Creates a \"tonal center\" (home note)\n- Most scales have 7 notes (octatonic)\n- Different scales create different emotional qualities\n\n😊 MAJOR SCALES (Happy/Bright/Resolved Sound):\nFormula: Whole-Whole-Half-Whole-Whole-Whole-Half\n(In semitones: 2-2-1-2-2-2-1)\n\nC Major Example:\nC (whole step) D (whole) E (half) F (whole) G (whole) A (whole) B (half) C\n\nCharacteristics:\n✓ Sounds positive, energetic, resolved\n✓ Often used in happy songs, victories, celebrations\n✓ Most familiar scale to beginners\n✓ Used in almost all pop music\n\nFamous Major Scale Songs:\n- \"Happy\" by Pharrell Williams\n- \"Don't Stop Me Now\" by Queen\n- \"Walking on Sunshine\" by Katrina & The Waves\n\n😔 MINOR SCALES (Sad/Mysterious/Emotional Sound):\nNatural Minor Formula: Whole-Half-Whole-Whole-Half-Whole-Whole\n(In semitones: 2-1-2-2-1-2-2)\n\nA Minor Example:\nA (whole step) B (half) C (whole) D (whole) E (half) F (whole) G (whole) A\n\nCharacteristics:\n✓ Sounds sad, mysterious, introspective\n✓ Often used in emotional ballads, dark themes\n✓ Same notes as relative major (A minor = C major notes!)\n✓ Creates tension and depth\n\nFamous Minor Scale Songs:\n- \"Stairway to Heaven\" by Led Zeppelin (minor section)\n- \"All the Small Things\" by Blink-182\n- \"Paint It Black\" by The Rolling Stones\n\n🔄 RELATIVE MAJOR/MINOR:\nEvery minor scale shares notes with a major scale\n- A minor uses same notes as C major\n- E minor uses same notes as G major\n- D minor uses same notes as F major\nJust start on different notes!\n\n⚡ COMPARISON:\nMAJOR:\n✓ Bright, happy, resolved\n✓ Sounds conclusive\n✓ Used for celebrations\n✗ Can sound simplistic if overused\n\nMINOR:\n✓ Deep, emotional, mysterious\n✓ Sounds searching or yearning\n✓ Used for depth and emotion\n✗ Can sound sad if overused\n\n💡 PRO TIP:\nListen to the same melody in major and minor - you'll hear the emotional difference immediately!",
          details: ["Major = happy/bright", "Minor = sad/mysterious", "7-note patterns", "Different emotional colors"]
        },
        { 
          title: "Intervals and Chords", 
          text: "The building blocks of harmony:\n\n📏 WHAT IS AN INTERVAL?\nThe distance (in pitch) between two notes\n- Measured in semitones or scale degrees\n- Every interval has a unique sound/quality\n- Intervals create harmony and interest\n\n🎵 MAIN INTERVALS:\n\nUNISON (0 semitones): Same pitch\n- Sound: Blended, unified\n- Example: Multiple people singing same note\n\nMINOR SECOND (1 semitone): Very close, slightly dissonant\n- Sound: Tense, unsettling\n- Example: C to C#\n\nMAJOR SECOND (2 semitones): Pleasant, step-like\n- Sound: Warm, step-wise\n- Example: \"Happy Birthday\" opening (C up to D)\n\nMAJOR THIRD (4 semitones): Bright, major chord foundation\n- Sound: Happy, open\n- Example: C to E\n\nPERFECT FIFTH (7 semitones): Powerful, stable\n- Sound: Strong, foundational\n- Example: C to G (used in many power chords)\n\nOCTAVE (12 semitones): Same note, higher pitch\n- Sound: Unified, complete\n- Example: C to next C\n\n🎼 WHAT IS A CHORD?\n- 3 or more notes played together\n- Creates harmony instead of single melody\n- Every chord has a unique character\n- Foundation of all songwriting\n\n🎵 MAIN CHORD TYPES:\n\nMAJOR CHORD (3 notes: Root, Major 3rd, Perfect 5th)\n- Sound: Happy, bright, stable\n- Example: C Major = C + E + G\n- Used in: Happy songs, resolutions\n- \"I've got the power\" energy\n\nMINOR CHORD (3 notes: Root, Minor 3rd, Perfect 5th)\n- Sound: Sad, introspective, softer\n- Example: A Minor = A + C + E\n- Used in: Emotional songs, verses\n- \"I'm feeling blue\" energy\n\nDOMINANT 7TH CHORD (4 notes: Major chord + Minor 7th)\n- Sound: Tense, demanding resolution\n- Example: G7 = G + B + D + F\n- Used in: Blues, creates tension\n- \"Waiting for something\" energy\n\n📊 CHORD PROGRESSIONS (Common Sequences):\nI-IV-V-I (The most common)\n- Sound: Natural, satisfying, complete\n- Example: C - F - G - C\n- Used in: Most pop songs, simple songs\n\nI-V-vi-IV (Modern pop progression)\n- Sound: Emotional, reflective, powerful\n- Example: C - G - Am - F\n- Used in: Modern pop, emotional songs\n\n💡 WHY CHORDS MATTER:\n✓ Create fullness (vs solo melody)\n✓ Express emotion (major = happy, minor = sad)\n✓ Provide structure and movement\n✓ Foundation of songwriting\n✓ Used in every genre of music\n\n🎯 CHORD BUILDING EXERCISE:\n1. Start with root note (example: C)\n2. Add major 3rd (example: E = +4 semitones)\n3. Add perfect 5th (example: G = +7 semitones total)\n4. Result: C Major chord!\nRepeat with A, D, G, E... build dozens of chords!",
          details: ["Intervals = distance between notes", "Chords = 3+ notes together", "Major/minor/dominant types", "Create harmony and emotion"]
        },
        { 
          title: "Time Signatures and Tempo", 
          text: "The rhythm framework of all music:\n\n⏱️ TIME SIGNATURE (Meter)\nWhy it matters:\n- Tells you how many beats in a measure\n- Shows what note value gets the beat\n- Creates rhythmic feel and groove\n- Affects how song feels energetically\n\n📊 HOW TIME SIGNATURES WORK:\nTop number: Beats per measure\nBottom number: Note value that gets one beat\n\nExample: 4/4 time\n- 4 beats per measure\n- Quarter note (1/4 note) gets one beat\n- Count: 1-2-3-4 (repeat)\n\n🎵 COMMON TIME SIGNATURES:\n\n4/4 TIME (\"Common Time\" - Most Used):\n- 4 beats per measure\n- Quarter note = one beat\n- Feel: Steady, marching, normal\n- Used in: Pop, rock, hip-hop, 90% of music\n- Count: 1-2-3-4 | 1-2-3-4\n\n3/4 TIME (\"Waltz Time\"):\n- 3 beats per measure\n- Quarter note = one beat\n- Feel: Triplet, lilting, ballroom dancing\n- Used in: Waltzes, country, some pop ballads\n- Count: 1-2-3 | 1-2-3\n\n2/4 TIME (\"Cut Time\"):\n- 2 beats per measure\n- Quarter note = one beat\n- Feel: Quick, bouncy, energetic\n- Used in: Marches, some folk music\n- Count: 1-2 | 1-2\n\n6/8 TIME (\"Compound Time\"):\n- 6 beats per measure\n- Eighth note = one beat\n- Feel: Flowing, lilting, jazz-like\n- Used in: Jazz, some rock, blues\n- Count: 1-2-3-4-5-6 (often feels like 1-2 with triplets)\n\n⚡ TEMPO (Speed)\nHow fast the song plays\n\nMeasured in BPM (Beats Per Minute)\n- One beat = one quarter note (in 4/4)\n- 60 BPM = 60 beats in one minute (slow)\n- 120 BPM = 120 beats in one minute (medium)\n- 180 BPM = 180 beats in one minute (fast)\n\n📊 TEMPO CATEGORIES:\nGRAVE (Very Slow): 40-60 BPM\n- Feeling: Solemn, funeral, deep\n- Example: Funeral march\n\nADAGIO (Slow): 60-80 BPM\n- Feeling: Peaceful, contemplative\n- Example: Classical ballad\n\nANDANTE (Walking): 80-110 BPM\n- Feeling: Moderate, peaceful walking\n- Example: Slow pop ballad\n\nMODERATO (Moderate): 110-130 BPM\n- Feeling: Normal, conversational\n- Example: Most pop songs\n\nALLEGRO (Fast): 130-160 BPM\n- Feeling: Happy, energetic, uplifting\n- Example: Uptempo pop, rock\n\nPRESTISSIMO (Very Fast): 160+ BPM\n- Feeling: Intense, exciting, driving\n- Example: Speed metal, fast EDM\n\n🎯 TIME SIGNATURE + TEMPO COMBINATIONS:\n\n4/4 at 120 BPM:\n- Most common pop song\n- Feels normal, accessible\n- \"Sweet spot\" for listeners\n\n4/4 at 90 BPM:\n- Slower, more emotional\n- Good for ballads and love songs\n\n3/4 at 120 BPM:\n- Waltz feel, lilting\n- Less common in modern music\n\n6/8 at 100 BPM:\n- Jazz feel, flowing\n- Used in R&B, blues\n\n💡 WHY THIS MATTERS:\nTime signature + tempo = the \"pocket\" of the song\n- Makes song feel right for its purpose\n- Changes emotional impact\n- Foundation for all musicians to synchronize\n- Different combos create totally different feels!",
          details: ["4/4 is most common", "Time signature = beat count", "Tempo = speed (BPM)", "Together create the groove"]
        }
      ],
      quiz: [
        { q: "🎼 How many notes are in the musical alphabet?", opts: ["5 notes", "7 notes", "12 notes", "8 notes"], ans: 1, tip: "A-B-C-D-E-F-G (then repeat)" },
        { q: "🎼 What does a major scale typically sound like?", opts: ["Sad", "Happy and bright", "Angry", "Confused"], ans: 1, tip: "Major = positive, resolved feeling" },
        { q: "🎼 What is an interval in music?", opts: ["A song section", "Distance between two pitches", "A chord quality", "A time measurement"], ans: 1, tip: "C to E is a major third interval" },
        { q: "🎼 What time signature is most common?", opts: ["2/4", "3/4", "4/4", "6/8"], ans: 2, tip: "4/4 is used in about 90% of pop songs" },
        { q: "🎼 What is a chord?", opts: ["One note", "Two notes", "Three or more notes together", "A guitar brand"], ans: 2, tip: "C Major = C + E + G (three notes)" }
      ]
    },
    {
      id: 6,
      title: "Music Production Basics",
      icon: "🎧",
      description: "Introduction to beat-making and production",
      content: [
        { 
          title: "DAW Overview", 
          text: "A DAW (Digital Audio Workstation) is your complete music production studio in software:\n\n🖥️ WHAT IS A DAW?\n- Software for recording, editing, and producing music\n- Like a digital recording studio\n- Contains all tools needed for complete music creation\n- Used by everyone from beginners to Grammy-winning producers\n\n🎛️ MAIN FEATURES OF ALL DAWS:\n1. TRACK VIEW: Multiple instruments stacked vertically\n2. ARRANGEMENT: Timeline (bars/beats) horizontally\n3. MIXER: Volume faders, effects, routing\n4. INSTRUMENTS: Synthesizers, drum machines, samplers\n5. RECORDING: Capture live instruments/vocals\n6. EFFECTS: Add reverb, delay, compression, etc.\n7. AUTOMATION: Change parameters over time\n\n🏆 POPULAR DAWS (Different Use Cases):\n\n🥇 ABLETON LIVE (\"The DJ's Choice\")\n- Best for: Electronic music, beat-making, live performance\n- Strength: Intuitive, great for rapid prototyping\n- Price: $99-749 (depending on version)\n- Used by: Porter Robinson, deadmau5, Grimes\n\n🥈 LOGIC PRO (\"The Professional Standard\")\n- Best for: Recording, mixing, songwriting\n- Strength: Powerful, professional workflows, included sounds\n- Price: $199 (one-time purchase, includes 1000+ sounds)\n- Used by: Travis Scott, The Weeknd, Billie Eilish\n- Only on: Mac computers\n\n🥉 PRO TOOLS (\"The Industry Standard\")\n- Best for: Mixing, audio editing, recording studios\n- Strength: Professional, used in every major studio\n- Price: $20-99/month (subscription)\n- Used by: Every major recording studio\n- Most flexible: Works on Mac & Windows\n\n🎹 FL STUDIO (\"The Beginner's Best Friend\")\n- Best for: Hip-hop, EDM, beat-making\n- Strength: Very visual, easy to learn, affordable\n- Price: $99-499 (one-time purchase)\n- Used by: Metro Boomin, Mike Will Made It, Marshmello\n\n🎧 REAPER (\"The Hidden Gem\")\n- Best for: Any genre, very customizable\n- Strength: Powerful, cheap, highly customizable\n- Price: $60 (very affordable for professional)\n- Used by: Professional studios, indie producers\n\n💡 BEGINNER RECOMMENDATION:\nStart with Ableton Live Lite (free) or FL Studio Trial to learn basics before investing!\n\n🎯 YOUR FIRST STEPS IN A DAW:\n1. Create a new project\n2. Set tempo (BPM) and time signature\n3. Add a drum track (usually first)\n4. Add bass track\n5. Add melody/lead instrument\n6. Layer effects and adjust volumes\n7. Export final mix\n\n⚡ KEY WORKFLOW:\nARRANGE → RECORD/COMPOSE → MIX → MASTER → EXPORT",
          details: ["Recording and editing software", "6 major DAWs available", "Ableton best for beginners", "Can learn free version first"]
        },
        { 
          title: "Understanding BPM and Tempo", 
          text: "The foundation of music production timing:\n\n⏱️ WHAT IS BPM?\nBPM = Beats Per Minute\n- Tells you how many beats happen in 60 seconds\n- Sets the speed/pace of your entire song\n- Most important first setting when creating\n\n📊 BPM EXAMPLES:\n- 60 BPM = 1 beat per second (very slow, like heartbeat)\n- 90 BPM = 1.5 beats per second (slow, moderate)\n- 120 BPM = 2 beats per second (standard, most common)\n- 140 BPM = 2.3 beats per second (fast, energetic)\n- 180+ BPM = Very fast (house music, drum & bass)\n\n🎵 BPM BY GENRE:\n\nBALLAD/ACOUSTIC:\n- 60-80 BPM\n- Feeling: Slow, emotional, intimate\n- Example: \"Someone Like You\" by Adele (~68 BPM)\n\nHIP-HOP:\n- 85-115 BPM\n- Feeling: Laid-back, groovy, head-nodding\n- Example: \"Lil Pump\" style (~90-100 BPM)\n\nPOP:\n- 100-130 BPM\n- Feeling: Upbeat, catchy, radio-friendly\n- Example: \"Levitating\" by Dua Lipa (~103 BPM)\n\nDISCO/FUNK:\n- 120-130 BPM\n- Feeling: Dance-inducing, groovy, feel-good\n- Example: \"Stayin' Alive\" by Bee Gees (~103 BPM)\n\nEDM/HOUSE:\n- 120-140 BPM\n- Feeling: Energetic, dance-focused, club vibe\n- Example: House track (~128 BPM is standard)\n\nTECHNO:\n- 120-150 BPM\n- Feeling: Hypnotic, industrial, dark\n- Example: Typical techno (~130-140 BPM)\n\nDRUM & BASS:\n- 160-180 BPM\n- Feeling: Intense, high-energy, overwhelming\n- Example: Liquid drum & bass (~174 BPM)\n\n🎯 DETERMINING BPM FOR YOUR SONG:\n1. Decide mood/genre\n2. Look up typical BPM for that genre\n3. Start there as reference\n4. Adjust up/down based on feel\n5. Remember: Same BPM can feel different with different instruments!\n\n💡 HOW BPM AFFECTS SONG:\nSame melody at 90 BPM sounds slow/sad\nSame melody at 120 BPM sounds upbeat/happy\nSame melody at 150 BPM sounds urgent/intense\n\n⚡ MUSICAL NOTE:\nBPM directly links to:\n- Note durations (quarter note = 1 beat)\n- Timing of drum patterns\n- Groove and feel\n- Physical movement (dancing/head-bobbing)\n\n🎧 PRODUCTION TIP:\nMost producers start at 120 BPM (universal standard)\nThen adjust to fit the vibe they're going for\nEasy to change in DAW - experiment freely!",
          details: ["Beats Per Minute = speed", "120 BPM is standard/common", "60-80 = slow ballad", "140+ = uptempo/dance"]
        },
        { 
          title: "Basic Sound Design", 
          text: "Creating and shaping unique sounds:\n\n🎛️ WHAT IS SOUND DESIGN?\n- Creating new sounds using synthesis\n- Manipulating existing sounds\n- Layering sounds for texture\n- The creative core of electronic music production\n\n🎹 SYNTHESIZER BASICS:\nA synth creates sound by generating waves and shaping them\n\n📈 HOW A SYNTH WORKS:\n1. OSCILLATOR: Generates the initial waveform\n2. FILTER: Removes/shapes frequencies\n3. ENVELOPE: Controls how sound starts, sustains, ends\n4. LFO: Adds movement and modulation\n5. EFFECTS: Adds depth and character\n\n🌊 WAVEFORM TYPES:\n\nSINE WAVE:\n- Sound: Pure, smooth, simple\n- Use: Pads, bass, subliminal frequencies\n- Example: Holds a single pure frequency\n\nSQUARE WAVE:\n- Sound: Hollow, buzzy, nostalgic\n- Use: Chiptune, retro sounds, bass\n- Example: 8-bit video game sound\n\nSAW WAVE:\n- Sound: Bright, harsh, cutting\n- Use: Leads, bass lines, aggressive sounds\n- Example: Synthesizer lead in EDM\n\nTRIANGLE WAVE:\n- Sound: Softer than square, between sine and square\n- Use: Soft leads, pads, mellow sounds\n- Example: Warm bass tones\n\n🔧 FILTER PARAMETERS:\n\nFREQUENCY (Cutoff):\n- How many Hz to filter out\n- Lower = darker/bassier sound\n- Higher = brighter/treble sound\n\nRES ONANCE (Q):\n- Boosts frequencies around cutoff point\n- Higher = more emphasis on that frequency\n- Creates movement and character\n\n⏰ ENVELOPE (ADSR):\nControls how sound evolves over time\n\nA (ATTACK): Time to reach peak volume\n- 0ms = instant (snappy, percussive)\n- 100-500ms = slow (smooth, swelling)\n\nD (DECAY): Time from peak to sustain level\n- How quickly sound settles\n- Short decay = punchy\n- Long decay = sustained\n\nS (SUSTAIN): Level when key held down\n- 0% = silent (one-shot sounds)\n- 100% = full volume (holds the note)\n\nR (RELEASE): Time to silence after key released\n- 0ms = instant cutoff\n- 200-1000ms = fade out\n- Creates natural sound tail\n\n🎛️ LFO (Low Frequency Oscillator):\n- Another oscillator that modulates parameters\n- Usually too slow to hear as pitch (under 20Hz)\n- Creates modulation/movement\n- Can modulate: Pitch, filter, volume, pan\n\nExample: Wobble bass\n- LFO modulates filter cutoff\n- Creates the \"wah-wah\" effect\n\n🎯 SIMPLE SOUND DESIGN EXERCISE:\n1. Start with sine wave (purest sound)\n2. Close filter completely (cutoff = 0)\n3. Slowly open filter to hear change\n4. Adjust ADSR for different feel:\n   - Fast attack + short decay = drums\n   - Slow attack + long sustain = pad\n   - Medium attack + release = lead\n5. Add LFO to filter for movement\n6. Play different notes - sound works!",
          details: ["Synthesizers create/shape sounds", "5 main components", "ADSR envelope controls evolution", "Filters control frequency content"]
        },
        { 
          title: "Mixing and EQ", 
          text: "Balancing and polishing your tracks:\n\n🎚️ WHAT IS MIXING?\n- Balancing volume levels of different tracks\n- Panning (left/right placement)\n- Adding effects (reverb, delay, compression)\n- Making each instrument heard clearly\n- Creating depth and space\n\n🎯 THE MIXING PROCESS:\n1. SET LEVELS: Make sure drums are clear reference\n2. PAN: Spread instruments left/right for space\n3. APPLY EQ: Shape each instrument's frequency\n4. ADD EFFECTS: Reverb, delay, compression\n5. AUTOMATE: Change parameters over time\n6. REFERENCE: Compare to professional mixes\n7. MASTER: Final loudness and clarity\n\n🔊 FADERS & LEVELS:\n- Adjust volume of each track independently\n- Drums usually loudest (foundation)\n- Bass next (feels the vibe)\n- Leads prominent but not overwhelming\n- Rule of thumb: At -0 dB (digital clipping point)\n- Leave headroom: Peak at -3 to -6 dB\n\n🔀 PANNING:\n- Placing sound left/right in stereo field\n- Creates width and space\n- Prevents frequency masking\n- Typical panning:\n  • Drums: Center (kick, snare)\n  • Bass: Center (feels better)\n  • Hi-hats: Slight L/R separation\n  • Lead: Center or L/R depending on vibe\n  • Pads: Wider panning for space\n\n📊 WHAT IS EQ (Equalization)?\nAdjusting frequencies to shape tone\n\n🎛️ HOW EQ WORKS:\n- Divides frequency spectrum (20Hz - 20kHz)\n- Boosts or cuts specific frequency ranges\n- Each instrument occupies different frequency range\n- Removing overlap = clarity\n\n📈 FREQUENCY RANGES:\n\nSUB BASS (20-60 Hz):\n- Feel it more than hear it\n- Kick drum and bass live here\n- Too much = muddiness\n\nBASS (60-250 Hz):\n- Depth and fullness\n- Bass guitar, drums, low synths\n- Control this for clarity\n\nLOW MID (250-2kHz):\n- Body and weight\n- Vocals, guitars, piano\n- Too much = boxy sound\n\nMID (2-4kHz):\n- Presence and clarity\n- Where ears are sensitive\n- Helps vocals cut through\n\nHIGH MID (4-8kHz):\n- Brightness and presence\n- Vocals, cymbals, excitement\n- Too much = harsh/annoying\n\nTREBLE (8-20kHz):\n- Air, shimmer, brilliance\n- Cymbals, hi-hats, presence\n- Too much = sibilance/hiss\n\n🎯 EQ STRATEGIES:\n\nDRUM KICK:\n- Boost 60-250Hz for punch\n- Cut 250-2kHz (reduces boxy)\n- Boost 4-8kHz for attack/click\n\nVOCAL:\n- Cut 250-500Hz (removes muddiness)\n- Boost 2-4kHz (presence/clarity)\n- Gentle cut 8kHz (removes harshness)\n\nBASS:\n- Boost sub bass 30-60Hz (feel)\n- Gentle cut mid-bass 200-400Hz (mud removal)\n- Boost around 1-2kHz (punch and definition)\n\nSYNTH PADS:\n- Generally leave bright and open\n- Subtle EQ adjustments (don't overcomplicate)\n- Boost high frequencies for air\n\n💡 EQ RULES:\n1. Use SUBTRACTIVE EQ (cut) before ADDITIVE (boost)\n2. Make small adjustments (0.5-1.5dB at a time)\n3. A-B compare (toggle on/off to hear effect)\n4. Less EQ = better than too much\n5. Reference professional mixes in same genre\n\n⚡ COMMON MISTAKES:\n❌ Boosting multiple frequencies = muddy\n❌ Over-processing vocals = unnatural\n❌ Ignoring bass frequencies = unbalanced\n❌ Not leaving enough headroom = clipping\n✅ Cut before boosting\n✅ Make subtle adjustments\n✅ Compare to reference tracks\n✅ Leave -3 to -6 dB headroom\n\n🎧 MIXING ORDER:\n1. Get rough levels (drums, bass, lead)\n2. Pan for width and separation\n3. EQ each track (remove conflicts)\n4. Add compression (tame dynamics)\n5. Add effects (reverb, delay)\n6. Final balance and automation\n7. Check on multiple speakers\n8. Take breaks (ear fatigue is real!)",
          details: ["Balance and shape each track", "EQ removes frequency conflicts", "ADSR for dynamics", "Less processing = better quality"]
        }
      ],
      quiz: [
        { q: "🎧 What does DAW stand for?", opts: ["Digital Audio Workstation", "Digital Audio Wave", "Direct Audio Writing", "Digital Amp Waveform"], ans: 0, tip: "Your complete music production studio in software!" },
        { q: "🎧 What is BPM?", opts: ["Bass Per Minute", "Beats Per Minute", "Bytes Per Minute", "Band Per Minute"], ans: 1, tip: "120 BPM is the most common standard" },
        { q: "🎧 Which DAW is best for beginners?", opts: ["Pro Tools", "Ableton Live", "Logic Pro", "Reaper"], ans: 1, tip: "Ableton has a free Lite version to start" },
        { q: "🎧 What does EQ help you do in mixing?", opts: ["Make things louder", "Shape frequency content", "Record audio", "Add echo"], ans: 1, tip: "EQ removes frequency conflicts between instruments" },
        { q: "🎧 In the ADSR envelope, what does 'Attack' control?", opts: ["Duration of sustain", "Time to reach peak volume", "Fade out time", "Volume level"], ans: 1, tip: "Fast attack = snappy, slow attack = smooth" }
      ]
    }
  ]

  const handleLessonSelect = (lesson) => {
    setSelectedLesson(lesson)
    setLessonProgress(0)
    setQuizStarted(lesson.showGame ? true : false)
    setShowResults(false)
  }

  const handleNextContent = () => {
    if (selectedLesson && lessonProgress < selectedLesson.content.length - 1) {
      setLessonProgress(lessonProgress + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleStartQuiz = () => {
    setQuizStarted(true)
    setQuizScore(0)
    setQuizAnswered(0)
    setShowResults(false)
  }

  const handleQuizAnswer = (isCorrect, answerIndex) => {
    // Mark this question as answered
    const newAnswered = new Set(answered)
    newAnswered.add(quizAnswered)
    setAnswered(newAnswered)
    setSelectedAnswer(answerIndex)
    
    // Calculate score with multiplier
    let pointsEarned = 0
    if (isCorrect) {
      // Streak-based multiplier
      let multiplier = 1
      if (streak >= 3) multiplier = 1.5 // 50% bonus at 3+ streak
      if (streak >= 5) multiplier = 2.0 // 100% bonus at 5+ streak
      pointsEarned = Math.round(1 * multiplier)
      
      setQuizScore(quizScore + pointsEarned)
      setStreak(streak + 1)
    } else {
      // Reset streak on wrong answer
      setStreak(0)
      pointsEarned = 0
    }
    
    // Move to next question after a slight delay for visual effect
    setTimeout(() => {
      const newAnsweredCount = quizAnswered + 1
      if (newAnsweredCount === selectedLesson.quiz.length) {
        setShowResults(true)
      } else {
        setQuizAnswered(newAnsweredCount)
        setSelectedAnswer(null)
      }
    }, 800)
  }

  const handleBackToLessons = () => {
    setSelectedLesson(null)
    setLessonProgress(0)
    setQuizStarted(false)
    setShowResults(false)
  }

  if (selectedLesson) {
    if (quizStarted) {
      // For Guitar Basics, show the Fretboard Master game
      if (selectedLesson.id === 1) {
        return (
          <div className="min-h-screen bg-[#1b1b1b] text-white">
            <header className="sticky top-0 z-40 bg-[#1b1b1b] border-b border-[#444] p-4">
              <div className="max-w-[1200px] mx-auto flex items-center justify-between">
                <button
                  onClick={handleBackToLessons}
                  className="px-4 py-2 text-[#ffd700] hover:text-[#ffe44c] transition font-semibold"
                >
                  ← Back to Lessons
                </button>
                <h1 className="text-2xl font-bold">🎮 Game: {selectedLesson.title}</h1>
                <div className="w-24"></div>
              </div>
            </header>

            <div className="max-w-4xl mx-auto p-8 md:p-16">
              <GuitarFretboardGame onComplete={handleBackToLessons} />
            </div>
          </div>
        )
      }

      // For Piano Fundamentals, show Simon Says Keys game
      if (selectedLesson.id === 2) {
        return (
          <div className="min-h-screen bg-[#1b1b1b] text-white">
            <header className="sticky top-0 z-40 bg-[#1b1b1b] border-b border-[#444] p-4">
              <div className="max-w-[1200px] mx-auto flex items-center justify-between">
                <button
                  onClick={handleBackToLessons}
                  className="px-4 py-2 text-[#ffd700] hover:text-[#ffe44c] transition font-semibold"
                >
                  ← Back to Lessons
                </button>
                <h1 className="text-2xl font-bold">🎮 Game: {selectedLesson.title}</h1>
                <div className="w-24"></div>
              </div>
            </header>

            <div className="max-w-4xl mx-auto p-8 md:p-16">
              <PianoSimonGame onComplete={handleBackToLessons} />
            </div>
          </div>
        )
      }

      // For other lessons, show the traditional quiz
      return (
        <div className="min-h-screen bg-[#1b1b1b] text-white">
          <header className="sticky top-0 z-40 bg-[#1b1b1b] border-b border-[#444] p-4">
            <div className="max-w-[1200px] mx-auto flex items-center justify-between">
              <button
                onClick={handleBackToLessons}
                className="px-4 py-2 text-[#ffd700] hover:text-[#ffe44c] transition font-semibold"
              >
                ← Back to Lessons
              </button>
              <h1 className="text-2xl font-bold">Quiz: {selectedLesson.title}</h1>
              <div className="w-24"></div>
            </div>
          </header>

          <div className="max-w-4xl mx-auto p-8 md:p-16">
            {showResults ? (
              <div className="text-center">
                <h2 className="text-5xl font-bold mb-12 animate-pulse">🎉 Quiz Complete! 🎉</h2>
                
                {/* Main Score Card */}
                <div className="bg-gradient-to-br from-[#2a2a2a] to-[#1f1f1f] p-12 rounded-lg border-2 border-[#ffd700]/50 mb-10 shadow-2xl">
                  <div className="mb-8">
                    <p className="text-7xl font-black text-[#ffd700] drop-shadow-lg">{quizScore} / {selectedLesson.quiz.length}</p>
                    <p className="text-3xl text-[#bbb] mt-4">Accuracy: {Math.round((quizScore / selectedLesson.quiz.length) * 100)}%</p>
                  </div>
                  
                  {/* Performance Message */}
                  <div className="mb-8 p-4 bg-[#1b1b1b] rounded-lg border border-[#ffd700]/30">
                    {quizScore === selectedLesson.quiz.length && (
                      <p className="text-2xl text-[#ffd700] font-bold">🌟 PERFECT SCORE! You're a Master! 🌟</p>
                    )}
                    {quizScore >= selectedLesson.quiz.length * 0.8 && quizScore !== selectedLesson.quiz.length && (
                      <p className="text-2xl text-[#ffd700] font-bold">⭐ Outstanding! You Really Know Your Stuff! ⭐</p>
                    )}
                    {quizScore >= selectedLesson.quiz.length * 0.6 && quizScore < selectedLesson.quiz.length * 0.8 && (
                      <p className="text-2xl text-[#ffd700] font-bold">👏 Great Job! You're on the Right Track! 👏</p>
                    )}
                    {quizScore < selectedLesson.quiz.length * 0.6 && (
                      <p className="text-2xl text-[#ffd700] font-bold">💪 Good Effort! Keep Practicing to Master This! 💪</p>
                    )}
                  </div>
                  
                  {/* Achievement Badges */}
                  <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="bg-[#1b1b1b] p-4 rounded-lg border border-[#ffd700]/30">
                      <p className="text-3xl mb-2">🏆</p>
                      <p className="text-sm text-[#bbb]">Score Achieved</p>
                      <p className="text-lg font-bold text-[#ffd700]">{quizScore}/{selectedLesson.quiz.length}</p>
                    </div>
                    <div className="bg-[#1b1b1b] p-4 rounded-lg border border-[#ffd700]/30">
                      <p className="text-3xl mb-2">🎯</p>
                      <p className="text-sm text-[#bbb]">Accuracy</p>
                      <p className="text-lg font-bold text-[#ffd700]">{Math.round((quizScore / selectedLesson.quiz.length) * 100)}%</p>
                    </div>
                    <div className="bg-[#1b1b1b] p-4 rounded-lg border border-[#ffd700]/30">
                      <p className="text-3xl mb-2">⏱️</p>
                      <p className="text-sm text-[#bbb]">Completed</p>
                      <p className="text-lg font-bold text-[#ffd700]">Quiz Done</p>
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={handleBackToLessons}
                  className="bg-[#ffd700] hover:bg-[#ffe44c] text-black font-bold py-4 px-8 rounded-lg transition shadow-lg text-lg mb-4 transform hover:scale-105"
                >
                  🏠 Back to Lessons
                </button>
              </div>
            ) : (
              <div>
                {/* Streak Counter */}
                {streak > 0 && (
                  <div className="text-center mb-6 animate-pulse">
                    <p className="text-3xl font-bold text-[#ffd700] drop-shadow-lg">
                      🔥 Streak: {streak}
                      {streak >= 3 && ' 🎯'}
                      {streak >= 5 && ' 💥'}
                    </p>
                    {streak >= 3 && <p className="text-[#bbb] text-sm mt-2">✨ Bonus Multiplier Active! +50% points ✨</p>}
                    {streak >= 5 && <p className="text-[#ffd700] text-sm font-bold mt-2">🚀 MEGA COMBO! +100% points! 🚀</p>}
                  </div>
                )}

                {/* Progress Bar */}
                <div className="mb-8 bg-[#2a2a2a] p-6 rounded-lg border border-[#ffd700]/30">
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-[#bbb]">Question {quizAnswered + 1} of {selectedLesson.quiz.length}</p>
                    <p className="text-[#ffd700] font-bold">Score: {quizScore}</p>
                  </div>
                  <div className="w-full bg-[#1b1b1b] rounded-full h-3 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-[#ffd700] to-[#ffe44c] h-3 rounded-full transition-all duration-500 shadow-lg"
                      style={{width: `${((quizAnswered) / selectedLesson.quiz.length) * 100}%`}}
                    ></div>
                  </div>
                </div>

                {/* Question */}
                {selectedLesson.quiz[quizAnswered] && (
                  <div>
                    <h3 className="text-2xl md:text-3xl font-bold mb-8 text-[#ffd700]">{selectedLesson.quiz[quizAnswered].q}</h3>
                    
                    {/* Answer Options */}
                    <div className="grid grid-cols-1 gap-4 mb-6">
                      {selectedLesson.quiz[quizAnswered].opts.map((opt, idx) => {
                        const isCorrect = idx === selectedLesson.quiz[quizAnswered].ans
                        const isSelected = selectedAnswer === idx
                        
                        let btnClass = "bg-[#2a2a2a] hover:bg-[#333] text-white p-6 rounded-lg border border-[#ffd700]/30 hover:border-[#ffd700]/60 transition text-left text-lg font-semibold cursor-pointer "
                        
                        if (isSelected && selectedAnswer !== null) {
                          if (isCorrect) {
                            btnClass += "bg-green-900/50 border-green-500/80 border-2 scale-105 animate-pulse shadow-lg shadow-green-500/50"
                          } else {
                            btnClass += "bg-red-900/50 border-red-500/80 border-2 scale-95 shadow-lg shadow-red-500/50"
                          }
                        }
                        
                        return (
                          <button
                            key={idx}
                            onClick={() => handleQuizAnswer(isCorrect, idx)}
                            disabled={selectedAnswer !== null}
                            className={btnClass}
                          >
                            <div className="flex items-center justify-between">
                              <span>{opt}</span>
                              {isSelected && selectedAnswer !== null && (
                                isCorrect ? (
                                  <span className="text-2xl animate-bounce">✅</span>
                                ) : (
                                  <span className="text-2xl animate-bounce">❌</span>
                                )
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                    
                    {/* Helpful Tip */}
                    {selectedAnswer !== null && selectedLesson.quiz[quizAnswered].tip && (
                      <div className="bg-[#2a2a2a] p-4 rounded-lg border border-[#ffd700]/30 text-[#bbb] text-sm">
                        <p className="font-semibold text-[#ffd700] mb-1">💡 Tip:</p>
                        <p>{selectedLesson.quiz[quizAnswered].tip}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-[#1b1b1b] text-white">
        <header className="sticky top-0 z-40 bg-[#1b1b1b] border-b border-[#444] p-4">
          <div className="max-w-[1200px] mx-auto flex items-center justify-between">
            <button
              onClick={handleBackToLessons}
              className="px-4 py-2 text-[#ffd700] hover:text-[#ffe44c] transition font-semibold"
            >
              ← Back to Lessons
            </button>
            <h1 className="text-2xl font-bold">{selectedLesson.title}</h1>
            <div className="w-24"></div>
          </div>
        </header>

        <div className="max-w-5xl mx-auto p-4 md:p-8">
          {/* Enhanced Progress Section */}
          <div className="mb-10 bg-gradient-to-r from-[#2a2a2a]/50 to-[#1f1f1f]/50 p-6 rounded-xl border border-[#ffd700]/20 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[#bbb] text-sm font-semibold mb-1">📚 LEARNING PROGRESS</p>
                <p className="text-2xl font-bold text-[#ffd700]">Topic {lessonProgress + 1} of {selectedLesson.content.length}</p>
              </div>
              <div className="text-right">
                <p className="text-[#bbb] text-sm mb-1">Overall Completion</p>
                <p className="text-3xl font-bold text-[#ffd700]">{Math.round((lessonProgress + 1) / selectedLesson.content.length * 100)}%</p>
              </div>
            </div>
            <div className="w-full bg-[#1b1b1b] rounded-full h-3 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-[#ffd700] via-[#ffe44c] to-[#ffd700] h-3 rounded-full transition-all duration-500 shadow-lg shadow-[#ffd700]/50"
                style={{width: `${((lessonProgress + 1) / selectedLesson.content.length) * 100}%`}}
              ></div>
            </div>
          </div>

          {/* Enhanced Content Card with Interactive Elements */}
          <div className="mb-8">
            <div className="bg-gradient-to-br from-[#2a2a2a] via-[#252525] to-[#1f1f1f] rounded-2xl border-2 border-[#ffd700]/40 overflow-hidden shadow-2xl hover:shadow-[0_0_30px_rgba(255,215,0,0.3)] transition-all duration-300">
              {/* Title Bar with Icon */}
              <div className="bg-gradient-to-r from-[#ffd700]/10 to-[#ffd700]/5 p-8 border-b border-[#ffd700]/30">
                <div className="flex items-start gap-4">
                  <div className="text-6xl">{selectedLesson.icon}</div>
                  <div className="flex-1">
                    <h2 className="text-4xl md:text-5xl font-black text-[#ffd700] mb-2 drop-shadow-lg">
                      {selectedLesson.content[lessonProgress].title}
                    </h2>
                    <p className="text-[#bbb] text-sm">Topic {lessonProgress + 1} • {selectedLesson.title}</p>
                  </div>
                </div>
              </div>

              {/* Content Area with Enhanced Formatting */}
              <div className="p-8 md:p-10">
                <div className="prose prose-invert max-w-none">
                  <div className="text-[#bbb] text-base md:text-lg leading-relaxed whitespace-pre-wrap font-light space-y-4">
                    {selectedLesson.content[lessonProgress].text.split('\n\n').map((paragraph, idx) => (
                      <div key={idx} className="animate-fade-in">
                        {paragraph.split('\n').map((line, lineIdx) => {
                          // Style different line types
                          if (line.match(/^🎯|^✓|^⚠️|^💡|^🎵|^🔍|^⚡|^📊|^✅|^❌|^🎸|^🎹|^🥁|^🎤|^🎧|^🎼/)) {
                            return (
                              <div key={lineIdx} className="bg-[#ffd700]/5 border-l-4 border-[#ffd700]/60 pl-4 py-2 my-2 rounded-r-lg font-semibold text-[#ffd700] hover:bg-[#ffd700]/10 transition">
                                {line}
                              </div>
                            )
                          }
                          // Style section headers (all caps lines)
                          if (line.match(/^[A-Z\s]+:/) && line.length < 50) {
                            return (
                              <div key={lineIdx} className="text-[#ffd700] font-bold text-lg mt-4 mb-2">
                                {line}
                              </div>
                            )
                          }
                          return (
                            <p key={lineIdx} className="text-[#bbb]">
                              {line}
                            </p>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Key Takeaways Box */}
                {selectedLesson.content[lessonProgress].details && (
                  <div className="mt-8 pt-8 border-t border-[#ffd700]/20">
                    <div className="bg-gradient-to-r from-[#ffd700]/10 to-transparent p-6 rounded-xl border border-[#ffd700]/30">
                      <h3 className="text-lg font-bold text-[#ffd700] mb-4 flex items-center gap-2">
                        <span className="text-2xl">💡</span> KEY TAKEAWAYS
                      </h3>
                      <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {selectedLesson.content[lessonProgress].details.map((detail, idx) => (
                          <li key={idx} className="flex items-start gap-3 text-[#bbb] hover:text-[#ffd700] transition">
                            <span className="text-[#ffd700] font-bold mt-1">✓</span>
                            <span>{detail}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Learning Tips Section */}
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            <div className="bg-[#2a2a2a] border border-[#ffd700]/30 rounded-lg p-5 hover:border-[#ffd700]/60 transition">
              <p className="text-2xl mb-2">🎯</p>
              <p className="text-[#bbb] text-sm font-semibold">Learning Tip</p>
              <p className="text-[#ffd700] text-xs mt-2">Read slowly and practice what you learn</p>
            </div>
            <div className="bg-[#2a2a2a] border border-[#ffd700]/30 rounded-lg p-5 hover:border-[#ffd700]/60 transition">
              <p className="text-2xl mb-2">📝</p>
              <p className="text-[#bbb] text-sm font-semibold">Take Notes</p>
              <p className="text-[#ffd700] text-xs mt-2">Important concepts are highlighted in gold</p>
            </div>
            <div className="bg-[#2a2a2a] border border-[#ffd700]/30 rounded-lg p-5 hover:border-[#ffd700]/60 transition">
              <p className="text-2xl mb-2">🚀</p>
              <p className="text-[#bbb] text-sm font-semibold">Practice</p>
              <p className="text-[#ffd700] text-xs mt-2">Quiz at the end tests your knowledge</p>
            </div>
          </div>

          {/* Enhanced Navigation Buttons */}
          <div className="flex gap-4 justify-between">
            {lessonProgress === selectedLesson.content.length - 1 ? (
              <button
                onClick={handleStartQuiz}
                className="w-full bg-gradient-to-r from-[#ffd700] to-[#ffe44c] hover:from-[#ffe44c] hover:to-[#ffd700] text-black font-bold py-4 px-8 rounded-xl transition shadow-lg shadow-[#ffd700]/50 text-lg transform hover:scale-105 active:scale-95"
              >
                🎯 Start Quiz & Test Your Knowledge!
              </button>
            ) : (
              <>
                <button
                  onClick={() => setLessonProgress(Math.max(0, lessonProgress - 1))}
                  disabled={lessonProgress === 0}
                  className="px-8 py-4 bg-[#333] hover:bg-[#444] text-white rounded-xl transition disabled:opacity-30 disabled:cursor-not-allowed font-semibold shadow-lg transform hover:scale-105 active:scale-95"
                >
                  ← Previous Topic
                </button>
                <button
                  onClick={handleNextContent}
                  className="px-8 py-4 bg-gradient-to-r from-[#ffd700] to-[#ffe44c] hover:from-[#ffe44c] hover:to-[#ffd700] text-black rounded-xl transition font-semibold shadow-lg shadow-[#ffd700]/50 transform hover:scale-105 active:scale-95"
                >
                  Next Topic →
                </button>
              </>
            )}
          </div>

          {/* Learning Milestone Indicators */}
          <div className="mt-10 flex justify-between items-center px-2">
            {Array.from({length: selectedLesson.content.length}).map((_, idx) => (
              <div key={idx} className="flex flex-col items-center gap-2">
                <div 
                  className={`w-12 h-12 rounded-full flex items-center justify-center font-bold transition-all ${
                    idx < lessonProgress 
                      ? 'bg-[#ffd700] text-black shadow-lg shadow-[#ffd700]/50' 
                      : idx === lessonProgress 
                      ? 'bg-[#ffd700]/40 border-2 border-[#ffd700] text-[#ffd700] animate-pulse'
                      : 'bg-[#333] text-[#bbb]'
                  }`}
                >
                  {idx < lessonProgress ? '✓' : idx + 1}
                </div>
                <p className="text-xs text-[#bbb] text-center w-12">Topic {idx + 1}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#1b1b1b] text-white">
      <header className="sticky top-0 z-40 bg-[#1b1b1b] border-b border-[#444] p-4">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 text-[#ffd700] hover:text-[#ffe44c] transition font-semibold"
          >
            ← Back to Home
          </button>
          <h1 className="text-2xl font-bold">Interactive Music Lessons</h1>
          <div className="w-24"></div>
        </div>
      </header>

      <section className="bg-gradient-to-r from-[#ffd700]/10 to-[#2a2a2a] p-8 md:p-16">
        <div className="max-w-[1200px] mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Learn Music Online</h2>
          <p className="text-[#bbb] text-lg">Choose a lesson below to get started. Each lesson includes educational content followed by a fun quiz to test your knowledge!</p>
        </div>
      </section>

      <section className="max-w-[1200px] mx-auto p-8 md:p-16">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">🎵 Available Lessons 🎵</h2>
          <p className="text-[#bbb]">Master music fundamentals with interactive lessons • Gamified quizzes • Instant feedback</p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {lessons.map((lesson) => (
            <button
              key={lesson.id}
              onClick={() => handleLessonSelect(lesson)}
              className="relative bg-gradient-to-br from-[#2a2a2a] to-[#1f1f1f] hover:from-[#333] hover:to-[#222] p-8 rounded-lg border-2 border-[#ffd700]/30 hover:border-[#ffd700]/80 transition text-left cursor-pointer group overflow-hidden"
              style={{
                boxShadow: '0 0 20px rgba(255, 215, 0, 0.2), inset 0 0 20px rgba(255, 215, 0, 0.05)',
                transform: 'transition: all 0.3s ease'
              }}
            >
              {/* Animated background glow */}
              <div className="absolute inset-0 bg-[#ffd700]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              
              <div className="relative z-10">
                <div className="text-7xl mb-4 group-hover:scale-125 transition-transform duration-300 block">{lesson.icon}</div>
                <h3 className="text-2xl font-bold text-[#ffd700] mb-2 group-hover:text-[#ffe44c] transition">{lesson.title}</h3>
                <p className="text-[#bbb] text-sm mb-4 leading-relaxed">{lesson.description}</p>
                
                <div className="flex items-center justify-between pt-4 border-t border-[#ffd700]/20">
                  <div className="text-xs text-[#bbb]">
                    <p>📚 4 Topics</p>
                    <p>🎯 Quiz Included</p>
                  </div>
                  <div className="text-3xl group-hover:translate-x-2 transition-transform">→</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Games Section */}
      <section className="max-w-[1200px] mx-auto p-8 md:p-16">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">🎮 Music Learning Games 🎮</h2>
          <p className="text-[#bbb]">Have fun while learning! Play interactive games anytime to reinforce your skills and stay motivated</p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto">
          {/* Guitar Fretboard Master Game */}
          <button
            onClick={() => setSelectedLesson({ 
              title: "Guitar Basics", 
              id: 1,
              showGame: 'guitar'
            })}
            className="relative bg-gradient-to-br from-[#2a2a2a] to-[#1f1f1f] hover:from-[#333] hover:to-[#222] p-8 rounded-lg border-2 border-[#ffd700]/30 hover:border-[#ffd700]/80 transition text-left cursor-pointer group overflow-hidden"
            style={{
              boxShadow: '0 0 20px rgba(255, 215, 0, 0.2), inset 0 0 20px rgba(255, 215, 0, 0.05)'
            }}
          >
            {/* Animated background glow */}
            <div className="absolute inset-0 bg-[#ffd700]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            
            <div className="relative z-10">
              <div className="text-6xl mb-3 group-hover:scale-110 transition-transform">🎸</div>
              <h3 className="text-xl font-bold text-[#ffd700] mb-2 group-hover:text-[#ffe44c] transition">Fretboard Master</h3>
              <p className="text-[#bbb] text-sm mb-4">Learn guitar notes by identifying frets on a virtual fretboard. Perfect for beginners!</p>
              
              <div className="flex items-center justify-between pt-4 border-t border-[#ffd700]/20">
                <div className="text-xs text-[#bbb]">
                  <p>⏱️ 5-10 mins</p>
                  <p>🎯 10 Rounds</p>
                </div>
                <div className="text-3xl group-hover:translate-x-2 transition-transform">→</div>
              </div>
            </div>
          </button>

          {/* Piano Simon Says Game */}
          <button
            onClick={() => setSelectedLesson({ 
              title: "Piano Fundamentals", 
              id: 2,
              showGame: 'piano'
            })}
            className="relative bg-gradient-to-br from-[#2a2a2a] to-[#1f1f1f] hover:from-[#333] hover:to-[#222] p-8 rounded-lg border-2 border-[#ffd700]/30 hover:border-[#ffd700]/80 transition text-left cursor-pointer group overflow-hidden"
            style={{
              boxShadow: '0 0 20px rgba(255, 215, 0, 0.2), inset 0 0 20px rgba(255, 215, 0, 0.05)'
            }}
          >
            {/* Animated background glow */}
            <div className="absolute inset-0 bg-[#ffd700]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            
            <div className="relative z-10">
              <div className="text-6xl mb-3 group-hover:scale-110 transition-transform">🎹</div>
              <h3 className="text-xl font-bold text-[#ffd700] mb-2 group-hover:text-[#ffe44c] transition">Simon Says Keys</h3>
              <p className="text-[#bbb] text-sm mb-4">Memory game with piano keys - remember the sequence and repeat it correctly!</p>
              
              <div className="flex items-center justify-between pt-4 border-t border-[#ffd700]/20">
                <div className="text-xs text-[#bbb]">
                  <p>⏱️ 5-15 mins</p>
                  <p>🎯 Progressive</p>
                </div>
                <div className="text-3xl group-hover:translate-x-2 transition-transform">→</div>
              </div>
            </div>
          </button>
        </div>
      </section>
    </div>
  )
}
