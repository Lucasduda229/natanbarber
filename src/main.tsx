import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { cleanupRogueServiceWorkers } from "./utils/pwaUpdate";
import { registerAudioUnlock } from "./utils/notificationSound";

// Limpa registros residuais de SW conflitantes em PWAs já instalados
cleanupRogueServiceWorkers();

// Desbloqueia o AudioContext na primeira interação do usuário
// (obrigatório no iOS/Android para tocar sons via Web Audio API)
registerAudioUnlock();

createRoot(document.getElementById("root")!).render(<App />);

