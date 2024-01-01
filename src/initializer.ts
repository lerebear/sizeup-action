import * as core from '@actions/core'
import { Configuration } from './configuration'
import * as fs from 'fs'
import * as path from 'path'
import * as YAML from 'yaml'
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
    core.info(`Reading sizeup configuration from "${configFile}"`)
  } else {
    core.info('Using default sizeup configuration')
    configFile = path.resolve(__dirname, './config/default.yaml')
  }

  return YAML.parse(fs.readFileSync(configFile, 'utf8')) as Configuration
}

/**
 *
 * @param pull The pull request that triggered this workflow
 * @param config The configuration for this workflow
 * @returns True if the pull request author has not opted into this workflow
 *   (meaning that we should quit early), false otherwise (meaning that we
 *   should proceed with evaluation of the pull request).
 */
export function pullRequestAuthorHasNotOptedIn(
  pull: PullRequest,
  config: Configuration
): boolean {
  const usersWhoHaveOptedin = config.optIns || []

  if (
    usersWhoHaveOptedin.length &&
    !usersWhoHaveOptedin.find((login: string) => login === pull.user.login)
  ) {
    core.info(
      `Skipping evaluation because pull request author @${pull.user.login} has not opted` +
        ' into this workflow'
    )
    return true
  }

  return false
}
