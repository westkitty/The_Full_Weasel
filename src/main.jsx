import ReactDOM from "react-dom/client";
import App from "./App";
import "./App.css";

ReactDOM.createRoot(document.getElementById("root")).render(<App />);

if (!__FULL_WEASEL_EMBED__ && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Keep the game running even if SW registration fails.
    });
  });
}

window.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || window.parent === window) return;
  event.preventDefault();
  window.parent.postMessage({ type: "full-weasel:close" }, "*");
});
