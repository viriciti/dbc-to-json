const transmutator   = require("../src/transmutator")
const { splitCanId } = require("../src/utils")
const fs             = require("fs")
const { expect }     = require("chai")

describe("Transmutator Tests", () => {
	it("Should read .dbc file", () => {
		let dbcString = fs.readFileSync("./meta/test-input/00_ReadmeExample.dbc", "UTF-8")
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
		// Add test for not finding file
		// Add test for empty file
		// Add test for wrong extension
	})
})

describe("Detecting BO_ errors in .dbc file", function() {
	it("PIP_00: BO_ paramCount != 4", () => {
		let dbcString = fs.readFileSync("./meta/test-input/breaking/00_BO_not_standard.dbc", "UTF-8")
		expect(function() {
			transmutator(dbcString)
		}).to.throw(/BO_ on line 29 does not follow DBC standard/)
	})

	// TODO: code fails before throwing because it tries to parse non-existent SGs
	it("PIP_01: BO_ signalCount < 1", () => {
		let dbcString = fs.readFileSync("./meta/test-input/breaking/01_BO_empty.dbc", "UTF-8")
		expect(function() {
			transmutator(dbcString)
		}).to.throw(/BO_ on line 29 does not follow DBC standard/)
	})

	it("PIP_02: BO_ CAN-ID nan", () => {
		let dbcString = fs.readFileSync("./meta/test-input/breaking/02_BO_canid_nan.dbc", "UTF-8")
		expect(function() {
			transmutator(dbcString)
		}).to.throw(/BO_ CAN ID on line 29 is not a number/)
	})

	it("PIP_03: BO_ CAN-ID duplicate", () => {
		let dbcString = fs.readFileSync("./meta/test-input/breaking/03_BO_canid_duplicate.dbc", "UTF-8")
		let result = transmutator(dbcString)
		expect(result.problems[0].severity).to.equal("warning")
		expect(result.problems[0].line).to.equal(34)
		expect(result.problems[0].description).to.equal("BO_ CAN ID already exists in this file. Nothing will break on our side, but the data will be wrong because the exact same CAN data will be used on two different parameters.")
	})

	// TODO: actually reach where this is supposed to throw
	it("PIP_04: BO_ CAN-ID incomplete", () => {
		let dbcString = fs.readFileSync("./meta/test-input/breaking/04_BO_canid_incomplete.dbc", "UTF-8")
		expect(function() {
			transmutator(dbcString)
		}).to.throw(/BO_ CAN ID on line 29 is not a number/)
	})

	it("PIP_05: SG_ paramCount < 8 || paramCount > 9", () => {
		let dbcString = fs.readFileSync("./meta/test-input/breaking/05_SG_not_standard.dbc", "UTF-8")
		expect(function() {
			transmutator(dbcString)
		}).to.throw(/SG_ line at 35 does not follow DBC standard; should have eight/)
	})

	it("PIP_06: SG_ MUX non-standard", () => {
		let dbcString = fs.readFileSync("./meta/test-input/breaking/06_SG_multiplexer_not_standard.dbc", "UTF-8")
		let result = transmutator(dbcString)
		expect(result.problems[0].severity).to.equal("error")
		expect(result.problems[0].line).to.equal(36)
		expect(result.problems[0].description).to.equal("Can't parse multiplexer data from SG_ line, there should either be \" M \" or \" m0 \" where 0 can be any number.")
	})

	it("PIP_07: VAL_ non-standard", () => {
		let dbcString = fs.readFileSync("./meta/test-input/breaking/07_VAL_not_standard.dbc", "UTF-8")
		let result = transmutator(dbcString)
		expect(result.problems[0].severity).to.equal("warning")
		expect(result.problems[0].line).to.equal(39)
		expect(result.problems[0].description).to.equal("VAL_ line does not follow DBC standard; amount of text/numbers in the line should be an even number. States/values will be incorrect.")
	})

	it("PIP_08: VAL_ stateCount == 1", () => {
		let dbcString = fs.readFileSync("./meta/test-input/breaking/08_VAL_one_state.dbc", "UTF-8")
		let result = transmutator(dbcString)
		expect(result.problems[0].severity).to.equal("warning")
		expect(result.problems[0].line).to.equal(39)
		expect(result.problems[0].description).to.equal("VAL_ line only contains one state, nothing will break but it defeats the purpose of having states/values for this parameter.does not follow DBC standard; amount of text/numbers in the line should be an even number.")
	})

	it("PIP_09: VAL_ unmatched BO_", () => {
		let dbcString = fs.readFileSync("./meta/test-input/breaking/09_VAL_no_matching_BO.dbc", "UTF-8")
		let result = transmutator(dbcString)
		expect(result.problems[0].severity).to.equal("warning")
		expect(result.problems[0].line).to.equal(39)
		expect(result.problems[0].description).to.equal("VAL_ line could not be matched to BO_ because CAN ID ${val.boLink} can not be found in any message. Nothing will break, and if we add the correct values/states later there won't even be any data loss.")
	})

	it("PIP_10: VAL_ unmatched SG_", () => {
		let dbcString = fs.readFileSync("./meta/test-input/breaking/10_VAL_no_matching_SG.dbc", "UTF-8")
		let result = transmutator(dbcString)
		expect(result.problems[0].severity).to.equal("warning")
		expect(result.problems[0].line).to.equal(39)
		expect(result.problems[0].description).to.equal("VAL_ line could not be matched to SG_ because there's no parameter with the name ${val.sgLink} in the DBC file. Nothing will break, but the customer might intend to add another parameter to the DBC file, so they might complain that it's missing.")
	})
})
