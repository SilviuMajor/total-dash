import { createRoot } from "react-dom/client";
// Side-effect import: hydrates sessionStorage from the cross-tab localStorage
// mirror and installs the storage-event listener BEFORE any hook or guard
// reads sessionStorage. Must run before App imports.
import "./lib/impersonation-bridge";
import App from "./App.tsx";
import "./index.css";
import "./styles/marketing.css";

createRoot(document.getElementById("root")!).render(<App />);
