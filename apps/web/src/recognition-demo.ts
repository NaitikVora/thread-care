// Presentation-only synthetic data. Never insert into the diary or AI context.
export function recognitionDemo(endDay: string) {
  const independent = [
    0, 1, 1, 0, 1, 1, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 2, 2, 1, 2, 2, 2, 2, 3, 2,
    2, 3, 2, 3, 3,
  ];
  const cued = [
    2, 1, 2, 2, 1, 2, 2, 2, 2, 1, 2, 2, 1, 2, 1, 2, 1, 1, 2, 1, 2, 1, 2, 1, 1,
    2, 1, 1, 1, 1,
  ];
  return independent.map((value, index) => {
    const date = new Date(endDay + "T12:00:00Z");
    date.setUTCDate(date.getUTCDate() - 29 + index);
    return {
      day: date.toISOString().slice(0, 10),
      observations: 4,
      independent: value,
      cued: cued[index],
      introduction: 4 - value - cued[index],
    };
  });
}
