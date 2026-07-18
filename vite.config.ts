import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "./",
  build: {
    rollupOptions: {
      input: {
        menu: resolve(new URL(".", import.meta.url).pathname, "index.html"),
        game: resolve(new URL(".", import.meta.url).pathname, "game.html"),
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "project-to-port/**"],
  },
});
