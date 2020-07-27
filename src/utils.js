const splitCanId = (canId) => {

	if(isNaN(canId)) throw new Error("CAN ID is not a number")

	let isExtendedFrame = canId > 0xffff
	let priority, pgn, source

	if(isExtendedFrame) {
		priority = canId >> 24 & 0xff
		pgn      = canId >> 8  & 0xffff
		source   = canId & 0xff
	} else {
		pgn = canId
	}

	return { isExtendedFrame, priority, pgn, source }
}

const extractSignalData = (line) => {
	let multiplexer

	if(line.length === 9 && line[3] === ":") {
		[multiplexer] = line.splice(2, 1)
	}

	// TODO edge cases as warnings (return them as Array)
	const [startBit, bitLength, littleEndian] = line[3].split(/[^\d]/)
	const [factor, offset] = line[4].slice(1, -1).split(",")
	const [min, max]       = line[5].slice(1, -1).split("|")

	return {
		name: line[1],
		startBit: parseInt(startBit),
		bitLength: parseInt(bitLength),
		isLittleEndian: Boolean(littleEndian),
		isSigned: line[3].endsWith("-"),
		factor: parseFloat(factor),
		offset: parseFloat(offset),
		min: parseFloat(min),
		max: parseFloat(max),
		unit: line[6].slice(1, -1),
		multiplexer
	}
}

module.exports = { splitCanId, extractSignalData }