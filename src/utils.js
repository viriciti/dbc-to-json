const { snakeCase } = require("snake-case")
const { titleCase } = require("title-case")

const splitCanId = (canId) => {
	let isExtendedFrame = canId > 0xffff
	let priority, pgn, source

	if(isExtendedFrame) {
		source   = canId & 0xff
		pgn      = canId >> 8  & 0xffff
		priority = canId >> 24 & 0xff
	} else {
		pgn = canId
	}

	return { isExtendedFrame, priority, pgn, source }
}

// SG_ speed m1 : 8|8@1+ (1,-50) [-50|150] "km/h" Vector__XXX
const extractSignalData = (line, labelPrefix, index) => {
	let isMultiplexor, multiplexerValue, category, comment

	if(line.length === 9 && line[3] === ":") {
		[rawMultiplexer] = line.splice(2, 1)
		if(rawMultiplexer === "M") {
			isMultiplexor = true
		} else if(rawMultiplexer.charAt(0) === "m") {
			multiplexerValue = parseInt(rawMultiplexer.substr(1))
		} else {
			throw new Error(`Can't read multiplexer ${rawMultiplexer}`)
		}
	}

	
	// TODO edge cases as warnings (return them as Array)
	const [startBit, bitLength, littleEndian] = line[3].split(/[^\d]/)
	const [factor, offset] = line[4].slice(1, -1).split(",")
	const [min, max] = line[5].slice(1, -1).split("|")
	let isSigned = line[3].endsWith("-")

	// Categorizes signals based on source device. If source device has a default value, use the BO_ name
	if(line[7] !== "Vector__XXX") {
		category = line[7]
	} else {
		category = titleCase(labelPrefix)
	}

	// Automatically sets signed 1-bit signals to unsigned versions to save headaches in business logic later
	if(bitLength === "1" && isSigned) {
		isSigned = false
	}

	return {
		name: line[1],
		label: `${labelPrefix}.${snakeCase(line[1])}`,
		startBit: parseInt(startBit),
		bitLength: parseInt(bitLength),
		isLittleEndian: Boolean(parseInt(littleEndian)),
		isSigned: isSigned,
		factor: parseFloat(factor),
		offset: parseFloat(offset),
		min: parseFloat(min),
		max: parseFloat(max),
		sourceUnit: line[6].slice(1, -1) ? line[6].slice(1, -1) : undefined,
		isMultiplexor,
		multiplexerValue,
		dataType: "int",
		choking: (parseInt(bitLength) % 8 === 0),
		visibility: true, // ViriCiti specifc
		interval: 1000, // ViriCiti specific
		category: category, // ViriCiti specific
		comment,
		lineInDbc: index,
		problems: []
	}
}

// VAL_ 123 signalWithValues 0 "Off" 1 "On" 255 "Ignore" 254 "This device is on fire" ;
const extractValData = (line) => {

	// Starting at index 3, iterate over the states and put them in an array as objects of value/state pairs
	let index = 3
	let value, state
	const valArray = []
	while(index !== line.length - 1) {
		value = parseInt(line[index])
		index += 1
		state = line[index].slice(1, -1)
		index += 1
		valArray.push({ value, state })
	}

	// Grab the CAN ID and name from indexes 1 and 2 to later link states to correct signal
	return {
		valBoLink: parseInt(line[1]),
		valSgLink: line[2],
		states: valArray
	}
}

// SIG_VALTYPE_ 1024 DoubleSignal0 : 2;
const extractDataTypeData = (line, index) => {
	let dataType

	switch(line[4].slice(0, -1)) {
		case "0":
			dataType = "int"
			break;
		case "1":
			dataType = "float"
			break;
		case "2":
			dataType = "double"
			break
		default:
			throw new Error(`Can't read dataType ${line[4].slice(0, -1)} at line ${index} in the .dbc file. It should either be 0 (int), 1 (float) or 2 (double). This will cause unfixable incorrect data.`)
	}

	// Grab the CAN ID and name from indexes 1 and 2 to later link states to correct signal
	return {
		dataTypeBoLink: parseInt(line[1]),
		dataTypeSgLink: line[2],
		dataType: dataType
	}
}

// CM_ [<BU_|BO_|SG_> [CAN-ID] [SignalName]] "<DescriptionText>";
const extractCommentData = (line, index) => {
	let comment = "";

	let commentBoLink
	let commentSgLink

	switch (line[1]) {
		case 'SG_':
			commentSgLink = line[3]
			// when there is SG, there is BO case
		case 'BO_':
			commentBoLink = parseInt(line[2])
			comment = line[line.length - 2]
			break;
	}

	return {
		commentBoLink: commentBoLink,
		commentSgLink: commentSgLink,
		comment: comment.substr(1, comment.length - 2)
	}
}

module.exports = { splitCanId, extractSignalData, extractValData, extractDataTypeData, extractCommentData }
