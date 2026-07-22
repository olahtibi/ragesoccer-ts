import "./styles/game.css";
import { Configuration, loadBrowserAssets } from "./core/configuration";
import { createContext, createGame, resizeContext } from "./core/game";
import type { Game } from "./core/game";
import { BrowserInput } from "./input/io";

function shouldWaitForLandscape(): boolean {
  return (
    window.matchMedia?.("(orientation: portrait) and (pointer: coarse)")
      .matches ?? false
  );
}

function viewportSize(): { width: number; height: number } {
  const viewport = window.visualViewport;
  return {
    width: Math.round(viewport?.width ?? window.innerWidth),
    height: Math.round(viewport?.height ?? window.innerHeight),
  };
}

let started = false;
let pendingStart = 0;
let activeGame: Game | null = null;
let activeContext: CanvasRenderingContext2D | null = null;

function start(): void {
  if (started) {
    window.cancelAnimationFrame(pendingStart);
    pendingStart = window.requestAnimationFrame(resizeGame);
    return;
  }
  if (shouldWaitForLandscape()) return;
  window.cancelAnimationFrame(pendingStart);
  pendingStart = window.requestAnimationFrame(() => {
    pendingStart = window.requestAnimationFrame(startGame);
  });
}

function startGame(): void {
  if (started || shouldWaitForLandscape()) return;
  started = true;
  const size = viewportSize();
  const game = createGame(
    new Configuration(loadBrowserAssets(), {
      width: size.width,
      height: size.height,
    }),
  );
  const input = new BrowserInput(game, window);
  input.attach();
  const context = createContext(game);
  activeGame = game;
  activeContext = context;

  const frame = (): void => {
    game.update();
    game.render(context);
    window.requestAnimationFrame(frame);
  };
  window.requestAnimationFrame(frame);
}

function resizeGame(): void {
  if (activeGame == null || activeContext == null) return;
  const size = viewportSize();
  resizeContext(activeGame, activeContext, size.width, size.height);
}

window.addEventListener("resize", start);
window.addEventListener("orientationchange", start);
window.visualViewport?.addEventListener("resize", start);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}
