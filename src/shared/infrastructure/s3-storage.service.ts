import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import { StorageService, StoredObjectInfo } from '../domain/storage-service';
import { fileDelivery } from './file-delivery';
import { exactLength } from './exact-length';

@Injectable()
export class S3StorageService implements StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = config.get('S3_BUCKET', 'helpdesk-attachments');

    const endpoint = config.get<string>('S3_ENDPOINT')?.trim() || undefined;
    this.client = new S3Client({
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
      region: config.get('S3_REGION', 'us-east-1'),
      credentials: {
        accessKeyId: config.get('S3_ACCESS_KEY', ''),
        secretAccessKey: config.get('S3_SECRET_KEY', ''),
      },
    });
  }

  async upload(
    buffer: Buffer,
    key: string,
    mimeType: string,
  ): Promise<void> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: mimeType,
        }),
      );
    } catch (error) {
      throw this.handleConnectionError(error);
    }
  }

  async putStream(key: string, stream: Readable, mimeType: string, size: number): Promise<void> {
    // A single PUT with a declared length (no multipart): S3 discards the object unless all of
    // it arrives, and the length check fails the request if the stream is short or long
    const body = stream.pipe(exactLength(size));
    stream.on('error', (error) => body.destroy(error));
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: mimeType,
          ContentLength: size,
        }),
      );
    } catch (error) {
      throw this.handleConnectionError(error);
    }
  }

  async getStream(key: string): Promise<Readable> {
    try {
      const response = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      if (!response.Body) throw new Error(`Storage object has no body: ${key}`);
      return response.Body as Readable;
    } catch (error) {
      throw this.handleConnectionError(error);
    }
  }

  async stat(key: string): Promise<StoredObjectInfo | null> {
    try {
      const response = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { size: Number(response.ContentLength ?? 0) };
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
      const name = (error as Error)?.name;
      if (status === 404 || name === 'NotFound' || name === 'NoSuchKey') return null;
      throw this.handleConnectionError(error);
    }
  }

  async getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
    // The stored Content-Type is whatever the uploader declared; the link overrides it so a file
    // only displays when its type cannot run script, and downloads otherwise.
    const delivery = fileDelivery(key);
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentType: delivery.contentType,
      ResponseContentDisposition: delivery.contentDisposition,
    });
    try {
      return await getSignedUrl(this.client, command, { expiresIn });
    } catch (error) {
      throw this.handleConnectionError(error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
    } catch (error) {
      throw this.handleConnectionError(error);
    }
  }

  private handleConnectionError(error: unknown): Error {
    if (
      error instanceof AggregateError ||
      (error instanceof Error && ('code' in error) &&
        (error as any).code === 'ECONNREFUSED')
    ) {
      return new ServiceUnavailableException(
        'File storage service is unavailable',
      );
    }
    return error instanceof Error ? error : new Error(String(error));
  }
}
