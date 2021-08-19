const _              = require("underscore")
const debug          = require("debug")("transmutator")
const { snakeCase }  = require("snake-case")

const { splitCanId, extractSignalData, extractValData, extractDataTypeData, extractCommentData} = require("./utils")

// Spec : https://github.com/stefanhoelzl/CANpy/blob/master/docs/DBC_Specification.md

const parseDbc = (dbcString, options = {}) => {
	debug(`The raw dbcString:\n`, dbcString)

	let dbcArray = dbcString.split("\n")

	debug(`dbcArray:\n`, dbcArray)

	// Turn every element in dbcArray into an array that's matched on whitespaces
	// This means we get a 2D array; dbcData is an array of every line in the .dbc file
	// Each entry in this array is an array containing every signal of one .dbc line
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

	let currentBo      = {}
	let boList         = []
	const valList      = []
	const dataTypeList = []
	const commentList = []
	const problems     = [] // TODO add fourth problem severity
	// TODO change some throws into warnings (and remove lineInDbc from BO_)

	// Read each line of the parsed .dbc file and run helper functions when the line starts with "BO_, SG_ or VAL_"
	_.each(dbcData, (line, index) => {
		if(!line || line.length === 1)
			return

		switch(line[0]) {
			case("BO_"): // BO_ 2147486648 Edgy: 8 Vector__XXX
			// TODO add problem for duplicate CAN ID
				if(line.length !== 5) {
					throw new Error(`BO_ on line ${index + 1} does not follow DBC standard (should have five pieces of text/numbers), all signals in this message won't have a PGN or source.`)
					// problems.push({severity: "error", line: index + 1, description: "BO_ line does not follow DBC standard (should have five pieces of text/numbers), all signals in this message won't have a PGN or source."})
				}

				// Push previous BO and reset currentBo if not first one
				if(!_.isEmpty(currentBo)) {
					if(_.isEmpty(currentBo.signals)) {
						// throw new Error(`BO_ doesn't contain any signals in the DBC file on line ${currentBo.lineInDbc}`)
						problems.push({severity: "warning", line: currentBo.lineInDbc, description: "BO_ does not contain any SG_ lines; message does not have any signals."})
					}
					boList.push(currentBo)
					currentBo = {}
				}

				// Get data fields
				let [, canId, name, dlc] = line

				if(isNaN(canId)) {
					throw new Error(`BO_ CAN ID on line ${index + 1} is not a number, all signals in this message won't have a PGN or source.`)
					// problems.push({severity: "error", line: index + 1, description: "BO_ CAN ID is not a number, all signals in this message won't have a PGN or source."})
				}
				name  = name.slice(0, -1)
				canId = parseInt(canId)
				dlc   = parseInt(dlc)

				const duplicateCanId = _.find(boList, { canId })

				if(duplicateCanId) {
					// throw new Error(`Please deduplicate second instance of CAN ID \"${canId}\" in the DBC file on line ${index + 1}`)
					problems.push({severity: "warning", line: index + 1, description: "BO_ CAN ID already exists in this file. Nothing will break on our side, but the data will be wrong because the exact same CAN data will be used on two different signals."})
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
						comment : null,
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
					throw new Error(`SG_ line at ${index + 1} does not follow DBC standard; should have eight pieces of text/numbers (or nine for multiplexed signals).`)
				}

				try{
					signalData = extractSignalData(line, currentBo.label, index + 1)

					// Since min|max = 0|0 is a default export setting, we allow this, but set them to undefined first
					if(signalData.min === 0 && signalData.max === 0) {
						delete(signalData.min)
						delete(signalData.max)
					}

					if(signalData.min >= signalData.max) {
						problems.push({severity: "error", line: index + 1, description: `SG_ ${signalData.name} in BO_ ${currentBo.name} will not show correct data because minimum allowed value = ${signalData.min} and maximum allowed value = ${signalData.max}. Please ask the customer for a new .dbc file with correct min/max values if this errors pops up often.`})
					}

					// Add spacing and auto-generated imperial units
					// TODO make stuff for imperial to metric, see meta/05_postfix.dbc
					if(signalData.sourceUnit) {
						switch (signalData.sourceUnit.toLowerCase()) {
							// Some .dbc editors require the unit field to not be empty
							case "-":
							case "n/a":
							case "none":
								signalData.postfixMetric   = ""
								signalData.postfixImperial = ""
								break
							// Metric sources
							case "km/h":
							case "km/u":
							case "kmph":
							case "kph":
								signalData.postfixMetric   = "km/h"
								signalData.postfixImperial = "mph"
								break
							case "km":
								signalData.postfixMetric   = "km"
								signalData.postfixImperial = "mi"
								break
							case "m":
							case "meter":
							case "meters":
								if(signalData.label.includes("distance") || signalData.label.includes("odometer")) {
									signalData.postfixMetric = "km"
									signalData.postfixImperial = "mi"
									signalData.offset = signalData.offset / 1000 // TODO, log postprocessing events like these
									signalData.factor = signalData.factor / 1000
									signalData.min = signalData.min / 1000
									signalData.max = signalData.max / 1000
								} else {
									signalData.postfixMetric = signalData.sourceUnit
								}
								break
							case "deg c":
							case "degc":
							case "°c":
							case "�c":
								signalData.postfixMetric   = "°C"
								signalData.postfixImperial = "°F"
								break
							case "��":
							case "c":
							case "¡æ":
								if(signalData.label.includes("temp")) {
									signalData.postfixMetric   = "°C"
									signalData.postfixImperial = "°F"
								} else {
									signalData.postfixMetric = signalData.sourceUnit
								}
								break
							case "kg":
								signalData.postfixMetric   = "kg"
								signalData.postfixImperial = "lbs"
								break
							case "l":
							case "liter":
							case "liters":
								signalData.postfixMetric   = "l"
								signalData.postfixImperial = "gal"
								break
							case "l/h":
							case "l per h":
								signalData.postfixMetric   = "l/h"
								signalData.postfixImperial = "gal/h"
								break
							case "km/l":
							case "km per l":
								signalData.postfixMetric   = "km/l"
								signalData.postfixImperial = "mpg"
								break
							case "l/km":
							case "l per km":
								signalData.postfixMetric   = "l/km"
								signalData.postfixImperial = "gal/mi"
								break
							case "kwh/km":
							case "kwh per km":
								signalData.postfixMetric   = "kWh/km"
								signalData.postfixImperial = "kWh/mi"
								break
							case "wh/km":
							case "wh per km":
								signalData.postfixMetric   = "Wh/km"
								signalData.postfixImperial = "Wh/mi"
								break
							case "kwh/100km":
							case "kwh/100 km":
							case "kwh per 100km":
							case "kwh per 100 km":
								signalData.postfixMetric   = "kWh/100 km"
								signalData.postfixImperial = "kWh/100 mi"
								break
							case "kpa":
								signalData.postfixMetric   = "kPa"
								signalData.postfixImperial = "psi"
								break
							// Imperial sources, convert data to metric
							// case "lbs":
							// 	signalData.postfixMetric   = "kg"
							// 	signalData.postfixImperial = "lbs"
							// 	signalData.factor *= 1
							// 	signalData.offset *= 1
							// 	break
							// case "psi":
							// 	signalData.postfixMetric   = "kPa"
							// 	signalData.postfixImperial = "psi"
							// 	signalData.factor *= 1
							// 	signalData.offset *= 1
							// 	break
							// case "mi":
							// case "miles":
							// 	signalData.postfixMetric   = "km"
							// 	signalData.postfixImperial = "mi"
							// 	signalData.factor *= 1
							// 	signalData.offset *= 1
							// 	break
							default:
								signalData.postfixMetric = signalData.sourceUnit
						}
					}


					currentBo.signals.push(signalData)
				} catch (e) {
					problems.push({severity: "error", line: index + 1, description: "Can't parse multiplexer data from SG_ line, there should either be \" M \" or \" m0 \" where 0 can be any number. This will lead to incorrect data for this signal."})
				}

				break

			case("VAL_"): // VAL_ 123 signalWithValues 0 "Off" 1 "On" 255 "Ignore" 254 "This device is on fire" ;
				let valProblem

				if(line.length % 2 !== 0) {
					problems.push({severity: "warning", line: index + 1, description: "VAL_ line does not follow DBC standard; amount of text/numbers in the line should be an even number. States/values will be incorrect, but data is unaffected."})
					return
				}

				if(line.length < 7) {
					//Duplicate so we can also keep storing problems that are not directly linked to one specific message/signal/state
					//This version will only be sent to front-end to display total list of errors/warnings
					problems.push({severity: "warning", line: index + 1, description: "VAL_ line only contains one state, nothing will break but it defeats the purpose of having states/values for this signal."})
					//This version will be stored in the data model for highlighting in front-end
					valProblem = {severity: "warning", line: index + 1, description: "VAL_ line only contains one state, nothing will break but it defeats the purpose of having states/values for this signal."}
				}

				let { valBoLink, valSgLink, states } = extractValData(line)

				valList.push({ valBoLink, valSgLink, states, lineInDbc: (index + 1), problem: valProblem })

				break

			case("SIG_VALTYPE_"): // SIG_VALTYPE_ 1024 DoubleSignal0 : 2;
				let dataTypeProblem

				if(line.length !== 5) {
					throw new Error(`SIG_VALTYPE_ line at ${index + 1} does not follow DBC standard; should have a CAN ID, signal name and number.`)
					// problems.push({severity: "error", line: index + 1, description: "SIG_VALTYPE_ line does not follow DBC standard. This means one signal will have unfixable incorrect data."})
					return
				}

				let { dataTypeBoLink, dataTypeSgLink, dataType } = extractDataTypeData(line, index + 1)

				dataTypeList.push({ dataTypeBoLink, dataTypeSgLink, dataType, lineInDbc: (index + 1), problem: dataTypeProblem })
					break

			case("CM_"): // CM_ [<BU_|BO_|SG_> [CAN-ID] [SignalName]] "<DescriptionText>";
				if(line.length < 4) {
					throw new Error(`CM_ line at ${index + 1} does not follow DBC standard; should have one of (BU_, BO_ or SG_) type, CAN ID, signal name and comment.`)
					// problems.push({severity: "error", line: index + 1, description: "CM_ line does not follow DBC standard; should have one of (BU_, BO_ or SG_) type, CAN ID, signal name and comment."})
					return
				}

				let { commentBoLink, commentSgLink, comment } = extractCommentData(line, index + 1)

				commentList.push({ commentBoLink, commentSgLink, comment, lineInDbc: (index + 1), problem: null })
					break

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
	// TODO add problem for when two VAL_ lines go to the same signal
	valList.forEach((val) => {
		let bo = _.find(boList, {canId: val.valBoLink})
		if(!bo) {
			problems.push({severity: "warning", line: val.lineInDbc, description: `VAL_ line could not be matched to BO_ because CAN ID ${val.valBoLink} can not be found in any message. Nothing will break, and if we add the correct values/states later there won't even be any data loss.`})
			return
		}
		let sg = _.find(bo.signals, {name: val.valSgLink})
		if(!sg) {
			problems.push({severity: "warning", line: val.lineInDbc, description: `VAL_ line could not be matched to SG_ because there's no signal with the name ${val.valSgLink} in the DBC file. Nothing will break, but the customer might intend to add another signal to the DBC file, so they might complain that it's missing.`})
			return
		}
		sg.states = val.states

		if(val.problem) {
			sg.problems.push(val.problem)
		}
	})

	// Add SIG_VALTYPE_ list to correct SG_
	dataTypeList.forEach((dataType) => {
		let bo = _.find(boList, {canId: dataType.dataTypeBoLink})
		if(!bo) {
			problems.push({severity: "warning", line: dataType.lineInDbc, description: `SIG_VALTYPE_ line could not be matched to BO_ because CAN ID ${dataType.dataTypeBoLink} can not be found in any message. Nothing will break, but the customer might have intended to add another message to the DBC file, so they might complain that it's missing.`})
			return
		}
		let sg = _.find(bo.signals, {name: dataType.dataTypeSgLink})
		if(!sg) {
			problems.push({severity: "warning", line: dataType.lineInDbc, description: `SIG_VALTYPE_ line could not be matched to SG_ because there's no signal with the name ${dataType.dataTypeSgLink} in the DBC file. Nothing will break, but the customer might have intended to add another signal to the DBC file, so they might complain that it's missing.`})
			return
		}

		sg.dataType = dataType.dataType

		if(dataType.problem) {
			sg.problems.push(dataType.problem)
		}
	})

	// Add CM list to correct CM_
	commentList.forEach((comment) => {
		let bo = _.find(boList, {canId: comment.commentBoLink})
		if(!bo) {
			problems.push({severity: "warning", line: comment.lineInDbc, description: `CM_ line could not be matched to BO_ because CAN ID ${comment.dataTypeBoLink} can not be found in any message. Nothing will break, but the customer might have intended to add another message to the DBC file, so they might complain that it's missing.`})
			return
		}
		let sg = _.find(bo.signals, {name: comment.commentSgLink})
		if(!sg) {
			bo.comment = comment.comment;

			if(comment.problem) {
				bo.problems.push(comment.problem)
			}

			return;
		}

		sg.comment = comment.comment

		if(comment.problem) {
			sg.problems.push(comment.problem)
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
