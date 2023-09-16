/**
 * Unit tests for the action's main functionality, src/main.ts
 *
 * These should be run as if the action was called from a workflow.
 * Specifically, the inputs listed in `action.yml` should be set as environment
 * variables following the pattern `INPUT_<INPUT_NAME>`.
 */

import * as core from '@actions/core'
import * as main from '../src/main'
import * as github from '@actions/github'
import { Label } from '@octokit/webhooks-types' // eslint-disable-line import/no-unresolved

function pullRequestEventContext(labels: Label[] = []): object {
  return {
    eventName: 'pull_request',
    payload: {
      pull_request: {
        base: {
          repo: {
            name: 'sizeup-action',
            owner: {
              login: 'lerebear'
            }
          }
        },
        labels,
        number: 1,
        user: {
          login: 'lerebear'
        }
      }
    }
  }
}

describe('action', () => {
  // Mock the GitHub Actions core library
  const getInputMock = jest.spyOn(core, 'getInput')
  const octokitMock = jest.spyOn(github, 'getOctokit')
  const setOutputMock = jest
    .spyOn(core, 'setOutput')
    .mockImplementation(() => {})
  const setFailedMock = jest
    .spyOn(core, 'setFailed')
    .mockImplementation(() => {})

  // Suppress log statements
  jest.spyOn(core, 'info').mockImplementation(() => {})

  // Mock the action's main function
  const runMock = jest.spyOn(main, 'run')

  // Shallow clone original @actions/github context
  const originalContext = { ...github.context }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    // Restore original @actions/github context
    Object.defineProperty(github, 'context', { value: originalContext })
  })

  it('sets the score and category outputs', async () => {
    // Mock the @actions/github context.
    Object.defineProperty(github, 'context', {
      value: pullRequestEventContext()
    })

    // Set the action's inputs as return values from core.getInput()
    getInputMock.mockImplementation((name: string): string => {
      switch (name) {
        case 'token':
          return 'xxx'
        case 'configuration-file-path':
          return '__tests__/test-configuration.yaml'
        default:
          return ''
      }
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    octokitMock.mockImplementation((token: string): any => {
      if (token === 'xxx') {
        return {
          rest: {
            pulls: {
              get: () => {
                return { data: '' }
              }
            }
          }
        }
      }
    })

    await main.run()

    expect(runMock).toHaveReturned()
    expect(setOutputMock).toHaveBeenNthCalledWith(1, 'score', 0)
    expect(setOutputMock).toHaveBeenNthCalledWith(2, 'category', 'extra small')
  })

  it('sets a failed status when invoked for the wrong event', async () => {
    Object.defineProperty(github, 'context', { value: { eventName: 'push' } })

    await main.run()

    expect(runMock).toHaveReturned()
    expect(setFailedMock).toHaveBeenNthCalledWith(
      1,
      "This action is only supported on the 'pull_request' event, but it was triggered for 'push'"
    )
  })
})
