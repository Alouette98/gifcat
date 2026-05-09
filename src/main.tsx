import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./i18n";
import "./store/themeStore";
import "./ipc/menu";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
