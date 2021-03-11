const debug          = require("debug")("validator")

const validateJson = (dbcObject, options = {}) => {
	debug(`The raw dbcObject:\n`, dbcObject)
	return dbcObject
}

module.exports = validateJson