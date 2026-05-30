/** Merge camera entries by id (multi-cam DVR setup). */
export function mergeCameras(existing, incoming) {
  const map = new Map();
  (existing || []).forEach((c) => {
    if (c?.id) map.set(c.id, { ...c });
  });
  (incoming || []).forEach((c) => {
    if (!c?.id) return;
    map.set(c.id, { ...(map.get(c.id) || {}), ...c });
  });
  return Array.from(map.values());
}

export function buildMergedConfig(currentConfig, newCameras, dvr) {
  const base = currentConfig ? { ...currentConfig } : {};
  const cameras = mergeCameras(base.cameras, newCameras);
  const config_data = { ...base, cameras };
  if (dvr !== undefined) {
    if (dvr) config_data.dvr = dvr;
    else delete config_data.dvr;
  }
  return { config_data };
}
