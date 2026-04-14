# Storage Migration Tool - Detailed Design

## Overview

The migration tool is a **unique differentiator** that none of your competitors offer. It solves a critical pain point: **vendor lock-in fear** and the operational challenge of moving data between storage providers.

## Core Value Proposition

1. **Zero-downtime migrations** - Migrate data while your application continues running
2. **Incremental sync** - Only copy what's changed
3. **Validation & verification** - Ensure data integrity after migration
4. **Cost optimization** - Move data to cheaper storage (e.g., S3 → R2 for zero egress)
5. **Multi-cloud strategy** - Enable hybrid/multi-cloud architectures

---

## Architecture

### Package Structure

```typescript
// packages/migration/
├── src/
│   ├── index.ts                    // Main exports
│   ├── migrator.ts                 // Core migration engine
│   ├── strategies/
│   │   ├── simple.ts               // Basic copy strategy
│   │   ├── incremental.ts          // Only new/changed files
│   │   ├── parallel.ts             // Multi-threaded migration
│   │   └── two-way-sync.ts         // Bidirectional sync
│   ├── validators/
│   │   ├── checksum-validator.ts   // Verify file integrity
│   │   └── metadata-validator.ts   // Verify metadata matches
│   ├── filters/
│   │   ├── date-filter.ts          // Filter by date ranges
│   │   ├── pattern-filter.ts       // Glob pattern matching
│   │   └── size-filter.ts          // Filter by file size
│   ├── reporters/
│   │   ├── console-reporter.ts     // CLI progress output
│   │   ├── json-reporter.ts        // Machine-readable output
│   │   └── webhook-reporter.ts     // Real-time notifications
│   └── types.ts
```

---

## API Design

### Basic Usage

```typescript
import { migrate } from '@heilgar/file-storage-adapter-migration';
import { S3Adapter } from '@heilgar/file-storage-adapter-s3';
import { R2Adapter } from '@heilgar/file-storage-adapter-r2';

const source = new S3Adapter({
  bucket: 'my-s3-bucket',
  region: 'us-east-1',
});

const destination = new R2Adapter({
  bucket: 'my-r2-bucket',
  accountId: 'xxx',
});

// Simple migration
const result = await migrate({
  from: source,
  to: destination,
  onProgress: (progress) => {
    console.log(`${progress.percentage}% complete`);
    console.log(`${progress.filesCompleted}/${progress.totalFiles} files`);
    console.log(`${progress.bytesTransferred}/${progress.totalBytes} bytes`);
  },
});

console.log('Migration complete!', result);
```

### Advanced Usage

```typescript
import { Migrator, IncrementalStrategy } from '@heilgar/file-storage-adapter-migration';

const migrator = new Migrator({
  source: s3Adapter,
  destination: r2Adapter,

  // Strategy
  strategy: new IncrementalStrategy({
    stateFile: '.migration-state.json',  // Track what's been migrated
    syncInterval: '5m',                   // Sync every 5 minutes
  }),

  // Filtering
  filter: {
    prefix: 'uploads/',                   // Only migrate files under uploads/
    pattern: '**/*.{jpg,png,pdf}',        // Only certain file types
    uploadedAfter: new Date('2024-01-01'),
    uploadedBefore: new Date('2024-12-31'),
    minSize: 1024,                        // Minimum 1KB
    maxSize: 100 * 1024 * 1024,          // Maximum 100MB
  },

  // Validation
  validation: {
    verifyChecksum: true,                 // Calculate and verify checksums
    verifyMetadata: true,                 // Ensure metadata matches
    verifySize: true,                     // Ensure sizes match
    deleteAfterVerify: false,             // Don't delete from source
  },

  // Performance
  concurrency: 10,                        // Upload 10 files at once
  retryAttempts: 3,                       // Retry failed files
  retryDelay: 1000,                       // Wait 1s between retries

  // Error handling
  onError: (error, file) => {
    console.error(`Failed to migrate ${file.key}:`, error);
    // Log to monitoring system
  },

  // Progress tracking
  onFileComplete: (file, result) => {
    console.log(`✓ Migrated ${file.key} (${result.sizeInBytes} bytes)`);
  },

  onProgress: (progress) => {
    // Update progress bar
    progressBar.update(progress.percentage);
  },
});

// Start migration
const result = await migrator.run();

console.log('Migration Summary:');
console.log(`✓ Success: ${result.successful} files`);
console.log(`✗ Failed: ${result.failed} files`);
console.log(`⊘ Skipped: ${result.skipped} files`);
console.log(`→ Total transferred: ${formatBytes(result.bytesTransferred)}`);
console.log(`⏱ Duration: ${formatDuration(result.duration)}`);
```

---

## Migration Strategies

### 1. Simple Strategy (One-time Copy)

```typescript
class SimpleStrategy implements MigrationStrategy {
  async execute(context: MigrationContext): Promise<MigrationResult> {
    const files = await context.source.list({ limit: 1000 });

    for (const file of files.files) {
      if (context.shouldMigrate(file)) {
        const data = await context.source.download(file.name);
        await context.destination.upload(file.name, data.content, {
          contentType: file.mimeType,
          metadata: file.customMetadata,
        });

        await context.onFileComplete(file);
      }
    }

    return context.getResult();
  }
}
```

### 2. Incremental Strategy (Sync Only Changes)

```typescript
class IncrementalStrategy implements MigrationStrategy {
  private state: MigrationState;

  async execute(context: MigrationContext): Promise<MigrationResult> {
    // Load previous migration state
    this.state = await this.loadState();

    const sourceFiles = await this.getSourceFileList(context);
    const destFiles = await this.getDestFileList(context);

    const filesToMigrate = this.detectChanges(sourceFiles, destFiles);

    for (const file of filesToMigrate) {
      await this.migrateFile(file, context);

      // Update state
      this.state.completed[file.key] = {
        migratedAt: new Date(),
        checksum: file.checksum,
        size: file.sizeInBytes,
      };

      await this.saveState();
    }

    return context.getResult();
  }

  private detectChanges(
    sourceFiles: FileMetadata[],
    destFiles: Map<string, FileMetadata>
  ): FileMetadata[] {
    return sourceFiles.filter(source => {
      const dest = destFiles.get(source.name);

      // File doesn't exist in destination
      if (!dest) return true;

      // File has been modified (size changed)
      if (source.sizeInBytes !== dest.sizeInBytes) return true;

      // File has been modified (date changed)
      if (source.uploadedAt > dest.uploadedAt) return true;

      return false;
    });
  }
}
```

### 3. Parallel Strategy (Multi-threaded)

```typescript
class ParallelStrategy implements MigrationStrategy {
  constructor(private concurrency: number = 10) {}

  async execute(context: MigrationContext): Promise<MigrationResult> {
    const files = await context.source.list({ limit: 10000 });

    // Process files in batches
    await pLimit(files.files, this.concurrency, async (file) => {
      if (context.shouldMigrate(file)) {
        try {
          await this.migrateFile(file, context);
        } catch (error) {
          await context.onError(error, file);
        }
      }
    });

    return context.getResult();
  }
}
```

### 4. Two-Way Sync Strategy (Bidirectional)

```typescript
class TwoWaySyncStrategy implements MigrationStrategy {
  async execute(context: MigrationContext): Promise<MigrationResult> {
    const sourceFiles = await this.getFileMap(context.source);
    const destFiles = await this.getFileMap(context.destination);

    // Files only in source → copy to destination
    for (const [key, file] of sourceFiles) {
      if (!destFiles.has(key)) {
        await this.copyFile(context.source, context.destination, file);
      }
    }

    // Files only in destination → copy to source
    for (const [key, file] of destFiles) {
      if (!sourceFiles.has(key)) {
        await this.copyFile(context.destination, context.source, file);
      }
    }

    // Files in both → sync the newer version
    for (const [key, sourceFile] of sourceFiles) {
      const destFile = destFiles.get(key);
      if (destFile && sourceFile.uploadedAt > destFile.uploadedAt) {
        await this.copyFile(context.source, context.destination, sourceFile);
      } else if (destFile && destFile.uploadedAt > sourceFile.uploadedAt) {
        await this.copyFile(context.destination, context.source, destFile);
      }
    }

    return context.getResult();
  }
}
```

---

## Validation & Integrity

```typescript
interface Validator {
  validate(
    source: FileObject,
    destination: FileObject
  ): Promise<ValidationResult>;
}

class ChecksumValidator implements Validator {
  async validate(source: FileObject, dest: FileObject): Promise<ValidationResult> {
    const sourceChecksum = this.calculateChecksum(source.content);
    const destChecksum = this.calculateChecksum(dest.content);

    return {
      valid: sourceChecksum === destChecksum,
      details: {
        sourceChecksum,
        destChecksum,
        algorithm: 'sha256',
      },
    };
  }

  private calculateChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }
}

class MetadataValidator implements Validator {
  async validate(source: FileObject, dest: FileObject): Promise<ValidationResult> {
    const issues: string[] = [];

    if (source.sizeInBytes !== dest.sizeInBytes) {
      issues.push(`Size mismatch: ${source.sizeInBytes} vs ${dest.sizeInBytes}`);
    }

    if (source.mimeType !== dest.mimeType) {
      issues.push(`MIME type mismatch: ${source.mimeType} vs ${dest.mimeType}`);
    }

    return {
      valid: issues.length === 0,
      details: { issues },
    };
  }
}
```

---

## Progress Reporting

```typescript
interface MigrationProgress {
  // Files
  totalFiles: number;
  filesCompleted: number;
  filesFailed: number;
  filesSkipped: number;

  // Bytes
  totalBytes: number;
  bytesTransferred: number;

  // Timing
  startedAt: Date;
  estimatedCompletion?: Date;
  duration: number;  // milliseconds

  // Performance
  transferRate: number;  // bytes per second
  filesPerSecond: number;

  // Current file
  currentFile?: {
    key: string;
    size: number;
    progress: number;  // 0-100
  };

  // Derived
  percentage: number;  // 0-100
}

interface ProgressReporter {
  report(progress: MigrationProgress): void;
}

class ConsoleReporter implements ProgressReporter {
  report(progress: MigrationProgress): void {
    console.clear();
    console.log('Migration Progress');
    console.log('─'.repeat(50));
    console.log(`Files: ${progress.filesCompleted}/${progress.totalFiles}`);
    console.log(`Progress: ${'█'.repeat(progress.percentage / 2)}${' '.repeat(50 - progress.percentage / 2)} ${progress.percentage}%`);
    console.log(`Speed: ${formatBytes(progress.transferRate)}/s`);
    console.log(`ETA: ${formatDuration(progress.estimatedCompletion)}`);

    if (progress.currentFile) {
      console.log(`\nCurrent: ${progress.currentFile.key}`);
    }
  }
}

class WebhookReporter implements ProgressReporter {
  constructor(private webhookUrl: string) {}

  async report(progress: MigrationProgress): Promise<void> {
    await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(progress),
    });
  }
}
```

---

## CLI Tool

```typescript
// packages/migration/src/cli.ts
import { Command } from 'commander';

const program = new Command();

program
  .name('storage-migrate')
  .description('Migrate files between storage providers')
  .version('1.0.0');

program
  .command('migrate')
  .description('Migrate files from source to destination')
  .requiredOption('--from <adapter>', 'Source adapter config (JSON or file path)')
  .requiredOption('--to <adapter>', 'Destination adapter config (JSON or file path)')
  .option('--prefix <prefix>', 'Only migrate files with this prefix')
  .option('--pattern <pattern>', 'Glob pattern for files to migrate')
  .option('--concurrency <n>', 'Number of concurrent transfers', '10')
  .option('--verify', 'Verify files after migration', false)
  .option('--delete-after', 'Delete from source after successful migration', false)
  .option('--dry-run', 'Show what would be migrated without actually migrating', false)
  .action(async (options) => {
    const source = loadAdapter(options.from);
    const destination = loadAdapter(options.to);

    await migrate({
      from: source,
      to: destination,
      filter: {
        prefix: options.prefix,
        pattern: options.pattern,
      },
      concurrency: parseInt(options.concurrency),
      validation: {
        verifyChecksum: options.verify,
      },
      dryRun: options.dryRun,
      onProgress: (progress) => {
        // Update progress bar
      },
    });
  });

program
  .command('sync')
  .description('Continuously sync files between storage providers')
  .requiredOption('--from <adapter>', 'Source adapter config')
  .requiredOption('--to <adapter>', 'Destination adapter config')
  .option('--interval <seconds>', 'Sync interval in seconds', '300')
  .option('--two-way', 'Enable bidirectional sync', false)
  .action(async (options) => {
    // Continuous sync implementation
  });

program.parse();
```

### CLI Usage Examples

```bash
# Migrate all files from S3 to R2
storage-migrate migrate \
  --from '{"adapter":"s3","bucket":"my-s3","region":"us-east-1"}' \
  --to '{"adapter":"r2","bucket":"my-r2","accountId":"xxx"}' \
  --verify

# Migrate only images uploaded in 2024
storage-migrate migrate \
  --from s3-config.json \
  --to r2-config.json \
  --pattern "**/*.{jpg,png,gif}" \
  --prefix "uploads/2024/" \
  --concurrency 20

# Dry run to see what would be migrated
storage-migrate migrate \
  --from s3-config.json \
  --to r2-config.json \
  --dry-run

# Continuous two-way sync
storage-migrate sync \
  --from s3-config.json \
  --to r2-config.json \
  --interval 60 \
  --two-way
```

---

## Real-World Use Cases

### 1. Cost Optimization (S3 → R2)

```typescript
// Save on egress fees by migrating to Cloudflare R2
await migrate({
  from: new S3Adapter({ bucket: 'expensive-s3' }),
  to: new R2Adapter({ bucket: 'zero-egress-r2' }),
  filter: {
    // Migrate frequently accessed files first
    uploadedAfter: new Date('2024-01-01'),
  },
  validation: {
    verifyChecksum: true,
    deleteAfterVerify: true,  // Remove from S3 after verification
  },
});
```

### 2. Disaster Recovery (Primary → Backup)

```typescript
// Continuously backup to secondary region
const migrator = new Migrator({
  source: new S3Adapter({ bucket: 'primary', region: 'us-east-1' }),
  destination: new S3Adapter({ bucket: 'backup', region: 'eu-west-1' }),
  strategy: new IncrementalStrategy({ syncInterval: '1h' }),
});

// Run continuously
setInterval(async () => {
  await migrator.run();
}, 60 * 60 * 1000);
```

### 3. Cloud Migration (AWS → Azure)

```typescript
// Migrate enterprise storage to Azure
await migrate({
  from: new S3Adapter({ bucket: 'aws-storage' }),
  to: new AzureBlobAdapter({ container: 'azure-storage' }),
  concurrency: 50,  // Fast migration
  onProgress: (progress) => {
    // Report to stakeholders
    notifyStakeholders(`Migration ${progress.percentage}% complete`);
  },
});
```

### 4. Development → Production Sync

```typescript
// Sync production data to staging for testing
await migrate({
  from: new S3Adapter({ bucket: 'prod' }),
  to: new S3Adapter({ bucket: 'staging' }),
  filter: {
    // Only recent data
    uploadedAfter: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    // Exclude sensitive data
    pattern: '!**/sensitive/**',
  },
});
```

---

## Implementation Timeline

### Phase 1: Core (Week 1-2)
- Basic migration engine
- Simple strategy
- File filtering
- Progress reporting

### Phase 2: Advanced Strategies (Week 3)
- Incremental strategy with state management
- Parallel strategy with concurrency control
- Validation and verification

### Phase 3: CLI & DX (Week 4)
- CLI tool
- Config file support
- Better error messages
- Documentation

### Phase 4: Enterprise Features (Week 5-6)
- Two-way sync
- Webhook notifications
- Pause/resume capability
- Migration scheduling

---

## Competitive Advantage

**Why this is unique:**
1. ✅ Nobody else offers provider-agnostic migration
2. ✅ Built-in validation and verification
3. ✅ Incremental sync (only transfer changes)
4. ✅ Works with YOUR adapters (easy to extend)
5. ✅ CLI + programmatic API
6. ✅ Enterprise-ready (parallel, retry, monitoring)

This tool positions your library as **THE solution** for multi-cloud storage, not just another adapter library.
