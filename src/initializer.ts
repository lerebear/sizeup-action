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

export enum OptInStatus {
  In = 1, // The user has opted into the full behaviour of this workflow.
  Out, // The user has opted out of the workflow, so it should be aborted.
  Shadow // The user has opted out but we're running in shadow mode so we should continue silently.
}

/**
 *
 * @param pull The pull request that triggered this workflow
 * @param config The configuration for this workflow
 * @returns A status indicating how to continue running the rest of the workflow.
 */
export function getOptInStatus(
  pull: PullRequest,
  config: Configuration
): OptInStatus {
  const usersWhoHaveOptedin = config.optIns || []
  const userHasOptedOut =
    usersWhoHaveOptedin.length &&
    !usersWhoHaveOptedin.find((login: string) => login === pull.user.login)

  if (userHasOptedOut && config.shadowOptOuts) {
    core.info('Executing workflow silently for user who was not opted in')
    return OptInStatus.Shadow
  } else if (userHasOptedOut) {
    core.info(
      `Skipping evaluation because pull request author @${pull.user.login} has not opted` +
        ' into this workflow'
    )
    return OptInStatus.Out
  } else {
    return OptInStatus.In
  }
}

/**
 * If necessary, provides a default for an undefined configuration value.
 *
 * @param value The raw value from the configuration file
 * @param defaultValue The value to use if the raw value is undefined
 * @returns The final value to use for the configuration
 */
export function configOrDefault<T>(value: T | undefined, defaultValue: T): T {
  return value !== undefined ? value : defaultValue
}
