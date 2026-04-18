export function cutoffSpanDays_(startDay: number, endDay: number): number {
  return ((endDay - startDay + 7) % 7) + 1;
}

export function currentCutoffBounds(
  today: Date,
  startDay: number = 1,
  endDay: number = 6,
) {
  const d = new Date(today);
  d.setHours(0, 0, 0, 0);

  const currentDay = d.getDay();
  const spanDays = cutoffSpanDays_(startDay, endDay);

  let diffToStart = currentDay - startDay;
  if (diffToStart < 0) diffToStart += 7;

  const start = new Date(d);
  start.setDate(d.getDate() - diffToStart);

  const end = new Date(start);
  end.setDate(start.getDate() + (spanDays - 1));
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

export function lastCutoffBounds(
  today: Date,
  startDay: number = 1,
  endDay: number = 6,
) {
  const current = currentCutoffBounds(today, startDay, endDay);

  const start = new Date(current.start);
  start.setDate(start.getDate() - 7);

  const end = new Date(current.end);
  end.setDate(end.getDate() - 7);

  return { start, end };
}

export function previousRangeForPreset(
  preset: string,
  cutoffStart: number = 1,
  cutoffEnd: number = 6,
) {
  const now = new Date();

  if (preset === "CC") {
    return lastCutoffBounds(now, cutoffStart, cutoffEnd);
  }

  if (preset === "LC") {
    const last = lastCutoffBounds(now, cutoffStart, cutoffEnd);

    const start = new Date(last.start);
    start.setDate(start.getDate() - 7);

    const end = new Date(last.end);
    end.setDate(end.getDate() - 7);

    return { start, end };
  }

  // ✅ ADD THIS
  if (preset === "TM") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return { start, end };
  }

  // optional but good
  if (preset === "LM") {
    const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const end = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      0,
      23,
      59,
      59,
      999,
    );
    return { start, end };
  }

  return null;
}
