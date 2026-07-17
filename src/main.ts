import "./styles/game.css";
import { Configuration, loadBrowserAssets } from "./core/configuration";
import { createContext, createGame } from "./core/game";
import { BrowserInput } from "./input/io";

function shouldWaitForLandscape(): boolean {
  return (
    window.matchMedia?.("(orientation: portrait) and (pointer: coarse)")
      .matches ?? false
  );
}

function start(): void {
  if (shouldWaitForLandscape()) {
    window.addEventListener("resize", start, { once: true });
    window.addEventListener("orientationchange", start, { once: true });
    return;
  }

  const game = createGame(new Configuration(loadBrowserAssets()));
  const input = new BrowserInput(game, window);
  input.attach();
  const context = createContext(game);

  const frame = (): void => {
    game.update();
    game.render(context);
    window.requestAnimationFrame(frame);
  };
  window.requestAnimationFrame(frame);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}
