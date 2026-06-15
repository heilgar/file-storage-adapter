# Changelog

## 2.0.0 — 2026-06-15

### Breaking changes

- Requires `@heilgar/file-storage-adapter-core` `^2.0.0`. `FileMetadata` now
  includes a required `key` field. `upload()`, `getMetadata()`, `download()`,
  and `list()` all populate it with the full storage key — the same value the
  other methods accept.
- Metadata files written by `1.x` don't carry `key` on disk. When read back,
  the adapter backfills `key` from the lookup path in memory; the on-disk
  metadata file is **not** rewritten, so the backfill keeps happening on each
  read until the file is uploaded again.

### Added

- `deleteByPrefix(prefix, opts?)` — deletes everything under a prefix. Because
  the fs `list()` doesn't paginate via cursor, the implementation re-lists
  after each batch (successful deletes shrink the next listing until empty).
  `batch` controls page size (default 100); `limit` caps total deletions.
  `deleted` counts only successful `delete()` calls (i.e. `delete()` returning
  `true`), and the loop exits early if a batch makes no progress — preventing
  infinite loops when `delete()` keeps failing.

  ```ts
  const { deleted } = await adapter.deleteByPrefix('exports/');
  await adapter.deleteByPrefix('exports/', { batch: 50, limit: 500 });
  ```

  `name` semantics are unchanged: still the last path segment. Existing
  read-only code that only consults `name` keeps working.
