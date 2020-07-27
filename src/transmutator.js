const { splitCanId } = require("./utils")
const debug          = require("debug")("transmutator")
const _              = require("underscore")

// TODO: remove empty lines without losing link to line number
const parseDbc = (dbcString) => {
	debug(`The raw dbcString:\n`, dbcString)

	// Split .dbc file per line, make sure index of this array corresponds to line number in file
	let dbcArray = dbcString.split("\n")

	debug(`dbcArray:\n`, dbcArray)

	// Turn every element in dbcArray into an array that's matched on whitespaces
	// This means we get a 2D array; dbcData is an array of every line in the .dbc file
	// Each entry in this array is an array containing every parameter of one .dbc line
	// The 2D array dbcData will look like this:
	// [
	// 	[ "BO_", "123", "Message:", "8", "Vector__XXX" ],
	// 	[ "SG_", "Signal", ":", "0|8@1+", "(1,0)", "[0,255]", "", "Vector__XXX" ]
	// ]
	// See https://regex101.com/r/KDmDI8/8 for a visual example
	let dbcData = _.map(dbcArray, (line, index) => {
		return line.match(/"(?:[^"\\]|\\.)*"|[^\s]+/g)
	})

	debug(`dbcData:\n`, dbcData)

	let currentBO = {}
	const BOList = []
	const errors = {}

	// Read each line of the parsed .dbc file and run helper functions when the line starts with "BO_, SG_ or VAL_"
	_.each(dbcData, (line, index) => {
		if(!line || line.length === 1)
			return

		switch(line[0]) {
			case("BO_"):
				// Push previous BO and reset currentBO if not first one
				if(!_.isEmpty(currentBO)){
					boList.push(currentBO)
					currentBo = {}
				}

				// Get data fields
				let [, canId, name, dlc] = line

				// Split CAN ID into PGN, source and priority (if isExtendedFrame)
				let { isExtendedFrame, priority, pgn, source } = splitCanId(canId)

				// Add all data fields
				currentBo = { canId, pgn, source, name, priority, isExtendedFrame, dlc, lineInDbc: index }
				break

			case("SG_"):
				break

			case("VAL_"):
				break

			default:
				debug(`Skipping non implementation line that starts with ${line}`, line)
		}
	})
}

module.exports = parseDbc
