'use client'

import { useEffect, useState } from 'react'

const QUOTES: { line: string; author: string }[] = [
  { line: 'Tell me and I forget. Teach me and I remember. Involve me and I learn.',          author: 'Benjamin Franklin' },
  { line: 'Live as if you were to die tomorrow. Learn as if you were to live forever.',      author: 'Mahatma Gandhi' },
  { line: 'The expert in anything was once a beginner.',                                     author: 'Helen Hayes' },
  { line: 'It always seems impossible until it is done.',                                    author: 'Nelson Mandela' },
  { line: 'The beautiful thing about learning is that nobody can take it away from you.',    author: 'B.B. King' },
  { line: 'Productivity is never an accident. It is always the result of a commitment.',     author: 'Paul J. Meyer' },
  { line: 'Focus on being productive instead of busy.',                                      author: 'Tim Ferriss' },
  { line: 'Anyone who has never made a mistake has never tried anything new.',               author: 'Albert Einstein' },
  { line: 'Small daily improvements are the key to staggering long-term results.',           author: 'Robin Sharma' },
  { line: 'You do not rise to the level of your goals. You fall to the level of your systems.', author: 'James Clear' },
  { line: 'Do the hard jobs first. The easy jobs will take care of themselves.',             author: 'Dale Carnegie' },
  { line: 'The best way to predict the future is to create it.',                             author: 'Peter Drucker' },
  { line: 'Continuous improvement is better than delayed perfection.',                       author: 'Mark Twain' },
  { line: 'Discipline is the bridge between goals and accomplishment.',                      author: 'Jim Rohn' },
  { line: 'Learning never exhausts the mind.',                                               author: 'Leonardo da Vinci' },
]

function pickRandom(exclude: number): number {
  if (QUOTES.length <= 1) return 0
  let next = Math.floor(Math.random() * QUOTES.length)
  while (next === exclude) next = Math.floor(Math.random() * QUOTES.length)
  return next
}

export default function Loading() {
  const [index, setIndex] = useState<number>(() => Math.floor(Math.random() * QUOTES.length))

  useEffect(() => {
    const id = setInterval(() => setIndex((prev) => pickRandom(prev)), 6000)
    return () => clearInterval(id)
  }, [])

  const quote = QUOTES[index]

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <svg
          className="h-10 w-10 animate-spin text-[#5BAE5B]"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
          <path
            d="M22 12a10 10 0 0 1-10 10"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>

        <p className="mt-4 text-sm font-medium text-zinc-600">Hang tight, loading…</p>

        <div className="mt-8 w-full rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#5BAE5B]">
            While you wait
          </p>
          <p className="mt-3 text-sm leading-relaxed text-zinc-700">
            &ldquo;{quote.line}&rdquo;
          </p>
          <p className="mt-3 text-xs text-zinc-400">— {quote.author}</p>
        </div>
      </div>
    </div>
  )
}
