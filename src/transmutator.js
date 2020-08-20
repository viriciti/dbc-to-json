const _              = require("underscore")
const debug          = require("debug")("transmutator")
const { snakeCase }  = require("snake-case")

const { splitCanId, extractSignalData, extractValueData } = require("./utils")

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

	let currentBo  = {}
	const boList   = []
	const valList  = []
	// TODO change some throws into warnings (and remove lineInDbc from BO_)
	// const warnings = {}

	// Read each line of the parsed .dbc file and run helper functions when the line starts with "BO_, SG_ or VAL_"
	_.each(dbcData, (line, index) => {
		if(!line || line.length === 1)
			return

		switch(line[0]) {
			case("BO_"): // BO_ 2147486648 Edgy: 8 Vector__XXX
				if(line.length !== 5) throw new Error(`Non-standard BO_ line can't be parsed in the DBC file on line ${index + 1}`)

				// Push previous BO and reset currentBo if not first one
				if(!_.isEmpty(currentBo)) {
					if(_.isEmpty(currentBo.signals)) throw new Error(`BO_ doesn't contain any parameters in the DBC file on line ${currentBo.lineInDbc}`)
					boList.push(currentBo)
					currentBo = {}
				}

				// Get data fields
				let [, canId, name, dlc] = line

				if(isNaN(canId)) throw new Error(`CAN ID is not a number in the DBC file on line ${index + 1}`)

				name  = name.slice(0, -1)
				canId = parseInt(canId)
				dlc   = parseInt(dlc)

				const duplicateCanId = _.find(boList, { canId })

				if(duplicateCanId) throw new Error(`Please deduplicate second instance of CAN ID \"${canId}\" in the DBC file on line ${index + 1}`)

				// Split CAN ID into PGN, source and priority (if isExtendedFrame)
				try {
					let { isExtendedFrame, priority, pgn, source } = splitCanId(canId)

					// Add all data fields
					currentBo = {
						canId,
						pgn,
						source,
						name,
						priority,
						isExtendedFrame,
						dlc,
						signals: [],
						lineInDbc: (index + 1),
						label: snakeCase(name)
					}
				} catch (e) {
					throw new Error(`CAN ID \"${canId}\" is not a number at line ${index + 1}`)
				}

				break

			case("SG_"): // SG_ soc m0 : 8|8@1+ (0.5,0) [0|100] "%" Vector__XXX
				if(line.length < 8 || line.length > 9) throw new Error(`Non-standard SG_ line can't be parsed at line ${index + 1}`)

				try{
					currentBo.signals.push(extractSignalData(line, currentBo.label))
				} catch (e) {
					throw new Error(`${e.message} in the DBC file on line ${index + 1}`)
				}

				break

			case("VAL_"):
				if(line.length % 2 !== 0) throw new Error(`Non-standard VAL_ line can't be parsed at line ${index + 1}`)
				if(line.length < 7) throw new Error(`VAL_ line only contains one state at line ${index + 1}`) // Should be a warning

				let { boLink, sgLink, states } = extractValueData(line)

				valList.push({ boLink, sgLink, states, lineInDbc: (index + 1) })

				break

			case("SIG_VALTYPE_"): // SIG_VALTYPE_ 1024 DoubleSignal0 : 2;
				// TODO implement reading Floats/Doubles directly from CAN
				break

			default:
				debug(`Skipping non implementation line that starts with ${line}`, line)
		}
	})

	boList.push(currentBo)

	// Add VAL_ list to correct SG_
	valList.forEach((val) => {
		let bo = _.find(boList, {canId: val.boLink})
		if(!bo) {
			throw new Error(`Can't find matching BO_ with CAN ID ${val.boLink} for VAL_ in the DBC file on line ${val.lineInDbc}`)
		}
		let sg = _.find(bo.signals, {name: val.sgLink})
		if(!sg) {
			throw new Error(`Can't find matching SG_ with name ${val.sgLink} for VAL_ in the DBC file on line ${val.lineInDbc}`)
		}
		sg.states = val.states
	})

	// TODO Go over all signals, do the typeOfUnit (deg C -> temperature)

	debug(JSON.stringify(boList, null, 4))
	return boList
}

module.exports = parseDbc
