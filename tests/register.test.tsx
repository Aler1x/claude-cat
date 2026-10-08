import { describe, expect, mock, test } from 'claude-code/testing'

const BAND = {
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

describe('register', () => {
  test('the cat blinks: eyes close on the first frame and open on the next', async ($, on) => {
    const clock = mock.clock(on)
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })

    const ui = await $.ui.mount({ plugin: 'petit-chat', surface: 'terminal', ...BAND })
    const cat = async () => (await ui.find({ type: 'Text' }))?.text
    const open = await cat()

    await clock.advance(160)
    const closed = await cat()
    await clock.advance(160)

    expect(open).toMatch(/[⠁-⣿]/)
    expect(closed).not.toBe(open)
    expect(await cat()).toBe(open)
  })

  test('the cat gives the band to a survey', async ($, on) => {
    on('ui.render', ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text>survey</Text>
    })
    const ui = await $.ui.mount({
      plugin: 'petit-chat',
      surface: 'terminal',
      ...BAND,
      props: { ...BAND.props, hasSurvey: true },
    })

    expect((await ui.find({ type: 'Text' }))?.text).toBe('survey')
  })
})
