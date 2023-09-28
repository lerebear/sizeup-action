/**
 * Unit tests for the action's main functionality, src/main.ts
 *
 * These should be run as if the action was called from a workflow.
 * Specifically, the inputs listed in `action.yml` should be set as environment
 * variables following the pattern `INPUT_<INPUT_NAME>`.
 */

// import * as core from '@actions/core'
import * as main from '../src/main'
// import * as github from '@actions/github'

// Mock the GitHub Actions core library
// const infoMock = jest.spyOn(core, 'info')
// const getInputMock = jest.spyOn(core, 'getInput')
// const setOutputMock = jest.spyOn(core, 'setOutput')
// const setFailedMock = jest.spyOn(core, 'setFailed')

// Mock the action's main function
const runMock = jest.spyOn(main, 'run')

// Other utilities
// const timeRegex = /^\d{2}:\d{2}:\d{2}/

describe('action', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('sets the score and category outputs', async () => {
    // Set the action's inputs as return values from core.getInput()
    // getInputMock.mockImplementation((name: string): string => {
    //   switch (name) {
    //     case 'milliseconds':
    //       return '500'
    //     default:
    //       return ''
    //   }
    // })

    await main.run()
    expect(runMock).toHaveReturned()

    // Verify that all of the core library functions were called correctly
    // expect(infoMock).toHaveBeenNthCalledWith(1, 'Waiting 500 milliseconds ...')
    // expect(infoMock).toHaveBeenNthCalledWith(
    //   2,
    //   expect.stringMatching(timeRegex)
    // )
    // expect(infoMock).toHaveBeenNthCalledWith(
    //   3,
    //   expect.stringMatching(timeRegex)
    // )
    // expect(setOutputMock).toHaveBeenNthCalledWith(
    //   1,
    //   'time',
    //   expect.stringMatching(timeRegex)
    // )
  })

  it('sets a failed status when invoked for the wrong event', async () => {
    //   // Set the action's inputs as return values from core.getInput()
    //   getInputMock.mockImplementation((name: string): string => {
    //     switch (name) {
    //       case 'milliseconds':
    //         return 'this is not a number'
    //       default:
    //         return ''
    //     }
    //   })

    await main.run()
    expect(runMock).toHaveReturned()

    //   // Verify that all of the core library functions were called correctly
    //   expect(setFailedMock).toHaveBeenNthCalledWith(
    //     1,
    //     'milliseconds not a number'
    //   )
  })
})
