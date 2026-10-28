// Zuschlag für Teile, die grösser als das grösste Druckbett (420 mm) sind: der Slicer teilt sie automatisch
// in gleich grosse Stücke, die danach von Hand verklebt werden. Der Zuschlag gilt pro Schnitt und pro Stück.
export const SPLIT_CUT_FEE_CHF = 15;

/** Anzahl der Schnitte bei n Teilen (n-1), mindestens 0. */
export const splitCuts = (parts?: number | null): number => Math.max(0, Math.floor(Number(parts) || 1) - 1);

/** Zuschlag pro Stück in CHF für ein Modell, das in `parts` Teile geteilt wird. */
export const splitFee = (parts?: number | null): number => splitCuts(parts) * SPLIT_CUT_FEE_CHF;
