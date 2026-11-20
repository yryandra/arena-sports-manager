const { createResourceRouter } = require('./resourceRoutes')
module.exports = (store) => createResourceRouter('athletes', store)
