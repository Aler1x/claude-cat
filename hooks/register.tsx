import type { Register } from 'claude-code'

// Port of PetitChat from mistral-vibe (Apache-2.0):
// vibe/cli/textual_ui/widgets/banner/petit_chat.py

const WIDTH = 22
const HEIGHT = 12
const FRAME_MS = 160
const PAUSE_MIN_MS = 5_000
const PAUSE_MAX_MS = 20_000
const PAUSE_CHANCE = 0.25
// Frames right after the head settles with the eyes open: the cat may rest there.
const EYES_OPEN_PAUSE_FRAMES = new Set([5, 11, 21, 24])

// Dots by row: { y: [x, ...] }, origin at the top left.
type Rows = Record<number, number[]>
type Step = { remove: Set<number>; add: Set<number> }

const dots = (rows: Rows) =>
  new Set(Object.entries(rows).flatMap(([y, xs]) => xs.map(x => Number(y) * WIDTH + x)))
const step = (remove: Rows, add: Rows): Step => ({ remove: dots(remove), add: dots(add) })
const reverse = ({ remove, add }: Step): Step => ({ remove: add, add: remove })

const START: Rows = {
  1: [6, 7, 15, 19],
  2: [5, 8, 14, 16, 18, 20],
  3: [4, 6, 7, 14, 17, 20],
  4: [3, 5, 10, 11, 12, 14, 20],
  5: [3, 5, 9, 13, 14, 16, 18, 20],
  6: [3, 5, 8, 13, 17, 21],
  7: [3, 6, 7, 8, 11, 14, 15, 16, 18, 19, 20],
  8: [4, 5, 8, 12, 17, 19],
  9: [6, 7, 8, 13, 18, 20],
  10: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
}
const HEAD_HIGH: Rows = {
  1: [15, 19],
  2: [14, 16, 18, 20],
  3: [17],
  5: [17, 19],
  6: [13, 18, 21],
  7: [14, 15, 16, 19, 20],
}
const HEAD_LOW: Rows = {
  2: [15, 19],
  3: [16, 18],
  4: [17],
  6: [14, 17, 19, 20],
  7: [13, 21],
  8: [14, 15, 16, 18, 20],
}

const WAIT = step({}, {})
const TAIL_RIGHT_TO_MID = step(
  { 1: [6, 7], 2: [8], 3: [4, 6, 7], 8: [4, 5] },
  { 1: [4], 2: [3], 3: [3, 5], 7: [5], 8: [3], 9: [4, 5] },
)
const TAIL_MID_TO_LEFT = step(
  { 1: [4], 2: [5], 3: [3, 5], 7: [5], 8: [3], 9: [4, 5] },
  { 1: [1, 2], 2: [0], 3: [1, 2, 4], 8: [4, 5] },
)
const HEAD_RIGHT = step({ 5: [16, 18], 6: [17] }, { 5: [17, 19], 6: [18] })
const HEAD_DOWN = step(HEAD_HIGH, HEAD_LOW)
const BLINK_HIGH = [step({ 5: [16, 18] }, {}), step({}, { 5: [16, 18] })]
const BLINK_LOW = [step({ 6: [17, 19] }, {}), step({}, { 6: [17, 19] })]

const TRANSITIONS = [
  ...BLINK_HIGH,
  WAIT,
  TAIL_RIGHT_TO_MID,
  HEAD_RIGHT,
  WAIT,
  TAIL_MID_TO_LEFT,
  WAIT,
  reverse(TAIL_MID_TO_LEFT),
  WAIT,
  HEAD_DOWN,
  WAIT,
  reverse(TAIL_RIGHT_TO_MID),
  ...BLINK_LOW,
  WAIT,
  TAIL_RIGHT_TO_MID,
  WAIT,
  TAIL_MID_TO_LEFT,
  WAIT,
  reverse(HEAD_DOWN),
  WAIT,
  reverse(TAIL_MID_TO_LEFT),
  reverse(HEAD_RIGHT),
  WAIT,
  reverse(TAIL_RIGHT_TO_MID),
]

// Braille cell bit for the sub-dot (sx, sy): see https://en.wikipedia.org/wiki/Braille_Patterns
const bit = (sx: number, sy: number) => 1 << (sy < 3 ? sy + 3 * sx : 6 + sx)

function render(cat: Set<number>): string {
  const rows: string[] = []
  for (let cy = 0; cy < HEIGHT / 4; cy++) {
    let row = ''
    for (let cx = 0; cx < WIDTH / 2; cx++) {
      let bits = 0
      for (let sy = 0; sy < 4; sy++) {
        for (let sx = 0; sx < 2; sx++) {
          if (cat.has((cy * 4 + sy) * WIDTH + cx * 2 + sx)) bits |= bit(sx, sy)
        }
      }
      // Blank braille (U+2800), not a space: the desktop font draws a space narrower.
      row += String.fromCharCode(0x2800 + bits)
    }
    rows.push(row)
  }
  return rows.join('\n')
}

export const register: Register = on => {
  // ponytail: module state, a hot reload restarts the cat from its first frame
  const cat = dots(START)
  let resumeFrame: number | undefined

  // Applies the transitions forever, yielding the index of the next one.
  function* frames(): Generator<number, never> {
    for (;;) {
      for (const [i, { remove, add }] of TRANSITIONS.entries()) {
        remove.forEach(d => cat.delete(d))
        add.forEach(d => cat.add(d))
        yield (i + 1) % TRANSITIONS.length
      }
    }
  }
  const steps = frames()

  on('session.start', async ($, e, next) => {
    const play = () => {
      const timer = $.clock.every(FRAME_MS, () => {
        const frame = steps.next().value
        $.ui.invalidate('ui.render')

        // After a rest, play a full cycle back to the same frame before the next rest.
        if (resumeFrame !== undefined && frame !== resumeFrame) return
        resumeFrame = undefined

        if (frame === 0 || (EYES_OPEN_PAUSE_FRAMES.has(frame) && Math.random() < PAUSE_CHANCE)) {
          timer.cancel()
          resumeFrame = frame
          $.clock.after(PAUSE_MIN_MS + Math.random() * (PAUSE_MAX_MS - PAUSE_MIN_MS), play)
        }
      })
    }
    play()

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => {
    if (e.props.hasSurvey) {
      return next(e)
    }

    const { Text } = $.ui.resolve(e)

    return <Text color="claude">{render(cat)}</Text>
  })
}
