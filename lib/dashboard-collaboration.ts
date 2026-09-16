export function hasProtectedSlice(keys: string[], protectedKeys: string[]) {
  const contextKeys = new Set(["ui", "currentYear", "years", "availableYears"])
  const protectedSet = new Set(protectedKeys.filter(key => !contextKeys.has(key)))
  return keys.some(key => protectedSet.has(key))
}

export function dashboardSlicesDiffer(current: any, incoming: any, keys: string[]) {
  return keys.some(key => Object.prototype.hasOwnProperty.call(incoming, key) &&
    JSON.stringify(current?.[key]) !== JSON.stringify(incoming[key]))
}
