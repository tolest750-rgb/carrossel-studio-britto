import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ThemeProvider } from "./lib/theme.tsx";
import { BootSplash } from "./components/BootSplash.tsx";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <BootSplash />
    <App />
  </ThemeProvider>,
);
