const transmutator   = require("../src/transmutator")
const { splitCanId } = require("../src/utils")
const fs             = require("fs")
const { expect }     = require("chai")

describe("Transmutator Tests", () => {
	it("Should read .dbc file", () => {
		let dbcString = fs.readFileSync("./meta/test-input/02_BreakingCases.dbc", "UTF-8")
		transmutator(dbcString)
	})

	it("Should split extended frame CAN ID into PGN, Source and Priority", () => {
		let isExtendedFrameCanId = 0x98FEAE55
		let {isExtendedFrame, priority, pgn, source} =splitCanId(isExtendedFrameCanId)
		expect(isExtendedFrame).to.be.true
		expect(priority).to.equal(0x98)
		expect(pgn).to.equal(0xFEAE)
		expect(source).to.equal(0x55)

		// Add test for non isExtendedFrame
	})
})

describe("Detecting BO_ errors in .dbc file", function() {
	it("PIP_01: BO_ paramCount != 4", () => {
		line = "BO_ 2147486648 Edgy: 8"
		expect(function() {
			transmutator(line)
		}).to.throw(/Non-standard BO_ line can't be parsed/)
	})
})
