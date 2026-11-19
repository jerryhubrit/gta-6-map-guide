/* Yanis v16 community cartography, GTADB and contributors, CC BY 4.0.
   Original z5 tiles are cropped to the registered square and compressed into an offline WebP pyramid.
   Region anchors summarize groups of source observations. */
window.ATLAS_MAP = {
  width: 1000,
  height: 1000,
  anchors: {
    port: [335, 397],
    ambrosia: [530, 355],
    grass: [472, 793],
    keys: [550, 871],
    mount: [431, 228],
    vice: [677, 547],
  },
  project(rawX, rawY) {
    if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) return null;
    return [(rawX - 3550) / 19, (rawY - 5450) / 19];
  },
  unproject(x, y) {
    return [3550 + 19*x, 5450 + 19*y];
  },
  kind: '社区重建底图',
  credit: 'Yanis v16 · GTADB 与社区制图者 · CC BY 4.0',
  url: 'https://github.com/rolux/gtadb.org/tree/7c3f8c295d64254e6b6d269b77c6f84fc4339f9c/maps',
  license: 'https://creativecommons.org/licenses/by/4.0/',
  derivative: 'https://github.com/navanem/gta6-leonida-atlas/tree/0c7434f5bd5ed59a58aaa75a3ba7c3734fa0c4d0/public/assets/street-leonida/maps/gtadb-yanis-16-z5',
};
