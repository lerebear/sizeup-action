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
  const git = simpleGit()
  const diffArgs = ['--merge-base', pull.base.sha].concat(
    core.getInput('git-diff-args').split(/\s+/)
  )
  core.info(`Retrieving diff with \`git diff ${diffArgs.join(' ')}\``)
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
