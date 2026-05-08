import { Toolbar } from "./components/Toolbar";
import { Canvas } from "./components/Canvas";
import { Timeline } from "./components/Timeline";
import { PropertiesPanel } from "./components/PropertiesPanel";
import styles from "./App.module.css";

function App() {
  return (
    <div className={styles.app}>
      <Toolbar />
      <div className={styles.main}>
        <Canvas />
        <PropertiesPanel />
      </div>
      <Timeline />
    </div>
  );
}

export default App;
