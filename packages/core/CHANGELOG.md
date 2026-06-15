# Changelog

## 2.0.0 — 2026-06-15

### Breaking changes

- `BaseAdapter` now declares `abstract deleteByPrefix(...)`. Any external code
  that subclasses `BaseAdapter` directly will fail to compile until it
  implements `deleteByPrefix`.
- `FileMetadata` now has a required `key: string` field. It carries the full
  storage key — the value `delete()` and `download()` accept — alongside the
  existing `name` (last path segment, unchanged). `list()` results now expose
  `key` so callers can iterate and delete/download without reconstructing the
  full path from `name`. Code that only reads `name` keeps working at runtime,
  but typed code that constructs or destructures `FileMetadata` must now
  provide `key`.

  Migration:

  ```ts
  // before
  for (const file of (await adapter.list()).files) {
    await adapter.delete(file.name); // wrong under any non-flat layout
  }

  // after — iterate explicitly
  for (const file of (await adapter.list()).files) {
    await adapter.delete(file.key);
  }
  ```

### Added

- `deleteByPrefix(prefix, opts?)` on the `FileStorageAdapter` interface and
  `BaseAdapter`. Adapter implementations must provide it. Replaces hand-rolled
  list-and-delete loops, handles pagination internally, and lets adapters
  batch deletions where the backend supports it (e.g. S3 `DeleteObjects`).

  ```ts
  // before — manual loop, no pagination, one delete per round trip
  let cursor: string | undefined;
  do {
    const page = await adapter.list({ prefix: 'exports/', cursor });
    for (const file of page.files) await adapter.delete(file.key);
    cursor = page.hasMore ? page.nextCursor : undefined;
  } while (cursor);

  // after
  const { deleted } = await adapter.deleteByPrefix('exports/');
  ```
- `DeleteByPrefixOptions` (`batch`, `limit`) and `DeleteByPrefixResult`
  (`{ deleted }`) types.
