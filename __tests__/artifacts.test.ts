import { Score } from 'sizeup-core'
import * as artifacts from '../src/artifacts'
import { OptInStatus } from '../src/initializer'
import { PullRequest } from '@octokit/webhooks-types' // eslint-disable-line import/no-unresolved

describe('scoreFileContents', () => {
  const pullRequest = {
    base: {
      ref: 'main',
      repo: {
        full_name: 'lerebear/sizeup-action',
        name: 'sizeup-action',
        owner: {
          login: 'lerebear'
        }
      }
    },
    head: {
      ref: 'topic'
    },
    number: 42,
    draft: false,
    user: {
      login: 'lerebear'
    }
  } as PullRequest

  const score = { result: 20, category: { name: 'small' } } as unknown as Score

  it('can produce a csv', () => {
    const [header, row] = artifacts
      .scoreFileContents(pullRequest, score, OptInStatus.In, 'csv')
      .split('\n')

    expect(header).toEqual(
      'pull.number,pull.draft,opted-in,score,category,timestamp'
    )
    expect(row.split(',').slice(0, -1).join(',')).toEqual(
      '42,false,true,20,small'
    )
  })

  it('can produce json', () => {
    const json = JSON.parse(
      artifacts.scoreFileContents(pullRequest, score, OptInStatus.In, 'json')
    )

    expect(json['pull.number']).toEqual(42)
    expect(json['pull.draft']).toEqual(false)
    expect(json['opted-in']).toEqual(true)
    expect(json['score']).toEqual(20)
    expect(json['category']).toEqual('small')
    expect(json['timestamp']).toBeDefined()
  })
})
