# Vendored lynx-stack build

The harness consumes an exact, locally built lynx-stack package set rather
than a `pkg.pr.new` preview, because the declarative Motion stack has not yet
been rebased onto lynx-stack `main` upstream.

| Tarball | Source |
| --- | --- |
| `lynx-js-react-0.126.2.tgz` | lynx-stack `main` @ `4f63dfd` (MainThreadObject runtime #3788/#3789/#4064, wasm transform) |
| `lynx-js-react-umd-0.126.2.tgz` | lynx-stack `main` @ `4f63dfd` |
| `lynx-js-motion-0.0.6.tgz` | lynx-stack `main` @ `4f63dfd` + `lynx-stack-patches/*.patch` (head recorded as `LYNX_STACK_BUILD.motion`) |

`src/conformance/cases.ts` records the same commits in `LYNX_STACK_BUILD`, and
the Gallery info panel prints them, so every published metric names the build
it was measured on.

## Rebuild

```bash
git clone https://github.com/lynx-family/lynx-stack && cd lynx-stack
git checkout 4f63dfd
git am <harness>/lynx/vendor/lynx-stack-patches/*.patch
pnpm install --frozen-lockfile
(cd packages/react/transform && pnpm run build:wasm)
pnpm turbo build --filter=@lynx-js/react --filter=@lynx-js/motion
(cd packages/react-umd && pnpm run build)
(cd packages/motion && pnpm test)
for p in react motion react-umd; do
  (cd packages/$p && pnpm pack --pack-destination <harness>/lynx/vendor)
done
```

The patches are the review units intended for lynx-stack; once they land
and publish, replace the `file:vendor/...` dependencies with the published
versions and delete this directory.
