# SizeUp Action

This repository contains a GitHub Action that wraps the [`sizeup` library](https://github.com/lerebear/sizeup-core) in order to provide a way to estimate the reviewability of a pull request as it goes through its lifecycle on GitHub.

## Usage

See [`action.yml`](./action.yml)

```yaml
- name: Estimate pull request reviewability
  uses: lerebear/sizeup-action@v0
  id: sizeup-action
  with:
    # A GitHub API token capable of reading pull requests on the repository
    # in which this workflow is being used.
    #
    # A good default value is the default `GITHUB_TOKEN` secret used below.
    token: "${{ secrets.GITHUB_TOKEN }}"

    # Path to a YAML configuration file for this action that is stored in this
    # repository. To use this, you must add a workflow step prior to this one
    # that uses `actions/checkout` to checkout a local copy of the repository
    # so that we can resolve the path to the config file.
    #
    # To learn about which configuration values are supported, see:
    # https://github.com/lerebear/sizeup-action#configuration
    #
    # Default: "" (which instructs the Action to use the default configuration)
    configuration-file: ""
```

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
        name: sl
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

For details on what configuration can be provided under the `sizeup` key, please see the [`sizeup-core` library's configuration guide](https://github.com/lerebear/sizeup-core#configuration).

## Development

This section contains notes for how to develop this library.

### Regenerating the Typescript interface for the configuration schema

Follow the same [procedure](https://github.com/lerebear/sizeup-core#regenerating-the-typescript-interface-for-the-configuration-schema) outlined for this process in the `sizeup-core` repository.
