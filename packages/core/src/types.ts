export interface FileMetadata {
  name: string;
  mimeType: string;
  sizeInBytes: number;
  uploadedAt: Date;
  customMetadata?: Record<string, any>;
}

export interface FileObject extends FileMetadata {
  content: Buffer;
}

export interface UploadOptions {
  contentType?: string;
  cacheControl?: string;
  path?: string;
  metadata?: Record<string, any>;
  isPubliclyAccessible?: boolean;
}

export interface ListOptions {
  prefix?: string;
  limit?: number;
  cursor?: string;
}

export interface ListResult {
  files: FileMetadata[];
  nextCursor?: string;
  hasMore: boolean;
}

export interface DownloadOptions {
  range?: {
    startByte: number;
    endByte: number;
  };
}

export interface SignedUrlOptions {
  expiresIn: number;
  contentType?: string;
}

export interface SignedUrlUploadResult {
  url: string;
  headers?: Record<string, string>;
}

export interface FileStorageAdapterConfig {
  basePath?: string;
}

export interface FileStorageAdapter {
  /**
   *  Uploads a file to the storage system.
   *
   * @param key - unique identifier for the file
   * @param file - File content (Buffer, Stream, or File)
   * @param options - Upload options
   *
   * @returns FileMetadata
   */
  upload(
    key: string,
    file: Buffer | NodeJS.ReadableStream | File,
    options?: UploadOptions,
  ): Promise<FileMetadata>;

  /**
   * Downloads a file from the storage system.
   *
   * @param key - File identifier
   * @param options - Download options
   *
   * @returns FileObject
   */
  download(key: string, options?: DownloadOptions): Promise<FileObject>;

  /**
   * Retrieves metadata for a file.
   *
   * @param key - File identifier
   *
   * @returns void
   */
  getMetadata(key: string): Promise<FileMetadata | null>;

  /**
   * Deletes a file from the storage system.
   *
   * @param key - File identifier
   *
   * @returns boolean
   */
  delete(key: string): Promise<boolean>;

  /**
   * Checks if a file exists in the storage system.
   *
   * @param key - File identifier
   *
   * @returns boolean
   */
  exists(key: string): Promise<boolean>;

  /**
   * Lists files in the storage system.
   *
   * @param options - List options
   *
   * @returns ListResult
   */
  list(options?: ListOptions): Promise<ListResult>;

  /**
   * Generates a signed URL for accessing a file.
   *
   * @param key - File identifier
   * @param options - Signed URL options
   *
   * @returns string - Signed URL
   */
  getSignedUrl(key: string, options: SignedUrlOptions): Promise<string>;

  /**
   * Generates a signed URL for uploading a file.
   *
   * @param key - File identifier
   * @param options - Signed URL options
   *
   * @returns object - Signed URL and optional headers
   */
  getSignedUrlUpload(key: string, options: SignedUrlOptions): Promise<SignedUrlUploadResult>;

  /**
   * Copies a file within the storage system.
   *
   * @param sourceKey - Source file identifier
   * @param destinationKey - Destination file identifier
   *
   * @returns FileMetadata
   */
  copy(sourceKey: string, destinationKey: string): Promise<FileMetadata>;

  /**
   * Moves a file within the storage system.
   *
   * @param sourceKey - Source file identifier
   * @param destinationKey - Destination file identifier
   *
   * @returns FileMetadata
   */
  move(sourceKey: string, destinationKey: string): Promise<FileMetadata>;
}
