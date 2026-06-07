export const defaultColumnLabels = {
  shipmentNumber: "Shipment #",
  cashAdvance: "Cash Advance",
};

export function getColumnLabels() {
  try {
    const saved = localStorage.getItem("column-labels");
    return saved
      ? { ...defaultColumnLabels, ...JSON.parse(saved) }
      : defaultColumnLabels;
  } catch {
    return defaultColumnLabels;
  }
}

export function saveColumnLabels(labels: Record<string, string>) {
  localStorage.setItem("column-labels", JSON.stringify(labels));
}
