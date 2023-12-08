# Development

This document contains notes for how to develop this library.

## Building the distributed code for this Action

As is common for Actions, this repository contains the distributed code for this Action in the [`dist`](./dist/) directory. As a result, any change to a file in [`src`](./src/) or to [`package.json`](./package.json) must also be accompanied by manual compilation. This should be done with the following command:

```sh
npm run all
```

The result of that command (changes to the [`dist`](./dist) directory and other generated files) should be included in the same commit that changes the source.

## Regenerating the Typescript interface for the configuration schema

Follow the same [procedure](https://github.com/lerebear/sizeup-core#regenerating-the-typescript-interface-for-the-configuration-schema) outlined for this process in the `sizeup-core` repository.
