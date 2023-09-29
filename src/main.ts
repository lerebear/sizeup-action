import * as core from '@actions/core'
import * as github from '@actions/github'
import { PullRequest } from '@octokit/webhooks-types' // eslint-disable-line import/no-unresolved
import SizeUp from 'sizeup'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    if (github.context.eventName !== 'pull_request') {
      core.info(JSON.stringify(github))
      core.info(JSON.stringify(github.context))
      core.setFailed(
        "This action is only supported on the 'pull_request' event, " +
          `but it was triggered for '${github.context.eventName}'`
      )
      return
    }

    const config: string = core.getInput('configuration-file')
    if (config) {
      core.info(`Reading sizeup configuration from ${config}`)
    } else {
      core.info('Using default sizeup configuration')
    }

    core.debug(`github.context: ${JSON.stringify(github.context)}`)
    const pullRequest = github.context.payload.pull_request as PullRequest

    // Parses a URL that looks like: https://api.github.com/repos/lerebear/sizeup/pulls/1
    const [_scheme, _blank, _domain, _route, owner, repo, _subRoute, number] = // eslint-disable-line @typescript-eslint/no-unused-vars
      pullRequest.url.split('/')

    core.debug(`pull request: ${owner}/${repo}#${number}`)
    const octokit = github.getOctokit(core.getInput('token'))
    const diff = (
      await octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: Number.parseInt(number, 10),
        mediaType: { format: 'diff' }
      })
    ).data as unknown as string

    const score = SizeUp.evaluate(diff, config)

    core.info(`Computed score:\n${score.toString()}`)
    core.setOutput('score', score.value)
    core.setOutput('category', score.category)
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}
