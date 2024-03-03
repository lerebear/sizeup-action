import * as core from '@actions/core'
import * as github from '@actions/github'
import { PullRequest } from '@octokit/webhooks-types' // eslint-disable-line import/no-unresolved
import { Score } from 'sizeup-core'
import { Configuration } from './configuration'
import { OptInStatus, configOrDefault } from './initializer'

const DEFAULT_COMMENT_TEMPLATE = `
👋 @{{author}} this pull request exceeds the configured reviewability score threshold of {{threshold}}. Your actual score was {{score}}.

[Research](https://www.cabird.com/static/93aba3256c80506d3948983db34d3ba3/rigby2013convergent.pdf) has shown that this makes it harder for reviewers to provide quality feedback.

We recommend that you reduce the size of this PR by separating commits into stacked PRs.
`
const DEFAULT_SCORE_THRESHOLD = 100

const COMMENT_METADATA =
  '<!-- data key="id" value=score-threshold-exceeded-comment -->'

/**
 * If the configuration requests it and this pull request exceeds the configured
 * score threshold, this adds a comment saying as much.
 *
 * @param pull The pull request under evaluation
 * @param score The score the pull request received from `sizeup`
 * @param config The configuration for this workflow run
 */
export async function addOrUpdateScoreThresholdExceededComment(
  pull: PullRequest,
  score: Score,
  optInStatus: OptInStatus,
  config: Configuration
): Promise<void> {
  const threshold = configOrDefault(
    config.commenting?.scoreThreshold,
    DEFAULT_SCORE_THRESHOLD
  )
  if (score.result <= threshold) return

  if (
    pull.draft &&
    configOrDefault(config.commenting?.excludeDraftPullRequests, true)
  ) {
    core.info('Skipping commenting on a draft pull request')
    return
  }

  if (optInStatus === OptInStatus.Shadow) {
    core.info(
      'Skipping commenting because this workflow is running in shadow mode'
    )
    return
  }

  const comment = scoreThresholdExceededComment(pull, score, config)

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

  const octokit = github.getOctokit(core.getInput('token'))

  const existingCommentId =
    await findExistingScoreThresholdExceededComment(pull)

  if (existingCommentId) {
    core.info('Updating existing comment on exceeding the score threshold')
    await octokit.rest.issues.updateComment({
      owner: pull.base.repo.owner.login,
      repo: pull.base.repo.name,
      comment_id: existingCommentId,
      body: comment
    })
  } else {
    core.info(
      'Adding comment to pull request noting that the score threshold has been exceeded'
    )
    await octokit.rest.issues.createComment({
      owner: pull.base.repo.owner.login,
      repo: pull.base.repo.name,
      issue_number: pull.number,
      body: comment
    })
  }
}

async function findExistingScoreThresholdExceededComment(
  pull: PullRequest
): Promise<number | undefined> {
  const octokit = github.getOctokit(core.getInput('token'))
  const comments = await octokit.paginate(octokit.rest.issues.listComments, {
    owner: pull.base.repo.owner.login,
    repo: pull.base.repo.name,
    issue_number: pull.number
  })
  const existingComment = comments.find(
    c => c.body?.startsWith(COMMENT_METADATA)
  )
  return existingComment?.id
}

function scoreThresholdExceededComment(
  pull: PullRequest,
  score: Score,
  config: Configuration
): string {
  const threshold = configOrDefault(
    config.commenting?.scoreThreshold,
    DEFAULT_SCORE_THRESHOLD
  )

  const commentTemplate =
    config.commenting?.commentTemplate !== undefined
      ? config.commenting?.commentTemplate
      : DEFAULT_COMMENT_TEMPLATE

  const detailsElement = `<details>
<summary>Score details</summary>
<pre>
${score.toString()}
</pre>
</details>
`

  const comment = commentTemplate
    .replaceAll('{{author}}', pull.user.login)
    .replaceAll('{{score}}', `${score.result}`)
    .replaceAll('{{category}}', score.category!.name)
    .replaceAll('{{threshold}}', `${threshold}`)
    .replaceAll('{{score-details}}', detailsElement)

  return `${COMMENT_METADATA}\n\n${comment}`
}
