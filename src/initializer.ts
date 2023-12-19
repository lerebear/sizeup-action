import * as core from '@actions/core'
import * as github from '@actions/github'
import { Configuration } from './configuration'
import * as fs from 'fs'
import * as path from 'path'
import * as YAML from 'yaml'
import { simpleGit } from 'simple-git'
import { PullRequest } from '@octokit/webhooks-types' // eslint-disable-line import/no-unresolved

/**
 * Loads either the configuration file provided to the workflow, or the default
 * configuration file from "./config/default.yaml".
 *
 * @returns The configuration for this workflow run
 */
export function loadConfiguration(): Configuration {
  let configFile = core.getInput('configuration-file-path')

  if (configFile) {
    core.info(`Reading sizeup configuration from ${configFile}`)
  } else {
    core.info('Using default sizeup configuration')
    configFile = path.resolve(__dirname, './config/default.yaml')
  }

  return YAML.parse(fs.readFileSync(configFile, 'utf8')) as Configuration
}

/**
 * Retrieves the diff of the pull request that triggered this workflow which we
 * will use for evaluation.
 *
 * @param pull The pull request that triggered this workflow.
 * @returns The diff of the given pull request.
 */
export async function fetchDiff(pull: PullRequest): Promise<string> {
  const git = simpleGit('.', { trimmed: true })
  const diffArgs = ['--merge-base', `origin/${pull.base.ref}`].concat(
    core.getInput('git-diff-args').split(/\s+/)
  )

  core.info(`Retrieving diff with \`git diff ${diffArgs.join(' ')}\``)

  // Fetch all commits for the head branch back to where it diverged from the base.
  core.debug(`Fetching ${pull.commits + 1} commits for ${pull.head.ref}`)
  await git.fetch([
    'origin',
    `+${pull.head.ref}:${pull.head.ref}`,
    `--depth=${pull.commits + 1}`,
    '--no-tags',
    '--prune',
    '--no-recurse-submodules'
  ])

  core.debug(`Switching to branch ${pull.head.ref}`)
  await git.raw('switch', pull.head.ref)

  // Fetch commits for the base branch that were made since the head diverged from it.
  const divergedFrom = await git.raw('rev-list', '--max-parents=0', 'HEAD')
  const divergedAt = await git.show([
    '--quiet',
    '--date=unix',
    '--format=%cd',
    divergedFrom
  ])
  core.debug(
    `Retrieving history for origin/${pull.base.ref} since ${divergedFrom} which was committed at ${divergedAt}`
  )
  await git.fetch([
    'origin',
    `+${pull.base.ref}:${pull.base.ref}`,
    `--shallow-since=${divergedAt}`,
    '--no-tags',
    '--prune',
    '--no-recurse-submodules'
  ])

  // Now we have all relevant history from both base and head branches, so we
  // can compute an accurate diff relative to the base branch.
  return git.diff(diffArgs)
}

export function workflowTriggeredForUnsupportedEvent(): boolean {
  if (github.context.eventName !== 'pull_request') {
    core.setFailed(
      "This action is only supported on the 'pull_request' event, " +
        `but it was triggered for '${github.context.eventName}'`
    )
    return true
  }

  return false
}

export function pullRequestAuthorHasNotOptedIn(
  config: Configuration,
  pullRequest: PullRequest
): boolean {
  const usersWhoHaveOptedin = config.optIns || []

  if (
    usersWhoHaveOptedin.length &&
    !usersWhoHaveOptedin.find(
      (login: string) => login === pullRequest.user.login
    )
  ) {
    core.info(
      `Skipping evaluation because pull request author @${pullRequest.user.login} has not opted` +
        ' into this workflow'
    )
    return true
  }

  return false
}
