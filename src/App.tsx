import { Toolbar } from "./components/Toolbar";
import { Canvas } from "./components/Canvas";
import { Timeline } from "./components/Timeline";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { SettingsApp } from "./components/SettingsApp";
import { LoadingOverlay } from "./components/LoadingOverlay";
import styles from "./App.module.css";

function App() {
  if (window.location.hash.startsWith("#settings")) {
    return <SettingsApp />;
  }
  return (
    <div className={styles.app}>
      <Toolbar />
      <div className={styles.main}>
        <Canvas />
        <PropertiesPanel />
      </div>
      <Timeline />
      <LoadingOverlay />
    </div>
  );
}

export default App;
