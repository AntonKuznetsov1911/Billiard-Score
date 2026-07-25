import React from "react";
import { createRoot } from "react-dom/client";
import BilliardsTracker from "./BilliardsTracker.jsx";

// Адаптер хранилища: внутри Claude есть window.storage; вне его (браузер,
// Telegram Mini App) используем localStorage с тем же интерфейсом.
if (typeof window !== "undefined" && !window.storage) {
  window.storage = {
    async get(key) {
      const value = window.localStorage.getItem(key);
      if (value === null) throw new Error("key not found");
      return { key, value, shared: false };
    },
    async set(key, value) {
      window.localStorage.setItem(key, value);
      return { key, value, shared: false };
    },
    async delete(key) {
      window.localStorage.removeItem(key);
      return { key, deleted: true, shared: false };
    },
    async list(prefix = "") {
      const keys = Object.keys(window.localStorage).filter((k) => k.startsWith(prefix));
      return { keys, prefix, shared: false };
    },
  };
}

createRoot(document.getElementById("root")).render(<BilliardsTracker />);
