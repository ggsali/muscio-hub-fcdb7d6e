import React from "react";

interface StatusBadgeProps {
  status: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  // Order statuses
  "Offen": { label: "Offen", className: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" },
  "In Bearbeitung": { label: "In Bearbeitung", className: "bg-blue-500/20 text-blue-400 border border-blue-500/30" },
  "Abgeschlossen": { label: "Abgeschlossen", className: "bg-green-500/20 text-green-400 border border-green-500/30" },
  "Storniert": { label: "Storniert", className: "bg-red-500/20 text-red-400 border border-red-500/30" },
  // Part statuses
  "Ausstehend": { label: "Ausstehend", className: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" },
  "In Druck": { label: "In Druck", className: "bg-blue-500/20 text-blue-400 border border-blue-500/30" },
  "Fertig": { label: "Fertig", className: "bg-green-500/20 text-green-400 border border-green-500/30" },
  "Geliefert": { label: "Geliefert", className: "bg-purple-500/20 text-purple-400 border border-purple-500/30" },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const config = statusConfig[status] || { label: status, className: "bg-muted text-muted-foreground" };
  return (
    <span className={`status-badge ${config.className}`}>
      {config.label}
    </span>
  );
};
