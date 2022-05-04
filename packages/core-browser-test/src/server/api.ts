import { File } from "@smcp/core/utils/buffer";
import { createHash } from "crypto";

export class DummyApi {
  returnString() {
    return "hello world";
  }
  returnError() {
    return new Error("returnError");
  }
  throwError() {
    throw new Error("throwError");
  }
  async returnAsyncError() {
    return new Error("returnAsyncError");
  }
  throwAsyncError() {
    throw new Error("throwError");
  }
  callback(options: { onProgress?: (value: number) => void }) {
    options?.onProgress?.(10);
    options?.onProgress?.(50);
    options?.onProgress?.(90);
    return 100;
  }
  async returnChecksum(data: { file: File }) {
    const hash = createHash("sha1").setEncoding("hex");
    const text = await data.file.text();
    hash.update(text);
    return hash.digest("hex");
  }
}

export const api = {
  dummy: DummyApi,
};

export default api;
