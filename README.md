# SizeUp Action

This repository contains a GitHub Action that wraps the [`sizeup` library](https://github.com/lerebear/sizeup-core) in order to provide a way to estimate the reviewability of a pull request as it goes through its lifecycle on GitHub.

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
      # Check out a copy of this repository so we can load the configuration
      # file for Action later on.
      - name: Checkout this repository
        uses: actions/checkout@v3

      # Run the estimation tool
      - name: Run sizeup
        # TODO: Replace the version below with your desired version.
        uses: lerebear/sizeup-action@v0.2.1
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

          # Path to a YAML configuration file for this Action that is stored in
          # this repository.
          #
          # This input defaults to "", which instructs the Action to use the
          # built-in default configuration.
          configuration-file-path: ".github/workflows/sizeup/config.yaml"
```

This will use `sizeup` to estimate the reviewability of any pull request opened on your repository using a YAML configuration file found at `.github/workflows/sizeup/config.yaml`. The format of the configuration file is described below.

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

For details about what configuration can be provided under the `sizeup` key, please see the [`sizeup-core` library's configuration guide](https://github.com/lerebear/sizeup-core#configuration).

## Development

This section contains notes for how to develop this library.

### Building the distributed code for this Action

As is common for Actions, this repository contains the distributed code for this Action in the [`dist`](./dist/) directory. As a result, any change to a file in [`src`](./src/) or to [`package.json`](./package.json) must also be accompanied by manual compilation. This should be done with the following command:

```sh
npm run all
```

The result of that command (changes to the [`dist`](./dist) directory and other generated files) should be included in the same commit that changes the source.

### Regenerating the Typescript interface for the configuration schema

Follow the same [procedure](https://github.com/lerebear/sizeup-core#regenerating-the-typescript-interface-for-the-configuration-schema) outlined for this process in the `sizeup-core` repository.
