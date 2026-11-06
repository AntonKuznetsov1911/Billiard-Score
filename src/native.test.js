import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ writeFile: vi.fn(), share: vi.fn(), addListener: vi.fn(), print: vi.fn() }));
vi.mock("@capacitor/filesystem", () => ({ Filesystem: { writeFile: mocks.writeFile }, Directory: { Cache: "CACHE" }, Encoding: { UTF8: "utf8" } }));
vi.mock("@capacitor/share", () => ({ Share: { share: mocks.share } }));
vi.mock("@capacitor/app", () => ({ App: { addListener: mocks.addListener } }));
vi.mock("@capacitor/core", () => ({ registerPlugin: () => ({ print: mocks.print }) }));
import { exportTextFile, listenToNativeApp, printReport, shareText, shareImageBlob } from "./native.js";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("window", { Capacitor: { isNativePlatform: () => true, getPlatform: () => "android" } });
});
afterEach(() => vi.unstubAllGlobals());
it("exports a UTF-8 backup from the app's cache through the Android share sheet", async () => {
  mocks.writeFile.mockResolvedValue({ uri: "file:///cache/exports/backup.json" });
  mocks.share.mockResolvedValue({});
  await exportTextFile("backup.json", '{"игрок":"Антон"}', "application/json");
  expect(mocks.writeFile).toHaveBeenCalledWith(expect.objectContaining({ path: "exports/backup.json", data: '{"игрок":"Антон"}', encoding: "utf8", directory: "CACHE" }));
  expect(mocks.share).toHaveBeenCalledWith(expect.objectContaining({ files: ["file:///cache/exports/backup.json"] }));
});
it("does not open a sharing sheet after a failed file write", async () => {
  mocks.writeFile.mockRejectedValue(new Error("disk full"));
  await expect(exportTextFile("backup.json", "{}")).rejects.toThrow("disk full");
  expect(mocks.share).not.toHaveBeenCalled();
});
it("writes image bytes as binary and shares only the generated local file", async () => {
  mocks.writeFile.mockResolvedValue({ uri: "file:///cache/result.png" });
  mocks.share.mockResolvedValue({});
  await shareImageBlob(new Blob([new Uint8Array([137,80,78,71])], {type:"image/png"}), "result.png");
  expect(mocks.writeFile).toHaveBeenCalledWith(expect.objectContaining({ path:"exports/result.png", data:"iVBORw==" }));
  expect(mocks.writeFile.mock.calls[0][0]).not.toHaveProperty("encoding");
  expect(mocks.share).toHaveBeenCalledWith(expect.objectContaining({ files:["file:///cache/result.png"] }));
});
it("unsubscribes listeners even if registration finishes after cleanup", async () => {
  const pending = [];
  mocks.addListener.mockImplementation((event, callback) => new Promise((resolve) => pending.push({ event, callback, resolve })));
  const back = vi.fn(), pause = vi.fn();
  const stop = listenToNativeApp({ back, pause });
  pending.find((p) => p.event === "backButton").callback();
  const state = pending.find((p) => p.event === "appStateChange");
  state.callback({ isActive: true }); expect(pause).not.toHaveBeenCalled();
  state.callback({ isActive: false }); expect(pause).toHaveBeenCalledOnce();
  expect(back).toHaveBeenCalledOnce();
  stop();
  const remove = vi.fn(); pending.forEach((p) => p.resolve({ remove }));
  await Promise.resolve(); expect(remove).toHaveBeenCalledTimes(2);
});
it("uses Android printing and text sharing without browser fallbacks", async () => {
  mocks.print.mockResolvedValue({}); mocks.share.mockResolvedValue({});
  await printReport(); expect(mocks.print).toHaveBeenCalledOnce();
  expect(await shareText({ text: "Победа" })).toBe(true);
  expect(mocks.share).toHaveBeenCalledWith({ text: "Победа" });
});
