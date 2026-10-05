import { Transform, TransformCallback } from 'stream';

/** Passes bytes through, failing the stream if it carries more or fewer than `size`. */
export function exactLength(size: number): Transform {
  let seen = 0;
  return new Transform({
    transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback) {
      seen += chunk.length;
      if (seen > size) return callback(new Error(`Stream is longer than the expected ${size} bytes`));
      callback(null, chunk);
    },
    flush(callback: TransformCallback) {
      if (seen !== size) return callback(new Error(`Stream ended after ${seen} of ${size} bytes`));
      callback();
    },
  });
}
