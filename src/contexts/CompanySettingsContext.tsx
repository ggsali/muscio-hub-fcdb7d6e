import React, { createContext, useContext, useEffect, useState } from "react";
import { CompanySettings, DEFAULT_COMPANY, loadCompanySettings } from "@/lib/companySettings";

interface CompanySettingsContextType {
  company: CompanySettings;
  reload: () => Promise<void>;
}

const CompanySettingsContext = createContext<CompanySettingsContextType>({
  company: DEFAULT_COMPANY,
  reload: async () => {},
});

export function CompanySettingsProvider({ children }: { children: React.ReactNode }) {
  const [company, setCompany] = useState<CompanySettings>(DEFAULT_COMPANY);

  const reload = async () => {
    const s = await loadCompanySettings();
    setCompany(s);
  };

  useEffect(() => { reload(); }, []);

  return (
    <CompanySettingsContext.Provider value={{ company, reload }}>
      {children}
    </CompanySettingsContext.Provider>
  );
}

export const useCompanySettings = () => useContext(CompanySettingsContext);
