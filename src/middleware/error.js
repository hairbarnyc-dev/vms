export const notFound = (req, res) => res.status(404).json({ error: 'Not found' })
export const errorHandler = (err, req, res, _next) => {
  console.error(err)
  res.status(err.status || 500).json({ error: err.message || 'Server error' })
}
