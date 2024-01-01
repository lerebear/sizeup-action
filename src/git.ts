import * as core from '@actions/core'
import * as lib from 'simple-git'

export class Git {
  private client: lib.SimpleGit

  constructor() {
    const basicCredential = Buffer.from(
      `x-access-token:${core.getInput('token')}`,
      'utf8'
    ).toString('base64')
    const authorizationHeader = `AUTHORIZATION: basic ${basicCredential}`
    core.setSecret(basicCredential)

    this.client = lib.simpleGit('.', {
      trimmed: true,
      config: [`http.extraheader=${authorizationHeader}`]
    })
  }

  /**
   * Clones the repository from which this workflow was triggered.
   *
   * @param repo The repository to clone in the format "<owner>/<name>"
   * @param headRef The single branch to clone, which should correspond to the
   *   head ref of the pull request that triggered this workflow. This is
   *   required for efficiency.
   * @param targetDirectory The directory in which to clone the repository.
   */
  async clone(
    repo: string,
    headRef: string,
    targetDirectory = '.'
  ): Promise<void> {
    core.debug(`Cloning ${repo} with the single branch "${headRef}"`)

    await this.client.clone(`https://github.com/${repo}`, targetDirectory, [
      `--branch=${headRef}`,
      '--filter=tree:0',
      '--no-tags',
      '--single-branch'
    ])
  }

  /**
   * Retrieves the diff of the pull request that triggered this workflow which we
   * will use for evaluation.
   *
   * @param baseRef The base branch relative to which we should produce a diff. This method assumes
   *   that the head ref containing changes relative to this base ref has already been fetched using
   *   the `headRef` argument to the `clone` method.
   * @returns The diff of the given pull request or `undefined` if we failed to retrieve it.
   */
  async diff(baseRef: string): Promise<string> {
    core.debug(`Fetching base ref "${baseRef}"`)
    await this.client.fetch([
      'origin',
      `+${baseRef}:${baseRef}`,
      `--filter=tree:0`,
      '--no-tags',
      '--prune',
      '--no-recurse-submodules'
    ])

    const diffArgs = ['--merge-base', baseRef].concat(
      core.getInput('git-diff-options').split(/\s+/)
    )
    core.info(`Retrieving diff with \`git diff ${diffArgs.join(' ')}\``)
    return this.client.diff(diffArgs)
  }
}
