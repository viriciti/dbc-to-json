const splitCanId = (canId) => {

	let isExtendedFrame = canId > 0xffff
	let priority, pgn, source

	if(isExtendedFrame) {
		priority = canId >> 24 & 0xff
		pgn      = canId >> 8  & 0xffff
		source   = canId & 0xff
	} else {
		pgn = canId
	}

	return {isExtendedFrame, priority, pgn, source}
}

module.exports = { splitCanId }