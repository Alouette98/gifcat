import { Toolbar } from "./components/Toolbar";
import { Canvas } from "./components/Canvas";
import { Timeline } from "./components/Timeline";
import styles from "./App.module.css";

function App() {
  return (
    <div className={styles.app}>
      <Toolbar />
      <Canvas />
      <Timeline />
    </div>
  );
}

export default App;
