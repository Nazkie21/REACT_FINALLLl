import { useState, useEffect, useRef } from 'react'

export default function NoteCatcherGame({ onComplete }) {
  const canvasRef = useRef(null)
  const [gameStarted, setGameStarted] = useState(false)
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [targetNote, setTargetNote] = useState('whole')
  const [gameOver, setGameOver] = useState(false)
  const soundsRef = useRef({})

  const noteTypes = ['whole', 'half', 'quarter', 'eighth', 'sixteenth']
  const playerRef = useRef({ x: 0, y: 0, w: 150, h: 20, speed: 0 })
  const notesRef = useRef([])
  const keysRef = useRef({ left: false, right: false })
  const isDraggingRef = useRef(false)
  const lastSpawnRef = useRef(0)
  const spawnIntervalRef = useRef(1000)
  const gameLoopRef = useRef(null)

  // Initialize audio context and create sound effects
  useEffect(() => {
    if (!gameStarted) return

    // Create simple beep sounds using Web Audio API
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    
    soundsRef.current = {
      good: () => playBeep(audioContext, 800, 0.2, 'sine'),
      miss: () => playBeep(audioContext, 300, 0.2, 'sine'),
      gameOver: () => playBeep(audioContext, 150, 0.5, 'sine')
    }
  }, [gameStarted])

  const playBeep = (audioContext, frequency, duration, type = 'sine') => {
    try {
      const now = audioContext.currentTime
      const osc = audioContext.createOscillator()
      const gain = audioContext.createGain()

      osc.type = type
      osc.frequency.value = frequency
      gain.gain.setValueAtTime(0.3, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + duration)

      osc.connect(gain)
      gain.connect(audioContext.destination)

      osc.start(now)
      osc.stop(now + duration)
    } catch (e) {
      console.log('Sound playback not available')
    }
  }

  // Canvas setup and resize
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleResize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      playerRef.current.y = canvas.height - 60
      spawnIntervalRef.current = Math.max(800, canvas.width * 0.6)
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keysRef.current.left = true
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keysRef.current.right = true
    }

    const handleKeyUp = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keysRef.current.left = false
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keysRef.current.right = false
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  // Mouse controls
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleMouseDown = (e) => {
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      if (
        x >= playerRef.current.x &&
        x <= playerRef.current.x + playerRef.current.w &&
        y >= playerRef.current.y &&
        y <= playerRef.current.y + playerRef.current.h
      ) {
        isDraggingRef.current = true
      }
    }

    const handleMouseUp = () => {
      isDraggingRef.current = false
    }

    const handleMouseMove = (e) => {
      if (isDraggingRef.current) {
        const rect = canvas.getBoundingClientRect()
        const x = e.clientX - rect.left
        playerRef.current.x = x - playerRef.current.w / 2
      }
    }

    canvas.addEventListener('mousedown', handleMouseDown)
    canvas.addEventListener('mouseup', handleMouseUp)
    canvas.addEventListener('mousemove', handleMouseMove)

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown)
      canvas.removeEventListener('mouseup', handleMouseUp)
      canvas.removeEventListener('mousemove', handleMouseMove)
    }
  }, [])

  // Touch controls
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleTouchStart = (e) => {
      const rect = canvas.getBoundingClientRect()
      const touch = e.touches[0]
      const x = touch.clientX - rect.left
      const y = touch.clientY - rect.top

      if (
        x >= playerRef.current.x &&
        x <= playerRef.current.x + playerRef.current.w &&
        y >= playerRef.current.y &&
        y <= playerRef.current.y + playerRef.current.h
      ) {
        isDraggingRef.current = true
        e.preventDefault()
      }
    }

    const handleTouchEnd = () => {
      isDraggingRef.current = false
    }

    const handleTouchMove = (e) => {
      if (isDraggingRef.current) {
        const rect = canvas.getBoundingClientRect()
        const touch = e.touches[0]
        const x = touch.clientX - rect.left
        playerRef.current.x = x - playerRef.current.w / 2
        e.preventDefault()
      }
    }

    canvas.addEventListener('touchstart', handleTouchStart)
    canvas.addEventListener('touchend', handleTouchEnd)
    canvas.addEventListener('touchmove', handleTouchMove)

    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart)
      canvas.removeEventListener('touchend', handleTouchEnd)
      canvas.removeEventListener('touchmove', handleTouchMove)
    }
  }, [])

  const spawnNote = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const type = Math.random() < 0.5 ? targetNote : noteTypes.filter(n => n !== targetNote)[Math.floor(Math.random() * 4)]
    const note = {
      x: Math.random() * (canvas.width - 60) + 30,
      y: -30,
      r: canvas.height * 0.03,
      type,
      vy: Math.random() * (canvas.height * 0.005 - canvas.height * 0.002) + canvas.height * 0.002
    }
    notesRef.current.push(note)
  }

  const drawNoteShape = (ctx, n, sizeMultiplier = 1) => {
    ctx.save()
    ctx.translate(n.x, n.y)

    // Draw ellipse (note head)
    ctx.beginPath()
    ctx.ellipse(0, 0, n.r * 0.7 * sizeMultiplier, n.r * 0.55 * sizeMultiplier, 0, 0, Math.PI * 2)
    ctx.strokeStyle = '#fff'

    if (n.type === 'quarter' || n.type === 'eighth' || n.type === 'sixteenth') {
      ctx.fillStyle = '#fff'
      ctx.fill()
    } else {
      ctx.lineWidth = 2
      ctx.stroke()
    }

    // Stem
    if (n.type !== 'whole') {
      ctx.fillStyle = '#fff'
      ctx.fillRect(n.r * 0.6 * sizeMultiplier, -n.r * 1.4 * sizeMultiplier, 3 * sizeMultiplier, n.r * 2.2 * sizeMultiplier)
    }

    // Flags/Beams
    let flags = 0
    if (n.type === 'eighth') flags = 1
    if (n.type === 'sixteenth') flags = 2

    for (let f = 0; f < flags; f++) {
      ctx.beginPath()
      ctx.moveTo(n.r * 0.6 * sizeMultiplier + 3, -n.r * 1.4 * sizeMultiplier + f * 6 * sizeMultiplier)
      ctx.quadraticCurveTo(
        n.r * 0.6 * sizeMultiplier + 15,
        -n.r * 0.8 * sizeMultiplier + f * 6 * sizeMultiplier,
        n.r * 0.6 * sizeMultiplier + 3,
        -n.r * 0.2 * sizeMultiplier + f * 6 * sizeMultiplier
      )
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.stroke()
    }

    ctx.restore()
  }

  const update = () => {
    const canvas = canvasRef.current
    if (!canvas || !gameStarted) return

    // Player movement
    if (keysRef.current.left) playerRef.current.x -= playerRef.current.speed
    if (keysRef.current.right) playerRef.current.x += playerRef.current.speed
    if (playerRef.current.x < 0) playerRef.current.x = 0
    if (playerRef.current.x + playerRef.current.w > canvas.width) playerRef.current.x = canvas.width - playerRef.current.w

    // Spawn notes
    if (performance.now() - lastSpawnRef.current > spawnIntervalRef.current) {
      spawnNote()
      lastSpawnRef.current = performance.now()
    }

    // Update notes
    let newLives = lives
    let newScore = score
    let newTargetNote = targetNote

    for (let i = notesRef.current.length - 1; i >= 0; i--) {
      const n = notesRef.current[i]
      n.y += n.vy

      // Collision check
      if (
        n.y + n.r > playerRef.current.y &&
        n.y - n.r < playerRef.current.y + playerRef.current.h &&
        Math.abs(n.x - (playerRef.current.x + playerRef.current.w / 2)) < playerRef.current.w / 2 + n.r
      ) {
        if (n.type === targetNote) {
          newScore += 1
          soundsRef.current.good?.()
          newTargetNote = noteTypes[Math.floor(Math.random() * noteTypes.length)]
        } else {
          newLives -= 1
          soundsRef.current.miss?.()
        }
        notesRef.current.splice(i, 1)
        continue
      }

      // Drop check
      if (n.y > canvas.height) {
        if (n.type === targetNote) {
          newLives -= 1
          soundsRef.current.miss?.()
        }
        notesRef.current.splice(i, 1)
      }
    }

    setScore(newScore)
    setTargetNote(newTargetNote)

    if (newLives <= 0) {
      setLives(0)
      setGameOver(true)
      soundsRef.current.gameOver?.()
      return
    }

    setLives(newLives)
  }

  const draw = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')

    // Clear canvas
    ctx.fillStyle = '#071229'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw paddle
    ctx.fillStyle = '#0ea5a4'
    ctx.fillRect(playerRef.current.x, playerRef.current.y, playerRef.current.w, playerRef.current.h)

    // Draw falling notes
    notesRef.current.forEach(n => drawNoteShape(ctx, n))

    // Draw UI
    ctx.fillStyle = '#fff'
    ctx.font = `${canvas.height * 0.05}px sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText('CATCH: ' + targetNote.toUpperCase(), canvas.width / 2, canvas.height * 0.08)

    ctx.font = `${canvas.height * 0.03}px sans-serif`
    ctx.textAlign = 'left'
    ctx.fillText('Score: ' + score, 20, canvas.height * 0.12)
    ctx.fillText('Lives: ' + lives, 20, canvas.height * 0.16)

    playerRef.current.speed = canvas.width * 0.008
  }

  const loop = () => {
    if (!gameStarted || gameOver) return
    update()
    draw()
    gameLoopRef.current = requestAnimationFrame(loop)
  }

  useEffect(() => {
    if (gameStarted && !gameOver) {
      gameLoopRef.current = requestAnimationFrame(loop)
    }
    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current)
    }
  }, [gameStarted, gameOver])

  const handleStartGame = () => {
    setGameStarted(true)
    setScore(0)
    setLives(3)
    setGameOver(false)
    notesRef.current = []
    lastSpawnRef.current = performance.now()
    setTargetNote(noteTypes[Math.floor(Math.random() * noteTypes.length)])
  }

  const handlePlayAgain = () => {
    handleStartGame()
  }

  return (
    <div className="relative w-full">
      <canvas
        ref={canvasRef}
        className="w-full bg-[#071229] rounded-lg border-2 border-[#ffd700]/30"
        style={{ minHeight: '500px' }}
      />

      {/* Start Screen */}
      {!gameStarted && (
        <div className="absolute inset-0 bg-black/80 rounded-lg flex flex-col items-center justify-center">
          <div className="text-center">
            <h2 className="text-5xl font-bold text-white mb-4">🎵 Note Catcher 🎵</h2>
            <p className="text-xl text-[#bbb] mb-8">Catch the correct musical notes!</p>
            <p className="text-sm text-[#999] mb-6">
              Use Arrow Keys or WASD to move • Click and drag on mobile
            </p>
            <button
              onClick={handleStartGame}
              className="px-8 py-3 bg-[#0ea5a4] hover:bg-[#14b8a6] text-white font-bold rounded-lg text-xl transition"
            >
              Start Game
            </button>
          </div>
        </div>
      )}

      {/* Game Over Screen */}
      {gameOver && (
        <div className="absolute inset-0 bg-black/80 rounded-lg flex flex-col items-center justify-center">
          <div className="text-center">
            <h2 className="text-5xl font-bold text-[#ffd700] mb-4 animate-pulse">🎉 Game Over! 🎉</h2>
            <p className="text-3xl font-bold text-white mb-8">Final Score: {score}</p>
            <button
              onClick={handlePlayAgain}
              className="px-8 py-3 bg-[#ffd700] hover:bg-[#ffe44c] text-black font-bold rounded-lg text-xl transition"
            >
              Play Again
            </button>
            <button
              onClick={onComplete}
              className="px-8 py-3 bg-[#666] hover:bg-[#777] text-white font-bold rounded-lg text-xl transition ml-4"
            >
              Back to Lessons
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
