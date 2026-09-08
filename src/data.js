export const sessions = ["Practice 1", "Practice 2", "Qualifying", "Race"];
export const uid = () => crypto.randomUUID();
export const kinds = ["cars", "tasks", "stints", "radio", "weekend"];
export const emptyData = () => Object.fromEntries(kinds.map((k) => [k, []]));
export function sampleData() {
  const data = {
    cars: [
      {
        number: "14",
        model: "Porsche 911 GT3 R",
        driver: "M. Laurent / S. Keene",
        status: "Ready",
        fuel: 68,
        tyres: "Medium",
        note: "Balance confirmed. Ready for the next run.",
      },
      {
        number: "27",
        model: "Porsche 911 GT3 R",
        driver: "A. Rossi / N. Varga",
        status: "Attention",
        fuel: 41,
        tyres: "Soft",
        note: "Check front vibration before release.",
      },
    ],
    tasks: [
      {
        title: "Investigate front-end vibration",
        owner: "Maya",
        car: "27",
        priority: "High",
        due: "14:15",
        done: false,
      },
      {
        title: "Prepare medium tyre set",
        owner: "Jon",
        car: "14",
        priority: "Normal",
        due: "14:25",
        done: false,
      },
      {
        title: "Confirm parc ferme equipment",
        owner: "Leah",
        car: "All",
        priority: "Normal",
        due: "14:40",
        done: false,
      },
      {
        title: "Calibrate fuel rig",
        owner: "Owen",
        car: "All",
        priority: "Normal",
        due: "13:50",
        done: true,
      },
    ],
    stints: [
      {
        session: "Practice 2",
        time: "14:12",
        car: "14",
        driver: "S. Keene",
        tyres: "Medium",
        fuel: 68,
        laps: 12,
        target: "1:49.800",
      },
      {
        session: "Practice 2",
        time: "14:26",
        car: "27",
        driver: "A. Rossi",
        tyres: "Soft",
        fuel: 42,
        laps: 10,
        target: "1:50.200",
      },
      {
        session: "Practice 2",
        time: "14:45",
        car: "14",
        driver: "M. Laurent",
        tyres: "Medium",
        fuel: 48,
        laps: 14,
        target: "1:49.500",
      },
      {
        session: "Qualifying",
        time: "10:30",
        car: "14",
        driver: "S. Keene",
        tyres: "Soft",
        fuel: 22,
        laps: 4,
        target: "1:48.900",
      },
    ],
    radio: [
      {
        time: "14:07",
        source: "Garage",
        message: "Fuel rig calibrated. Spare wheel guns charged.",
      },
      {
        time: "14:02",
        source: "Pit wall",
        message: "Car 14 balance looks good. Prepare the next medium set.",
      },
      {
        time: "13:58",
        source: "Car 27",
        message: "Front vibration reported through Ascari exit.",
      },
    ],
    weekend: [
      {
        name: "Monza",
        series: "GT World Challenge Europe",
        date: "2026-09-19",
        circuit: "Autodromo Nazionale Monza",
        team: "Apex Racing",
      },
    ],
  };
  for (const kind of kinds)
    data[kind] = data[kind].map((r) => ({ ...r, id: uid() }));
  return data;
}
export function validate(kind, record) {
  const required = {
    cars: ["number", "model", "driver"],
    tasks: ["title", "owner", "due"],
    stints: ["time", "car", "driver", "target"],
    radio: ["source", "message", "time"],
    weekend: ["name", "date", "circuit", "team"],
  };
  for (const field of required[kind])
    if (!String(record[field] ?? "").trim())
      throw new Error(
        `${field[0].toUpperCase() + field.slice(1)} is required.`,
      );
  if (kind === "cars" && !/^\d{1,3}$/.test(record.number))
    throw new Error("Car number must be between 0 and 999.");
  if (
    ["cars", "stints"].includes(kind) &&
    (record.fuel === "" ||
      !Number.isFinite(+record.fuel) ||
      +record.fuel < 0 ||
      +record.fuel > 200)
  )
    throw new Error("Fuel must be between 0 and 200 litres.");
  if (
    kind === "stints" &&
    (!Number.isInteger(+record.laps) || +record.laps < 1 || +record.laps > 200)
  )
    throw new Error("Laps must be a whole number between 1 and 200.");
  if (kind === "stints" && !/^\d{1,2}:[0-5]\d\.\d{3}$/.test(record.target))
    throw new Error("Use a target lap time such as 1:49.800.");
  return record;
}
