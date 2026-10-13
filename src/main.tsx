import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { cleanupRogueServiceWorkers } from "./utils/pwaUpdate";

// Limpa registros residuais de SW conflitantes em PWAs já instalados
cleanupRogueServiceWorkers();

createRoot(document.getElementById("root")!).render(<App />);

