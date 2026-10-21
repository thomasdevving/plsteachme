// The evaluation page and the coaching debug panel are for development and staff
// testing only. Set ENABLE_INTERNAL_TOOLS=true to use them on a deployed site.
export function internalToolsEnabled() {
  return process.env.NODE_ENV === 'development' || process.env.ENABLE_INTERNAL_TOOLS === 'true';
}
