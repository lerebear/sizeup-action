import * as core from '@actions/core'
import * as github from '@actions/github'
import { PullRequest, Label } from '@octokit/webhooks-types' // eslint-disable-line import/no-unresolved
import { SizeUp, Score } from 'sizeup-core'
import * as YAML from 'yaml'
import * as fs from 'fs'
import * as path from 'path'
import { Configuration } from './configuration'
import {
  fetchDiff,
  loadConfiguration,
  pullRequestAuthorHasNotOptedIn,
  workflowTriggeredForUnsupportedEvent
} from './initializer'

const DEFAULT_LABEL_PREFIX = 'sizeup/'
const DEFAULT_COMMENT_TEMPLATE = `
👋 @{{author}} this pull request exceeds the configured reviewability score threshold of {{threshold}}. Your actual score was {{score}}.

[Research](https://www.cabird.com/static/93aba3256c80506d3948983db34d3ba3/rigby2013convergent.pdf) has shown that this makes it harder for reviewers to provide quality feedback.

We recommend that you reduce the size of this PR by separating commits into stacked PRs.
`
const DEFAULT_SCORE_THRESHOLD = 100

/**
 * The main function for the action.
 *
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    if (workflowTriggeredForUnsupportedEvent()) return

    const config = loadConfiguration()
    const pullRequest = github.context.payload.pull_request as PullRequest

    if (pullRequestAuthorHasNotOptedIn(config, pullRequest)) return

    const score = await evaluatePullRequest(pullRequest, config)

    await applyCategoryLabel(pullRequest, score, config)
    await addScoreThresholdExceededComment(pullRequest, score, config)
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

/**
 * Uses the `sizeup` library to evalute the given pull request for reviewability
 *
 * @param pull The pull request to be evaluated. This should have been retrieved from the
 *   workflow run context.
 * @param config The configuration to use for evaluation. This should be provided in the format
 *   supported by this Action, which is is a superset of the actual configuration that is passed
 *   to the `sizeup` library.
 * @returns The score that the pull request received
 */
async function evaluatePullRequest(
  pull: PullRequest,
  config: Configuration
): Promise<Score> {
  const pullRequestNickname = `${pull.base.repo.owner.login}/${pull.base.repo.name}#${pull.number}`
  core.info(`Evaluating pull request ${pullRequestNickname}`)

  let sizeupConfigFile = undefined
  if (config.sizeup) {
    sizeupConfigFile = path.resolve(__dirname, './tmp/sizeup.yaml')
    fs.mkdirSync(path.dirname(sizeupConfigFile))
    fs.writeFileSync(sizeupConfigFile, YAML.stringify(config.sizeup))
  }

  const diff = await fetchDiff(pull)
  const score = SizeUp.evaluate(diff, sizeupConfigFile)

  if (sizeupConfigFile) {
    fs.rmSync(sizeupConfigFile, { force: true, recursive: true })
  }

  core.info(
    `${pullRequestNickname} received a score of ${score.result} (${
      score.category!.name
    })`
  )
  core.info(`The score was computed as follows:\n${score.toString()}`)
  core.setOutput('score', score.result)
  core.setOutput('category', score.category!.name)

  return score
}

/**
 * Applies a score category label to the pull request if the configuration
 * requests that we do so.
 *
 * @param pull The pull request under evaluation
 * @param score The score the pull request received from `sizeup`
 * @param config The configuration for this workflow run
 */
async function applyCategoryLabel(
  pull: PullRequest,
  score: Score,
  config: Configuration
): Promise<void> {
  if (!score.category?.label) {
    core.info('Skipping labeling because no category label was provided')
    return
  }

  if (
    pull.draft &&
    configOrDefault(config.labeling?.excludeDraftPullRequests, false)
  ) {
    core.info('Skipping labeling of a draft pull request')
    return
  }

  await ensureLabelExists(pull, score, config)
  await applyLabel(pull, score, config)
}

/**
 * If necessary, creates the appropriate category label on the base repository
 * of the pull request.
 *
 * @param pull The pull request under evaluation
 * @param score The score the pull request received from `sizeup`
 * @param config The configuration for this workflow run
 */
async function ensureLabelExists(
  pull: PullRequest,
  score: Score,
  config: Configuration
): Promise<Label | undefined> {
  let response
  const label = score.category!.label!
  const prefix = configOrDefault(
    config.labeling?.categoryLabelPrefix,
    DEFAULT_LABEL_PREFIX
  )
  const prefixedLabelName = `${prefix}${label.name}`
  const octokit = github.getOctokit(core.getInput('token'))

  try {
    response = await octokit.rest.issues.getLabel({
      owner: pull.base.repo.owner.login,
      repo: pull.base.repo.name,
      name: prefixedLabelName
    })
  } catch (e) {
    if (configOrDefault(config.labeling?.applyCategoryLabels, true)) {
      core.info(`Creating new label "${prefixedLabelName}"`)
      response = await octokit.rest.issues.createLabel({
        owner: pull.base.repo.owner.login,
        repo: pull.base.repo.name,
        ...label,
        name: prefixedLabelName
      })
    } else {
      core.info(`Would have created new label "${prefixedLabelName}"`)
    }
  }

  return response?.data
}

/**
 * Applies a score category label to the pull request if the configuration
 * requests that we do so.
 *
 * @param pull The pull request under evaluation
 * @param score The score the pull request received from `sizeup`
 * @param config The configuration for this workflow run
 */
async function applyLabel(
  pull: PullRequest,
  score: Score,
  config: Configuration
): Promise<void> {
  const octokit = github.getOctokit(core.getInput('token'))
  const labelPrefix = configOrDefault(
    config.labeling?.categoryLabelPrefix,
    DEFAULT_LABEL_PREFIX
  )
  const newLabelName = `${labelPrefix}${score.category!.label!.name}`
  const labelsToAdd = [newLabelName]
  const labelsToRemove = []

  for (const existingLabel of pull.labels) {
    if (existingLabel.name === newLabelName) {
      labelsToAdd.pop()
    } else if (existingLabel.name.startsWith(labelPrefix)) {
      labelsToRemove.push(existingLabel.name)
    }
  }

  if (
    labelsToAdd.length &&
    configOrDefault(config.labeling?.applyCategoryLabels, true)
  ) {
    core.info(`Applying category label "${labelsToAdd[0]}"`)
    await octokit.rest.issues.addLabels({
      owner: pull.base.repo.owner.login,
      repo: pull.base.repo.name,
      issue_number: pull.number,
      labels: labelsToAdd
    })
  } else if (labelsToAdd.length) {
    core.info(`Would have applied category label "${labelsToAdd[0]}"`)
  } else {
    core.info(
      `Correct "${newLabelName}" category label has already been applied`
    )
  }

  for (const labelName of labelsToRemove) {
    if (configOrDefault(config.labeling?.applyCategoryLabels, true)) {
      core.info(`Removing stale category label "${labelName}"`)
      try {
        await octokit.rest.issues.removeLabel({
          owner: pull.base.repo.owner.login,
          repo: pull.base.repo.name,
          issue_number: pull.number,
          name: labelName
        })
      } catch (e) {
        core.warning(`Failed to remove label "${labelName}"`)
      }
    } else {
      core.info(`Would have removed stale category label "${labelName}`)
    }
  }
}

/**
 * If the configuration requests it and this pull request exceeds the configured
 * score threshold, this adds a comment saying as much.
 *
 * @param pull The pull request under evaluation
 * @param score The score the pull request received from `sizeup`
 * @param config The configuration for this workflow run
 */
async function addScoreThresholdExceededComment(
  pull: PullRequest,
  score: Score,
  config: Configuration
): Promise<void> {
  const threshold = configOrDefault(
    config.commenting?.scoreThreshold,
    DEFAULT_SCORE_THRESHOLD
  )
  if (score.result! <= threshold) return

  if (
    pull.draft &&
    configOrDefault(config.commenting?.excludeDraftPullRequests, true)
  ) {
    core.info('Skipping commenting on a draft pull request')
    return
  }

  const commentTemplate =
    config.commenting?.commentTemplate !== undefined
      ? config.commenting?.commentTemplate
      : DEFAULT_COMMENT_TEMPLATE

  const comment = commentTemplate
    .replaceAll('{{author}}', pull.user.login)
    .replaceAll('{{score}}', `${score.result!}`)
    .replaceAll('{{category}}', score.category!.name)
    .replaceAll('{{threshold}}', `${threshold}`)

  if (
    !configOrDefault(
      config.commenting?.addCommentWhenScoreThresholdHasBeenExceeded,
      true
    )
  ) {
    const indentedComment = comment
      .split('\n')
      .map(l => `  ${l}`)
      .join('\n')
    core.info(
      `Would have added the following comment to the pull request:\n${indentedComment}`
    )
    return
  }

  core.info(
    'Adding comment to pull request noting that the score threshold has been exceeded'
  )

  const octokit = github.getOctokit(core.getInput('token'))
  await octokit.rest.issues.createComment({
    owner: pull.base.repo.owner.login,
    repo: pull.base.repo.name,
    issue_number: pull.number,
    body: comment
  })
}

/**
 * If necessary, provides a default for an undefined configuration value.
 *
 * @param value The raw value from the configuration file
 * @param defaultValue The value to use if the raw value is undefined
 * @returns The final value to use for the configuration
 */
function configOrDefault<T>(value: T | undefined, defaultValue: T): T {
  return value !== undefined ? value : defaultValue
}
