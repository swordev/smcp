import { compareArray, merge } from "./utils/object";
import { deleteCache } from "./utils/require";
import chokidar from "chokidar";
import { dirname, join } from "path";
import { DeepPartial, DeepReadonly } from "ts-essentials";

export type OptionsType<T> = {
  __filename: string;
  reloadablePaths?: string[];
  main: (prev: T | undefined) => Promise<T>;
};

export class Bootloader<T extends Record<string, unknown>> {
  protected previous: T | undefined;
  protected reloadTimeout: NodeJS.Timeout | undefined;
  protected watcher: chokidar.FSWatcher | undefined;
  constructor(readonly options: DeepReadonly<OptionsType<T>>) {}
  async start(options?: { watcher: boolean }) {
    const result = this.exec();
    if (options?.watcher) this.startWatcher();
    return result;
  }
  async updateOptions(options: DeepPartial<OptionsType<T>>) {
    let restartWatcher = false;
    if (this.watcher) {
      if (
        options.__filename &&
        options.__filename !== this.options.__filename
      ) {
        restartWatcher = true;
      } else if (
        options.reloadablePaths &&
        compareArray(
          options.reloadablePaths,
          (this.options.reloadablePaths as string[]) ?? []
        )
      ) {
        restartWatcher = true;
      }
    }
    merge(this.options, options);
    if (restartWatcher) {
      await this.stopWatcher();
      this.startWatcher();
    }
  }
  protected async exec(prev?: T) {
    return (this.previous = await this.options.main(prev));
  }
  async reload() {
    const dir = dirname(this.options.__filename);
    const paths = [
      this.options.__filename,
      ...(this.options.reloadablePaths?.map((p) => join(dir, p)) || []),
    ];
    deleteCache(paths);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const self = require(this.options.__filename).default;
    if (!(self instanceof Bootloader))
      throw new Error(
        `default export is not instance of Bootloader: ${this.options.__filename}`
      );
    await this.updateOptions(self.options as OptionsType<T>);
    return (this.previous = await this.exec(this.previous));
  }
  async reloadWithDelay(ms = 300) {
    if (this.reloadTimeout) clearTimeout(this.reloadTimeout);
    this.reloadTimeout = setTimeout(async () => {
      this.reloadTimeout = undefined;
      await this.reload();
    }, ms);
  }
  startWatcher() {
    const cwd = dirname(this.options.__filename);
    const paths = [
      this.options.__filename,
      ...(this.options.reloadablePaths ?? []),
    ].map((path) => path.replace(/\\/g, "/"));
    if (this.watcher) throw new Error(`Watcher is already active`);
    this.watcher = chokidar
      .watch(paths, {
        cwd,
        ignoreInitial: true,
      })
      .on("all", async (event) => {
        if (event !== "add" && event !== "addDir") await this.reloadWithDelay();
      });
  }
  async stopWatcher() {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = undefined;
    }
  }
}
