const { snakeCase } = require("snake-case")

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
	let isMultiplexor, multiplexerValue

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
	const [min, max]       = line[5].slice(1, -1).split("|")

	return {
		name: line[1],
		label: `${labelPrefix}.${snakeCase(line[1])}`,
		startBit: parseInt(startBit),
		bitLength: parseInt(bitLength),
		isLittleEndian: Boolean(littleEndian),
		isSigned: line[3].endsWith("-"),
		factor: parseFloat(factor),
		offset: parseFloat(offset),
		min: parseFloat(min),
		max: parseFloat(max),
		sourceUnit: line[6].slice(1, -1) ? line[6].slice(1, -1) : undefined,
		isMultiplexor,
		multiplexerValue,
		dataType: "int",
		visibility: true, // ViriCiti specifc
		interval: 1000, // ViriCiti specific
		lineInDbc: index,
		problems: []
	}
}

// VAL_ 123 signalWithValues 0 "Off" 1 "On" 255 "Ignore" 254 "This device is on fire" ;
const extractValueData = (line) => {

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

	// Grab the CAN ID and name from indexes 1 and 2 to later link states to correct parameter
	return {
		boLink: parseInt(line[1]),
		sgLink: line[2],
		states: valArray
	}
}

module.exports = { splitCanId, extractSignalData, extractValueData }