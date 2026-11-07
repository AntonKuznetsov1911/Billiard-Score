import { registerPlugin } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

const NativePrint = registerPlugin("BilliardPrint");
const NativeUX = registerPlugin("BilliardUX");

export async function nativeHaptic(type = "light") {
  if (typeof window === "undefined") return false;
  try {
    if (window.localStorage.getItem("billiards-haptics") === "off") return false;
  } catch { /* Optional preference. */ }

  try {
    if (isNativeApp() && window.Capacitor.getPlatform() === "android") {
      return (await NativeUX.tap({ type })).requested === true;
    }
    return window.navigator?.vibrate?.(type === "test" ? 90 : 32) === true;
  } catch {
    return false;
  }
}

export async function shareImageBlob(blob, filename) {
  if (isNativeApp()) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 32768) binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
    const file = await Filesystem.writeFile({ path: `exports/${filename}`, data: btoa(binary), directory: Directory.Cache, recursive: true });
    await Share.share({ title: "Результат партии", files: [file.uri], dialogTitle: "Сохранить или отправить карточку" });
    return;
  }
  const file = new File([blob], filename, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: "Твой бильярд" }); return; }
  const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

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
