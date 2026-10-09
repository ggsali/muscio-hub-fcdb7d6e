# SLA-/Resin-Ausblendung
- [x] Gemeinsame Textfilter und öffentliche Einstellungen für Seiten und Suchmaschinenangaben vereinheitlichen.
- [x] Verbliebene Erwähnungen, Datenbank-Inhalte und direkte Resin-Seiten ausblenden.
- [x] Beide KI-Assistenten auf ausschliessliche FDM-Beratung begrenzen.
- [x] Ausgeschalteten und eingeschalteten Zustand prüfen: öffentliche Kernseiten im Browser; fünf Regressionstests bestanden.
- Live-KI-Antworten wurden nicht getestet; geänderte Edge Functions müssen veröffentlicht werden.
- [x] Speichern in den Website-Einstellungen aktualisiert sofort die öffentliche Seite (Cache-Neuladen des Resin-Werts).
- [x] Schalter im Browser geprüft: aus → SLA/Resin nirgends sichtbar, Resin-Seite leitet um; an → alles wieder da. Ursache war die fehlende Leserechte-Freigabe für `resin_enabled`.
