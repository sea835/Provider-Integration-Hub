export interface TickScale {
  max: number;
  ticks: number[];
}

export function niceTicks(maxValue: number, target = 4): TickScale {
  const max = Math.max(1, maxValue);
  const raw = max / target;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(
    1,
    [1, 2, 5, 10].map((factor) => factor * magnitude).find((value) => value >= raw) ?? 10 * magnitude,
  );
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let value = 0; value <= top; value += step) ticks.push(value);
  return { max: top, ticks };
}

export function smoothPath(points: Array<[number, number]>): string {
  const count = points.length;
  if (count === 0) return "";
  if (count === 1) return `M${points[0][0]},${points[0][1]}`;

  const widths: number[] = [];
  const slopes: number[] = [];
  for (let index = 0; index < count - 1; index += 1) {
    const width = points[index + 1][0] - points[index][0];
    widths.push(width);
    slopes.push((points[index + 1][1] - points[index][1]) / width);
  }

  const tangents: number[] = [slopes[0]];
  for (let index = 1; index < count - 1; index += 1) {
    tangents.push(slopes[index - 1] * slopes[index] <= 0 ? 0 : (slopes[index - 1] + slopes[index]) / 2);
  }
  tangents.push(slopes[count - 2]);

  for (let index = 0; index < count - 1; index += 1) {
    if (slopes[index] === 0) {
      tangents[index] = 0;
      tangents[index + 1] = 0;
      continue;
    }
    const before = tangents[index] / slopes[index];
    const after = tangents[index + 1] / slopes[index];
    const length = Math.hypot(before, after);
    if (length > 3) {
      tangents[index] = (3 / length) * before * slopes[index];
      tangents[index + 1] = (3 / length) * after * slopes[index];
    }
  }

  let path = `M${points[0][0]},${points[0][1]}`;
  for (let index = 0; index < count - 1; index += 1) {
    const third = widths[index] / 3;
    const [x0, y0] = points[index];
    const [x1, y1] = points[index + 1];
    path += `C${x0 + third},${y0 + tangents[index] * third} ${x1 - third},${y1 - tangents[index + 1] * third} ${x1},${y1}`;
  }
  return path;
}

export function roundedTopBar(x: number, y: number, width: number, height: number, radius: number): string {
  const r = Math.min(radius, width / 2, height);
  return `M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height}Z`;
}
