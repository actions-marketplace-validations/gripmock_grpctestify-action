# gRPC Testify GitHub Action

Simple GitHub Action to install and use [`grpctestify`](https://github.com/gripmock/grpctestify-rust) in CI.

What it does:

- installs `grpctestify` from GitHub Release binaries (fast path, no Rust toolchain)
- adds binary directory to `PATH`
- optionally runs one command: `run`, `check`, or `fmt`

## Quick start

```yaml
name: test

on: [push, pull_request]

jobs:
  grpc-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5

      - name: Run grpctestify
        uses: gripmock/grpctestify-action@v1
        with:
          version: 1.4.10
          command: run
          path: tests/greeter.gctf
```

## Inputs

| Input | Default | Description |
| --- | --- | --- |
| `version` | `latest` | grpctestify version (`latest`, `1.4.10`, `v1.4.10`) |
| `github-token` | `""` | Optional token for GitHub API fallback when resolving `latest` |
| `install-only` | `false` | Only install and export binary path to `PATH` |
| `command` | `run` | Command to run: `run`, `check`, `fmt` |
| `path` | `""` | Primary file/directory argument |
| `paths` | `""` | Additional path arguments, one per line |

Notes:

- For `command: run` and no path provided, action uses `.` by default.
- For `command: check` / `command: fmt`, at least one path is required.

## Outputs

| Output | Description |
| --- | --- |
| `version` | Resolved grpctestify version |
| `binary-path` | Full path to downloaded binary |
| `command-line` | Executed command args (without binary path) |
| `exit-code` | Process exit code |

## Examples

Install only:

```yaml
- name: Install grpctestify
  uses: gripmock/grpctestify-action@v1
  with:
    install-only: true
    version: 1.4.10

- name: Use in custom script
  run: grpctestify --version
```

Run `check`:

```yaml
- uses: gripmock/grpctestify-action@v1
  with:
    command: check
    path: tests/**/*.gctf
```

Run `fmt` for multiple files:

```yaml
- uses: gripmock/grpctestify-action@v1
  with:
    command: fmt
    paths: |
      tests/a.gctf
      tests/b.gctf
```

## CI smoke coverage in this repository

Workflow `./.github/workflows/release-smoke.yml` validates:

- install-only mode (`1.4.10` and `latest`)
- integration with `bavix/gripmock-action@v1`
- `grpctestify` commands `run`, `check`, and `fmt` over `testdata/greeter/greeter.gctf`

## License

[MIT](LICENSE)
