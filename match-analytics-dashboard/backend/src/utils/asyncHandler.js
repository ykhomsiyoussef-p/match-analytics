// Transmet les erreurs des fonctions async à Express (version 4).
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
