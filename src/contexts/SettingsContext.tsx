import React, { createContext, useContext, useEffect, useState } from "react";
import { Settings, DEFAULT_SETTINGS, loadSettings } from "@/lib/calc";

interface SettingsContextType {
  settings: Settings;
  reload: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: DEFAULT_SETTINGS,
  reload: async () => {},
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  const reload = async () => {
    const s = await loadSettings();
    setSettings(s);
  };

  useEffect(() => { reload(); }, []);

  return (
    <SettingsContext.Provider value={{ settings, reload }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
