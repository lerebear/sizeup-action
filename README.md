# SizeUp Action

This GitHub Action helps you encourage your contributors to open pull requests that will be easy to digest by reviewers. It does this by providing two  features:

* Automatic labeling of pull requests with a size category.
* Automatic commenting on pull requests that exceed a certain size threshold.

All aspects of this Action are [configurable](#configuration), including how sizes are calculated, what thresholds to use for each size category, and whether or not to actually perform the above automations or only to log them.

## Usage

[Create an Actions workflow](https://docs.github.com/en/actions/quickstart) in your desired repository (e.g. `.github/workflows/sizeup.yaml`) with the following contents:

```yaml
name: SizeUp

on: pull_request

permissions:
  contents: read
  issues: write
  pull-requests: write

jobs:
  sizeup:
    name: Estimate reviewability
    runs-on: ubuntu-latest

    steps:
      - name: Run sizeup
        # TODO: Replace the version below with your desired version.
        #
        # For more details please see:
        # https://github.com/lerebear/sizeup-action/blob/main/README.md#versioning
        uses: lerebear/sizeup-action@v0.4.2
        id: sizeup-action

        with:
          # A GitHub API token capable of reading pull requests from this
          # repository.
          #
          # In this example, we've used the `permissions` key above to request
          # the necessary permissions for the default `GITHUB_TOKEN` secret,
          # and then we've passed it along here.
          #
          # This input is required.
          token: "${{ secrets.GITHUB_TOKEN }}"

          # Options that will be forwarded to `git diff` when computing the
          # diff to evaluate with this workflow.
          #
          # Defaults to "--ignore-space-change", which ignores lines of the
          # diff in which the only change is to the amount of whitespace on the
          # line.
          git-diff-options: ""

          # Path to a YAML configuration file for this workflow that is stored
          # in this repository.
          #
          # This input defaults to "", which instructs the workflow to use the
          # built-in default configuration.
          configuration-file-path: ".github/workflows/sizeup/config.yaml"
```

This will use [`sizeup`](https://github.com/lerebear/sizeup-core) to estimate the reviewability of any pull request opened on your repository using a YAML configuration file found at `.github/workflows/sizeup/config.yaml`. The format of the configuration file is described below.

Please note that the workflow configuration above does not use [`actions/checkout`](https://github.com/actions/checkout). This is because `actions/checkout` does not provide enough options to make a customized `git diff` command maximally efficient. Instead, this Action will perform its own clone, fetch, and checkout operations using the provided `token`.

## Versioning

This Action follows [semantic versioning conventions](https://semver.org), but is still <1.0. Thus, as is common for pre-1.0 software, breaking changes are  sometimes introduced in minor version bumps (although patch version bumps will only contain backwards-compatible bug fixes). Please bear this in mind when choosing the version of this Action that you would like to use.

## Configuration

This Action can be configured by specifying the `configuration-file` input. The value of that input should be the path to a YAML file that contains configuration for this Action and the underlying `sizeup` library.

An example configuration file looks like this:

```yaml
labeling:

  # Whether or not to add a label to each pull request to indicate its assessed category
  applyCategoryLabels: true

  # The prefix to add to each category label that we apply.
  categoryLabelPrefix: "sizeup/"

commenting:

  # Whether or not to comment on pull requests that exceed the configured score threshold
  addCommentWhenScoreThresholdHasBeenExceeded: true

  # The threshold above which we will add a comment to the assessed pull request.
  scoreThreshold: 100

  # The template for the comment that should be added to each pull request that
  # exceeds the score threshold. Any of the following variables can be included
  # in the template with surrounding curly braces (e.g. {{author}}) in order to
  # interpolate a computed value into the comment:
  #
  #   - author
  #   - threshold
  #   - score
  #   - category
  commentTemplate: |
    👋 @{{author}} this pull request exceeds the configured reviewability score threshold of {{threshold}}. Your actual score was {{score}}.

# List of users for whom we should run this workflow
optIns:
  - lerebear
  - glortho

# Configuration for how to evaluate pull requests.
# This is of the same format that `sizeup-core` accepts directly.
sizeup:
  categories:
    - name: extra small
      lte: 10
      label:
        name: xs
        color: 3cbf00
    - name: small
      lte: 30
      label:
        name: s
        color: 5d9801
    - name: medium
      lte: 100
      label:
        name: m
        color: 7f7203
    - name: large
      lte: 500
      label:
        name: l
        color: a14c05
    - name: extra large
      label:
        name: xl
        color: c32607
  ignoredFilePatterns:
    - CODEOWNERS
    - SERVICEOWNERS
  testFilePatterns:
    - "*_test.rb"
  scoring:
    formula: "- - + additions deletions comments whitespace"
```

The default configuration that is used when no configuration file is provided can be found in [`src/config/default.yaml`](./src/config/default.yaml).

The full specification for the configuration file is provide by the JSON schema at [`src/config/schema.json`](./src/config/schema/json).

For details about what configuration can be provided under the `sizeup` key, please see the [`sizeup-core` library's configuration guide](https://github.com/lerebear/sizeup-core#configuration).
