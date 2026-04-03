import { usePlayerController } from "@features/player/controller/usePlayerController";
import { PlayerScreen } from "@features/player/ui/PlayerScreen";

function App() {
  const controller = usePlayerController();

  return <PlayerScreen {...controller} />;
}

export default App;
