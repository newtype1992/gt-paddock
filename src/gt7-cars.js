import catalog from './gt7-cars.json' with { type: 'json' };

// Reference photos identify the model, not the player's paint or custom livery.
const images = {
  82: {
    url: 'https://www.gran-turismo.com/images/c/i1hYGhS4zGzJWSB.jpg',
    source: 'https://www.gran-turismo.com/gb/news/00_5694394.html',
  },
};

export function carIdentity(id, source = 'console') {
  if (source === 'simulation') return { name: 'Simulation', image: null };
  const car = Number.isInteger(Number(id)) && id != null ? catalog.cars[String(id)] : null;
  return {
    name: car ? `${car.manufacturer} ${car.model}` : id == null ? 'No car detected' : `Unknown car (ID ${id})`,
    image: car ? images[id] ?? null : null,
  };
}
