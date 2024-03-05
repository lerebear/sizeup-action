import * as core from '@actions/core'
import * as github from '@actions/github'
import { PullRequest, Label } from '@octokit/webhooks-types' // eslint-disable-line import/no-unresolved
import { SizeUp, Score } from 'sizeup-core'
import * as YAML from 'yaml'
import * as fs from 'fs'
import * as path from 'path'
import { Configuration } from './configuration'
import {
  configOrDefault,
  loadConfiguration,
  getOptInStatus,
  OptInStatus
} from './initializer'
import { Git } from './git'
import { addOrUpdateScoreThresholdExceededComment } from './commenting'
import { createScoreArtifact } from './artifacts'

const DEFAULT_LABEL_PREFIX = 'sizeup/'

/**
 * The main function for the action.
 *
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    if (github.context.eventName !== 'pull_request') {
      core.setFailed(
        "This action is only supported on the 'pull_request' event, " +
          `but it was triggered for '${github.context.eventName}'`
      )
      return
    }

    const pullRequest = github.context.payload.pull_request as PullRequest

    const git = new Git()
    await git.clone(pullRequest.base.repo.full_name, pullRequest.head.ref)

    const config = loadConfiguration()
    const optInStatus = getOptInStatus(pullRequest, config)
    if (optInStatus === OptInStatus.Out) return

    const diff = await git.diff(pullRequest.base.ref)
    const score = await evaluatePullRequest(pullRequest, diff, config)
    await applyCategoryLabel(pullRequest, score, optInStatus, config)
    await addOrUpdateScoreThresholdExceededComment(
      pullRequest,
      score,
      optInStatus,
      config
    )
    await createScoreArtifact(pullRequest, score, optInStatus, config)
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
  diff: string,
  config: Configuration
): Promise<Score> {
  const pullRequestNickname = `${pull.base.repo.full_name}#${pull.number}`
  core.info(`Evaluating pull request ${pullRequestNickname}`)

  let sizeupConfigFile = undefined
  if (config.sizeup) {
    sizeupConfigFile = path.resolve(__dirname, './tmp/sizeup.yaml')
    fs.mkdirSync(path.dirname(sizeupConfigFile))
    fs.writeFileSync(sizeupConfigFile, YAML.stringify(config.sizeup))
  }

  const score = SizeUp.evaluate(diff, sizeupConfigFile)

  if (sizeupConfigFile) {
    fs.rmSync(sizeupConfigFile, { force: true, recursive: true })
  }

  core.info(
    `Pull request ${pullRequestNickname} received a score of ${score.result} (${
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
  optInStatus: OptInStatus,
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

  if (optInStatus === OptInStatus.Shadow) {
    core.info(
      'Skipping labeling because this workflow is running in shadow mode'
    )
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

  const existingLabels = await octokit.paginate(
    octokit.rest.issues.listLabelsOnIssue,
    {
      owner: pull.base.repo.owner.login,
      repo: pull.base.repo.name,
      issue_number: pull.number
    }
  )
  for (const existingLabel of existingLabels) {
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
