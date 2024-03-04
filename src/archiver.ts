import * as core from '@actions/core'
import { DefaultArtifactClient } from '@actions/artifact'
import { PullRequest } from '@octokit/webhooks-types' // eslint-disable-line import/no-unresolved
import * as fs from 'fs'
import * as path from 'path'
import { Score } from 'sizeup-core'
import { Configuration } from './configuration'
import { OptInStatus } from './initializer'

export async function createScoreArtifact(
  pull: PullRequest,
  score: Score,
  optInStatus: OptInStatus,
  config: Configuration
): Promise<void> {
  if (!config.archiving?.persistScoreArtifact) {
    core.info('Skipping score artifact creation')
    return
  }

  core.info('Creating score artifact')

  const tmpDir = path.resolve(__dirname, './tmp')
  const scoreFile = path.resolve(tmpDir, './sizeup-score/sizeup-score.csv')

  fs.mkdirSync(path.dirname(scoreFile), { recursive: true })
  fs.writeFileSync(scoreFile, scoreFileContents(pull, score, optInStatus))

  const client = new DefaultArtifactClient()
  await client.uploadArtifact('sizeup-score', [scoreFile], tmpDir, {
    retentionDays: config.archiving?.artifactRetention
  })
}

function scoreFileContents(
  pull: PullRequest,
  score: Score,
  optInStatus: OptInStatus
): string {
  const fields = [
    ['pull-request-number', `${pull.number}`],
    ['opted-in', `${optInStatus === OptInStatus.In}`],
    ['score', `${score.result}`],
    ['category', score.category?.name || ''],
    ['timestamp', `${Date.now()}`]
  ]

  const header = []
  const data = []
  for (const [key, value] of fields) {
    header.push(key)
    data.push(value)
  }

  return [header.join(','), data.join(',')].join('\n')
}
