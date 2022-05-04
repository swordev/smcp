import { File } from "../../src/utils/buffer";
import {
  tempPath,
  createFileFromPath,
  writeStreamFile,
} from "../../src/utils/fs";
import { createReadStream } from "fs";
import { readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { basename, join } from "path";

/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-empty */

async function removeFiles(paths: string[]) {
  for (const path in paths)
    try {
      await rm(path);
    } catch (_) {}
}

describe("tempPath", () => {
  it("returns temporary path", async () => {
    expect(tempPath().startsWith(tmpdir())).toBeTruthy();
  });
  it("returns temporary path with prefix", async () => {
    expect(tempPath("test-").startsWith(join(tmpdir(), "test-"))).toBeTruthy();
  });
});

describe("createFileFromPath", () => {
  it("creates a file object", async () => {
    const sourcePath = tempPath("writeStreamFile-");
    try {
      await writeFile(sourcePath, new Uint8Array([1, 2, 3, 4, 5]));
      const file = await createFileFromPath(sourcePath);
      const buffer = await file.arrayBuffer();
      expect(file.name).toBe(basename(sourcePath));
      expect(file.size).toBe(5);
      expect(Object.values(new Uint8Array(buffer))).toMatchObject([
        1, 2, 3, 4, 5,
      ]);
    } finally {
      await removeFiles([sourcePath]);
    }
  });

  it("creates a file object with other name", async () => {
    const sourcePath = tempPath("writeStreamFile-");
    try {
      await writeFile(sourcePath, new Uint8Array([]));
      const file = await createFileFromPath(sourcePath, "alternative");
      expect(file.name).toBe("alternative");
    } finally {
      await removeFiles([sourcePath]);
    }
  });
});

describe("writeStreamFile", () => {
  it("writes a file from web stream", async () => {
    const file = new File([new Uint8Array([1, 2, 3, 4, 5])], "data.bin");
    const path = tempPath("writeStreamFile-");
    const onProgress = jest.fn((data: { bytes: number }) => {});
    try {
      await writeStreamFile(file.stream(), path, { onProgress });
      const contents = await readFile(path);
      expect(Object.values(contents)).toMatchObject([1, 2, 3, 4, 5]);
      expect(onProgress).toBeCalledWith({
        bytes: 5,
      });
    } finally {
      await removeFiles([path]);
    }
  });

  it("writes a file from node stream", async () => {
    const sourcePath = tempPath("writeStreamFile-");
    await writeFile(sourcePath, new Uint8Array([1, 2, 3, 4, 5]));
    const path = tempPath("writeStreamFile-");
    const onProgress = jest.fn((data: { bytes: number }) => {});
    try {
      const stream = createReadStream(sourcePath);
      await writeStreamFile(stream, path, { onProgress });
      const contents = await readFile(sourcePath);
      expect(Object.values(contents)).toMatchObject([1, 2, 3, 4, 5]);
      expect(onProgress).toBeCalledWith({
        bytes: 5,
      });
    } finally {
      await removeFiles([sourcePath, path]);
    }
  });

  it("writes a file from file object", async () => {
    const file = new File([new Uint8Array([1, 2, 3, 4, 5])], "data.bin");
    const path = tempPath("writeStreamFile-");
    const onProgress = jest.fn(
      (data: { totalBytes: number; bytes: number; progress: number }) => {}
    );
    try {
      await writeStreamFile(file, path, {
        onProgress,
      });
      const contents = await readFile(path);
      expect(Object.values(contents)).toMatchObject([1, 2, 3, 4, 5]);
      expect(onProgress).toBeCalledWith({
        totalBytes: 5,
        bytes: 5,
        progress: 100,
      });
    } finally {
      await removeFiles([path]);
    }
  });
});
