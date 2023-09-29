# SizeUp Action

This repository contains a GitHub Action that wraps the [`sizeup` library](https://github.com/lerebear/sizeup) in order to provide a way to estimate the reviewability of a pull request as it goes through its lifecycle on GitHub.

## Usage

See [`action.yml`](./action.yml)

```yaml
- name: Estimate pull request reviewability
  uses: lerebear/sizeup-action@main
  id: sizeup-action
  with:
    # A GitHub API token capable of reading pull requests on the repository
    # in which this workflow is being used.
    #
    # A good default value is the default `GITHUB_TOKEN` secret used below.
    token: '${{ secrets.GITHUB_TOKEN }}'

    # Path to a YAML configuration file for the sizeup library.
    # To learn about which configuration values are supported, see:
    # https://github.com/lerebear/sizeup#configuration
    #
    # Default: '' (which instructs the Action to use the default configuration)
    configuration-file: ''
```
