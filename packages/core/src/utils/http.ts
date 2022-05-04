import { makePromise } from "./async";
import { createReadStream } from "fs";
import { IncomingMessage, ServerResponse } from "http";
import { contentType } from "mime-types";
import { extname, join } from "path";

export function fetchPayload(request: IncomingMessage) {
  return new Promise<string | undefined>((resolve, reject) => {
    let data = "";
    let widthData = false;
    request
      .on("data", (chunk: Buffer) => {
        data += chunk.toString();
        widthData = true;
      })
      .on("error", reject)
      .on("end", () => resolve(widthData ? data : undefined));
  });
}
export function processStaticFileRequest(
  request: Pick<IncomingMessage, "url">,
  response: ServerResponse,
  options: {
    dir: string;
  }
) {
  const promise = makePromise();
  const path = join(
    options.dir,
    request.url === "/" ? "/index.html" : request.url ?? "/"
  );
  const contentTypeHeader = contentType(extname(path));
  if (contentTypeHeader) response.setHeader("Content-Type", contentTypeHeader);
  const stream = createReadStream(path);
  stream.on("error", () => response.writeHead(404).end());
  stream.on("close", () => response.end());
  response.on("finish", () => promise.resolve());
  stream.pipe(response);
  return promise;
}
