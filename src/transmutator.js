const _              = require("underscore")
const debug          = require("debug")("transmutator")
const { snakeCase }  = require("snake-case")

const { splitCanId, extractSignalData, extractValueData } = require("./utils")

const parseDbc = (dbcString, options = {}) => {
	debug(`The raw dbcString:\n`, dbcString)

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
	let boList   = []
	const valList  = []
	// Issues can have three severities:
	// info    = this won't cause any major problems and will only affect the message/parameter on the current line
	// warning = this will cause major problems, but only for the message/parameter on the current line
	// error   = this will cause major problems for multiple messages/parameters in both the current line and lines below
	const problems = []
	// TODO change some throws into warnings (and remove lineInDbc from BO_)
	// const warnings = {}

	// Read each line of the parsed .dbc file and run helper functions when the line starts with "BO_, SG_ or VAL_"
	_.each(dbcData, (line, index) => {
		if(!line || line.length === 1)
			return

		switch(line[0]) {
			case("BO_"): // BO_ 2147486648 Edgy: 8 Vector__XXX
				if(line.length !== 5) {
					throw new Error(`BO_ on line ${index + 1} does not follow DBC standard (should have five pieces of text/numbers), all parameters in this message won't have a PGN or source.`)
					// problems.push({severity: "error", line: index + 1, description: "BO_ line does not follow DBC standard (should have five pieces of text/numbers), all parameters in this message won't have a PGN or source."})
				}

				// Push previous BO and reset currentBo if not first one
				if(!_.isEmpty(currentBo)) {
					if(_.isEmpty(currentBo.signals)) {
						// throw new Error(`BO_ doesn't contain any parameters in the DBC file on line ${currentBo.lineInDbc}`)
						problems.push({severity: "warning", line: currentBo.lineInDbc, description: "BO_ does not contain any SG_ lines; message does not have any parameters."})
					}
					boList.push(currentBo)
					currentBo = {}
				}

				// Get data fields
				let [, canId, name, dlc] = line

				if(isNaN(canId)) {
					throw new Error(`BO_ CAN ID on line ${index + 1} is not a number, all parameters in this message won't have a PGN or source.`)
					// problems.push({severity: "error", line: index + 1, description: "BO_ CAN ID is not a number, all parameters in this message won't have a PGN or source."})
				}
				name  = name.slice(0, -1)
				canId = parseInt(canId)
				dlc   = parseInt(dlc)

				const duplicateCanId = _.find(boList, { canId })

				if(duplicateCanId) {
					// throw new Error(`Please deduplicate second instance of CAN ID \"${canId}\" in the DBC file on line ${index + 1}`)
					problems.push({severity: "warning", line: index + 1, description: "BO_ CAN ID already exists in this file. Nothing will break on our side, but the data will be wrong because the exact same CAN data will be used on two different parameters."})
				}

				// Split CAN ID into PGN, source and priority (if isExtendedFrame)
				try {
					let { isExtendedFrame, priority, pgn, source } = splitCanId(canId)
					let label = snakeCase(name)

					if(options.extendedLabel)
						label = snakeCase(currentBo.name) + label

					// Add all data fields
					currentBo = {
						canId,
						pgn,
						source,
						name,
						priority,
						label,
						isExtendedFrame,
						dlc,
						signals: [],
						lineInDbc: (index + 1),
						problems: []
					}
				} catch (e) {
					throw new Error(`The parser broke unexpectedly :( Please contact the VT team and send them the DBC file you were trying to parse as well as this error message:\n${e}`)
				}

				break

			case("SG_"): // SG_ soc m0 : 8|8@1+ (0.5,0) [0|100] "%" Vector__XXX
				if(line.length < 8 || line.length > 9) {
					throw new Error(`SG_ line at ${index + 1} does not follow DBC standard; should have eight pieces of text/numbers (or nine for multiplexed parameters).`)
				}

				try{
					currentBo.signals.push(extractSignalData(line, currentBo.label, index + 1))
				} catch (e) {
					problems.push({severity: "error", line: index + 1, description: "Can't parse multiplexer data from SG_ line, there should either be \" M \" or \" m0 \" where 0 can be any number. This will lead to incorrect data for this parameter."})
				}

				break

			case("VAL_"):
				let problem

				if(line.length % 2 !== 0) {
					problems.push({severity: "warning", line: index + 1, description: "VAL_ line does not follow DBC standard; amount of text/numbers in the line should be an even number. States/values will be incorrect, but data is unaffected."})
					return
				}

				if(line.length < 7) {
					//Duplicate so we can also keep storing problems that are not directly linked to one specific message/signal/state
					//This version will only be sent to front-end to display total list of errors/warnings
					problems.push({severity: "warning", line: index + 1, description: "VAL_ line only contains one state, nothing will break but it defeats the purpose of having states/values for this parameter."})
					//This version will be stored in the data model for highlighting in front-end
					problem = {severity: "warning", line: index + 1, description: "VAL_ line only contains one state, nothing will break but it defeats the purpose of having states/values for this parameter."}
				}

				let { boLink, sgLink, states } = extractValueData(line)

				valList.push({ boLink, sgLink, states, lineInDbc: (index + 1), problem: problem })

				break

			case("SIG_VALTYPE_"): // SIG_VALTYPE_ 1024 DoubleSignal0 : 2;
				// TODO implement reading Floats/Doubles directly from CAN
				break

			// TODO match all possible DBC lines to display warning when something outside the standard is shown

			default:
				debug(`Skipping non implementation line that starts with ${line}`, line)
		}
	})

	if(!_.isEmpty(currentBo))
		boList.push(currentBo)

	boList = _.reject(boList, ({pgn}) => pgn === 0)

	if(options.filterDM1 === true)
		boList = _.reject(boList, ({pgn}) => pgn === 65226)

	if(!boList.length)
		throw new Error(`Invalid DBC: Could not find any BO_ or SG_ lines`)

	// Add VAL_ list to correct SG_
	valList.forEach((val) => {
		let bo = _.find(boList, {canId: val.boLink})
		if(!bo) {
			problems.push({severity: "warning", line: val.lineInDbc, description: `VAL_ line could not be matched to BO_ because CAN ID ${val.boLink} can not be found in any message. Nothing will break, and if we add the correct values/states later there won't even be any data loss.`})
			return
		}
		let sg = _.find(bo.signals, {name: val.sgLink})
		if(!sg) {
			problems.push({severity: "warning", line: val.lineInDbc, description: `VAL_ line could not be matched to SG_ because there's no parameter with the name ${val.sgLink} in the DBC file. Nothing will break, but the customer might intend to add another parameter to the DBC file, so they might complain that it's missing.`})
			return
		}
		sg.states = val.states

		if(val.problem) {
			sg.problems.push(val.problem)
		}
	})

	// Add all problems to their corresponding messages and signals
	problems.forEach((problem) =>  {

		// Search through messages
		let message = _.find(boList, {lineInDbc: problem.line})
		if(message) {
			message.problems.push(problem)
			return
		}

		// Search through signals
		boList.forEach((bo) => {
			bo.signals.forEach((sg) => {
				let signal = _.find(sg, {lineInDbc: problem.line})
				if(signal) {
					signal.problems.push(problem)
					return
				}
			})
		})
	})

	let result = {"params": boList, "problems": problems}
	debug(JSON.stringify(boList, null, 4))
	debug(problems)
	return result
}

module.exports = parseDbc
