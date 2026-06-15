# Changelog

## 2.0.0 — 2026-06-15

### Breaking changes

- Requires `@heilgar/file-storage-adapter-core` `^2.0.0`. `FileMetadata` now
  includes a required `key` field.
- `list()` results now set `key` to the object key with `basePath` stripped —
  the same value `delete()`, `download()`, and `getMetadata()` accept. Callers
  iterating `list()` results should use `file.key` instead of `file.name`,
  which is just the last path segment.

### Added

- `deleteByPrefix(prefix, opts?)` — deletes everything under a prefix using
  `ListObjectsV2` + batched `DeleteObjects` with `Quiet: true`. Honours
  `basePath`, `batch` (page size, default 100), and `limit` (cap on total
  deletions). Safe to retry: S3 `DeleteObjects` no-ops on already-deleted keys.

  ```ts
  const { deleted } = await adapter.deleteByPrefix('exports/');
  await adapter.deleteByPrefix('exports/', { batch: 1000, limit: 5000 });
  ```

  Notes:
  - S3's `DeleteObjects` is capped at **1000 keys per request**; passing a
    larger `batch` will cause S3 to reject the call. Internally we also cap
    the per-page `ListObjectsV2.MaxKeys` at `batch`.
  - `Quiet: true` suppresses per-key error reporting from S3. `deleted`
    reflects the number of keys submitted for deletion in each successful
    `DeleteObjects` response, not a per-key confirmation. If a `DeleteObjects`
    call throws (network, auth, throttling), the loop aborts and the caller
    can retry.

  `name` semantics are unchanged: still the last path segment.
