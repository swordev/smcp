import { Bootloader } from "../src/Bootloader";

export let counter = 0;

export default new Bootloader<{
  get(): number;
  increment: () => void;
}>({
  __filename,
  main: async () => ({
    get: () => counter,
    increment: () => counter++,
  }),
});
