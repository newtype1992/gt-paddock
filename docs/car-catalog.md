# GT7 Car Identification

Car names are joined to telemetry car IDs at display time, so existing local and cloud sessions do not need migration. Unknown IDs remain explicitly unknown. Simulation data is never identified as a real car.

`src/gt7-cars.json` is generated from ddm999/gt7info's MIT-0 licensed factual car and manufacturer catalog. The file records the exact source commit. Refresh deliberately using `scripts/update-car-catalog.ps1`; this is not a runtime network dependency.

Source: https://github.com/ddm999/gt7info

The Supra RZ '97 reference image is supplied by the official Gran Turismo news page at https://www.gran-turismo.com/gb/news/00_5694394.html. Image rights remain with their respective owners; the catalog license does not cover that image. The image is loaded remotely with no referrer, and a failed image falls back to an unavailable label.

Only verified photo matches are displayed. Telemetry supplies a model ID, not a photograph of the player's owned car, paint, or custom livery. Other known models display names without substituting unrelated images.
