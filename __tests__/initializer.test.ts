import * as core from '@actions/core'
import * as initializer from '../src/initializer'

describe('initializer', () => {
  const infoMock = jest.spyOn(core, 'info').mockImplementation(() => {})

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('uses the default configuration when no config file is provided', () => {
    jest.spyOn(core, 'getInput').mockImplementation((name: string): string => {
      switch (name) {
        case 'configuration-file-path':
          return ''
        default:
          return 'foo'
      }
    })

    const config = initializer.loadConfiguration()

    expect(config).toBeDefined()
    expect(infoMock).toHaveBeenCalledWith('Using default sizeup configuration')
  })

  it('can load a custom configuration file', () => {
    jest.spyOn(core, 'getInput').mockImplementation((name: string): string => {
      switch (name) {
        case 'configuration-file-path':
          return '__tests__/test-configuration.yaml'
        default:
          return ''
      }
    })
    const config = initializer.loadConfiguration()

    expect(config).toBeDefined()
    expect(infoMock).toHaveBeenCalledWith(
      'Reading sizeup configuration from "__tests__/test-configuration.yaml"'
    )
  })
})
