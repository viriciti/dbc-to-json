const { splitCanId, extractSignalData } = require("./utils")
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

	let currentBo = {}
	const boList = []
	const warnings = {}

	// Read each line of the parsed .dbc file and run helper functions when the line starts with "BO_, SG_ or VAL_"
	_.each(dbcData, (line, index) => {
		if(!line || line.length === 1)
			return

		switch(line[0]) {
			case("BO_"): // BO_ 2147486648 Edgy: 8 Vector__XXX
				if(line.length !== 5) throw new Error(`Non-standard BO_ line can't be parsed at line ${index + 1}`)

				// Push previous BO and reset currentBo if not first one
				if(!_.isEmpty(currentBo)) {
					boList.push(currentBo)
					currentBo = {}
				}

				// Get data fields
				let [, canId, name, dlc] = line

				const duplicateCanId = _.find(boList, { canId })

				if(duplicateCanId) throw new Error(`Please deduplicate second instance of CAN ID \"${canId}\" on line ${index + 1}`)

				// Split CAN ID into PGN, source and priority (if isExtendedFrame)
				try {
					let { isExtendedFrame, priority, pgn, source } = splitCanId(canId)

					// Add all data fields
					currentBo = { canId, pgn, source, name, priority, isExtendedFrame, dlc, lineInDbc: (index + 1), signals: [] }
				} catch (e) {
					throw new Error(`CAN ID \"${canId}\" is not a number at line ${index + 1}`)
				}

				break

			case("SG_"): // SG_ soc m0 : 8|8@1+ (0.5,0) [0|100] "%" Vector__XXX
				// Throw if wrong size
				if(line.length < 8 || line.length > 9) throw new Error(`Non-standard SG_ line can't be parsed at line ${index + 1}`)

				try{
					currentBo.signals.push(extractSignalData(line))
				} catch (e) {
					throw new Error(`${e.message} on line ${index + 1}`)
				}


				// Gather all data
				break

			case("VAL_"):
				break

			default:
				debug(`Skipping non implementation line that starts with ${line}`, line)
		}
	})

	boList.push(currentBo)

	// console.log(JSON.stringify(boList, null, 4))
	// Add VAL_ list to correct SG_
	// Go over all signals, add the multiplexor start bit/bit length to all multiplexed signals
	// Go over all signals, do the typeOfUnit (deg C -> temperature)
}

module.exports = parseDbc
