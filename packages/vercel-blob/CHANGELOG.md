# Changelog

## 2.1.0 — 2026-10-28

### Added

- `getSignedUrlUpload(key, { maxSizeInBytes })` forwards the cap as
  `maximumSizeInBytes` to both `issueSignedToken` and `presignUrl`, so Vercel
  Blob rejects uploads over the limit. Omitted when not set.
- Requires `@heilgar/file-storage-adapter-core` `^2.1.0`.

### Fixed

- Presigned upload URLs are now usable from a browser `PUT`:
  - Signed with `addRandomSuffix: false` and `allowOverwrite: false`. Previously
    Blob stored the upload as `<name>-<random>.<ext>`, so the caller could not
    find the key it signed.
  - When `contentType` is given, the returned `headers` include
    `x-content-type` (alongside `Content-Type`). Blob ignores `Content-Type` on
    `PUT` and reads the stored type from `x-content-type`, otherwise guessing
    from the extension. Send all returned `headers` with the `PUT`.

### Behavior change

- A presigned `PUT` to a key that already holds a blob is now rejected
  (`allowOverwrite: false`). Delete the existing blob first, or sign a new key.

## 2.0.0 — 2026-06-15

### Breaking changes

- Requires `@heilgar/file-storage-adapter-core` `^2.0.0`. `FileMetadata` now
  includes a required `key` field.
- `list()` now strips the configured `basePath` from each result's `key` so it
  round-trips with `upload()`, `delete()`, and `download()`. Previously `key`
  would equal the blob's full `pathname`, which under a `basePath` meant
  `list()` returned a different shape than `upload()`. This is a behavior fix,
  but any 2.0.0-preview consumer that read `key` directly off list results and
  relied on it being basePath-prefixed must adjust.

### Added

- `deleteByPrefix(prefix, opts?)` — deletes everything under a prefix,
  paginating through the Vercel Blob `list()` cursor. `batch` controls page
  size (default 100); `limit` caps total deletions. Safe to retry: the
  underlying `del()` silently no-ops on already-deleted keys.

  ```ts
  const { deleted } = await adapter.deleteByPrefix('exports/');
  await adapter.deleteByPrefix('exports/', { batch: 50, limit: 500 });
  ```

  Implementation detail: `deleteByPrefix` passes blob **URLs** to `del()`
  (taken directly from the `list()` response), while single-key `delete()`
  passes the **pathname**. `@vercel/blob`'s `del()` accepts both forms; the
  difference is internal and not observable to callers.

  `name` semantics are unchanged: still the last path segment.
