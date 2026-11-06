import { registerPlugin } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

const NativePrint = registerPlugin("BilliardPrint");

export function isNativeApp() {
  try {
    return !!(typeof window !== "undefined" && window.Capacitor?.isNativePlatform?.());
  } catch { return false; }
}

export async function exportTextFile(filename, text, mime = "text/plain;charset=utf-8") {
  if (isNativeApp()) {
    const path = `exports/${filename}`;
    const file = await Filesystem.writeFile({ path, data: text, directory: Directory.Cache, encoding: Encoding.UTF8, recursive: true });
    await Share.share({ title: filename, files: [file.uri], dialogTitle: "Сохранить или отправить файл" });
    return;
  }
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function shareText(options) {
  if (isNativeApp()) { await Share.share(options); return true; }
  if (navigator.share) { await navigator.share(options); return true; }
  return false;
}

export function listenToNativeApp({ back, pause }) {
  if (!isNativeApp()) return () => {};
  let disposed = false;
  const handles = [];
  const add = (event, callback) => {
    App.addListener(event, callback).then((handle) => {
      if (disposed) handle.remove();
      else handles.push(handle);
    }).catch(() => {});
  };
  add("backButton", back);
  add("appStateChange", ({ isActive }) => { if (!isActive) pause(); });
  return () => { disposed = true; handles.forEach((handle) => handle.remove()); };
}

export function minimizeNativeApp() {
  if (isNativeApp()) App.minimizeApp().catch(() => {});
}

export async function printReport() {
  if (isNativeApp() && window.Capacitor.getPlatform() === "android") {
    await NativePrint.print();
  } else window.print();
}
