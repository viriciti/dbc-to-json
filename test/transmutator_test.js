const transmutator   = require("../src/transmutator")
const { splitCanId } = require("../src/utils")
const _              = require("underscore")
const fs             = require("fs")
const { expect }     = require("chai")

describe("Transmutator Tests", () => {
	it("Should read .dbc file", () => {
		let dbcString = fs.readFileSync("./meta/test-input/00_readme_example.dbc", "UTF-8")
		transmutator(dbcString)
	})

	it("should skip DM1 messages when configured", () => {
		let dbcString = fs.readFileSync("./meta/test-input/03_J1939_DM1.dbc", "UTF-8")
		const messages = transmutator(dbcString, { filterDM1: true })
		const isDM1Available = _.find(messages.params, { pgn: 65226 })
		expect(isDM1Available).to.be.undefined
	})

	it("should extend signal label with message label if configured", () => {
		let dbcString = fs.readFileSync("./meta/test-input/00_readme_example.dbc", "UTF-8")
		let dbc = transmutator(dbcString, { extended: true })
		expect(dbc.params[0].signals[0].label).to.equal("standard_message.normal")
	})

	it("Should split extended frame CAN ID into PGN, Source and Priority", () => {
		let isExtendedFrameCanId = 0x98FEAE55
		let {isExtendedFrame, priority, pgn, source} = splitCanId(isExtendedFrameCanId)
		expect(isExtendedFrame).to.be.true
		expect(priority).to.equal(0x98)
		expect(pgn).to.equal(0xFEAE)
		expect(source).to.equal(0x55)
	})

	// TODO: split this up in generic dbc-to-json tests and ViriCiti specific tests
	it("Should output correct JSON", () => {
		let dbcString = fs.readFileSync("./meta/test-input/00_readme_example.dbc", "UTF-8")
		let result = transmutator(dbcString)
		expect(result.params[0].name).to.equal("StandardMessage")
		expect(result.params[0].signals[0].name).to.equal("Normal")
		expect(result.params[0].signals[0].label).to.equal("standard_message.normal")
		expect(result.params[0].signals[0].startBit).to.equal(0)
		expect(result.params[0].signals[0].bitLength).to.equal(8)
		expect(result.params[0].signals[0].isLittleEndian).to.be.true
		expect(result.params[0].signals[0].isSigned).to.be.false
		expect(result.params[0].signals[0].factor).to.equal(1)
		expect(result.params[0].signals[0].offset).to.equal(0)
		expect(result.params[0].signals[0].min).to.equal(0)
		expect(result.params[0].signals[0].max).to.equal(255)
		expect(result.params[0].signals[0].sourceUnit).to.equal("A")
		expect(result.params[0].signals[0].isMultiplexor).to.be.undefined
		expect(result.params[0].signals[0].multiplexerValue).to.be.undefined
		expect(result.params[0].signals[0].dataType).to.equal("int")
		expect(result.params[0].signals[0].choking).to.be.true
		expect(result.params[0].signals[0].visibility).to.be.true
		expect(result.params[0].signals[0].interval).to.equal(1000)
		expect(result.params[0].signals[0].category).to.equal("Standard_message")
		expect(result.params[0].signals[0].lineInDbc).to.equal(32)
		expect(result.params[0].signals[0].problems).to.be.empty
		expect(result.params[0].signals[1].isLittleEndian).to.be.false
		expect(result.params[0].signals[1].isSigned).to.be.true
		expect(result.params[0].signals[1].category).to.equal("Example_category")
		expect(result.params[0].signals[1].choking).to.be.false
		expect(result.params[1].signals[0].isMultiplexor).to.be.true
		expect(result.params[1].signals[0].multiplexerValue).to.be.undefined
		expect(result.params[1].signals[1].isMultiplexor).to.be.undefined
		expect(result.params[1].signals[1].multiplexerValue).to.equal(0)
		expect(result.params[2].signals[1].comment).to.equal('Small description on SG')
		expect(result.params[2].comment).to.equal('Small description on BO')
	})

	it("Should parse floats and doubles", () => {
		let dbcString = fs.readFileSync("./meta/test-input/04_doubles_and_floats.dbc", "UTF-8")
		let result = transmutator(dbcString)
		expect(result.params[0].signals[0].name).to.equal("LittleEndianDouble")
		expect(result.params[0].signals[0].dataType).to.equal("double")
		expect(result.params[1].signals[1].name).to.equal("BigEndianFloat")
		expect(result.params[1].signals[1].dataType).to.equal("float")
		expect(result.params[2].signals[1].name).to.equal("LittleEndianUnsignedInt")
		expect(result.params[2].signals[1].dataType).to.equal("int")
	})

	it("Should auto-convert metric postfixes", () => {
		let dbcString = fs.readFileSync("./meta/test-input/05_postfixes.dbc", "UTF-8")
		let result = transmutator(dbcString)
		expect(result.params[0].signals[0].name).to.equal("temperature1")
		expect(result.params[0].signals[0].sourceUnit).to.equal("°C")
		expect(result.params[0].signals[0].postfixMetric).to.equal("°C")
		expect(result.params[0].signals[0].postfixImperial).to.equal("°F")

		expect(result.params[0].signals[1].name).to.equal("distance1")
		expect(result.params[0].signals[1].sourceUnit).to.equal("km")
		expect(result.params[0].signals[1].postfixMetric).to.equal("km")
		expect(result.params[0].signals[1].postfixImperial).to.equal("mi")

		expect(result.params[0].signals[2].name).to.equal("speed1")
		expect(result.params[0].signals[2].sourceUnit).to.equal("km/h")
		expect(result.params[0].signals[2].postfixMetric).to.equal("km/h")
		expect(result.params[0].signals[2].postfixImperial).to.equal("mph")

		expect(result.params[2].signals[0].name).to.equal("tripdistance")
		expect(result.params[2].signals[0].sourceUnit).to.equal("m")
		expect(result.params[2].signals[0].postfixMetric).to.equal("km")
		expect(result.params[2].signals[0].postfixImperial).to.equal("mi")
		expect(result.params[2].signals[0].factor).to.equal(0.0005)
		expect(result.params[2].signals[0].offset).to.equal(0.1)

		expect(result.params[2].signals[1].name).to.equal("custom")
		expect(result.params[2].signals[1].sourceUnit).to.equal("bananas")
		expect(result.params[2].signals[1].postfixMetric).to.equal("bananas")
		expect(result.params[2].signals[1].postfixImperial).to.be.undefined
	})
	// TODO: add test where isExtendedFrame is false

	it("Should convert 1-bit signed integers to 1-bit unsigned integers", () => {
		let dbcString = fs.readFileSync("./meta/test-input/01_edge_cases.dbc", "UTF-8")
		let result = transmutator(dbcString)
		expect(result.params[3].signals[0].name).to.equal("shouldConvert")
		expect(result.params[3].signals[0].isSigned).to.be.false
		expect(result.params[3].signals[1].name).to.equal("shouldNotConvert")
		expect(result.params[3].signals[1].isSigned).to.be.true
	})
})

describe("Detecting errors in .dbc file", function() {
	it("PIP_00: BO_ paramCount != 4", () => {
		let dbcString = fs.readFileSync("./meta/test-input/breaking/00_BO_not_standard.dbc", "UTF-8")
		expect(function() {
			transmutator(dbcString)
		}).to.throw(/BO_ on line 29 does not follow DBC standard/)
	})

	// TODO: code fails before throwing because it tries to parse non-existent SGs
	it("PIP_01: BO_ signalCount < 1", () => {
		let dbcString = fs.readFileSync("./meta/test-input/breaking/01_BO_empty.dbc", "UTF-8")
		let result = transmutator(dbcString)
		expect(result.problems[0].severity).to.equal("warning")
		expect(result.problems[0].line).to.equal(29)
		expect(result.problems[0].description).to.equal("BO_ does not contain any SG_ lines; message does not have any signals.")
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
		expect(result.problems[0].description).to.equal("BO_ CAN ID already exists in this file. Nothing will break on our side, but the data will be wrong because the exact same CAN data will be used on two different signals.")
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
		expect(result.problems[0].description).to.equal("Can't parse multiplexer data from SG_ line, there should either be \" M \" or \" m0 \" where 0 can be any number. This will lead to incorrect data for this signal.")
	})

	it("PIP_07: VAL_ non-standard", () => {
		let dbcString = fs.readFileSync("./meta/test-input/breaking/07_VAL_not_standard.dbc", "UTF-8")
		let result = transmutator(dbcString)
		expect(result.problems[0].severity).to.equal("warning")
		expect(result.problems[0].line).to.equal(39)
		expect(result.problems[0].description).to.equal("VAL_ line does not follow DBC standard; amount of text/numbers in the line should be an even number. States/values will be incorrect, but data is unaffected.")
	})

	it("PIP_08: VAL_ stateCount == 1", () => {
		let dbcString = fs.readFileSync("./meta/test-input/breaking/08_VAL_one_state.dbc", "UTF-8")
		let result = transmutator(dbcString)
		expect(result.problems[0].severity).to.equal("warning")
		expect(result.problems[0].line).to.equal(39)
		expect(result.problems[0].description).to.equal("VAL_ line only contains one state, nothing will break but it defeats the purpose of having states/values for this signal.")
	})

	it("PIP_09: VAL_ unmatched BO_", () => {
		let dbcString = fs.readFileSync("./meta/test-input/breaking/09_VAL_no_matching_BO.dbc", "UTF-8")
		let result = transmutator(dbcString)
		expect(result.problems[0].severity).to.equal("warning")
		expect(result.problems[0].line).to.equal(39)
		expect(result.problems[0].description).to.equal("VAL_ line could not be matched to BO_ because CAN ID 124 can not be found in any message. Nothing will break, and if we add the correct values/states later there won't even be any data loss.")
	})

	it("PIP_10: VAL_ unmatched SG_", () => {
		let dbcString = fs.readFileSync("./meta/test-input/breaking/10_VAL_no_matching_SG.dbc", "UTF-8")
		let result = transmutator(dbcString)
		expect(result.problems[0].severity).to.equal("warning")
		expect(result.problems[0].line).to.equal(39)
		expect(result.problems[0].description).to.equal("VAL_ line could not be matched to SG_ because there's no signal with the name Status in the DBC file. Nothing will break, but the customer might intend to add another signal to the DBC file, so they might complain that it's missing.")
	})

	it("PIP_11: SG_ min/max will not result in useful data", () => {
		let dbcString = fs.readFileSync("./meta/test-input/breaking/11_SG_min_max_issue.dbc", "UTF-8")
		let result = transmutator(dbcString)
		expect(result.params[0].signals[0].min).to.be.undefined
		expect(result.params[0].signals[0].max).to.be.undefined
		expect(result.problems.length).to.equal(1)
		expect(result.problems[0].severity).to.equal("error")
		expect(result.problems[0].line).to.equal(34)
		expect(result.params[0].signals[2].min).to.equal(5)
		expect(result.params[0].signals[2].max).to.equal(-5)
		expect(result.problems[0].description).to.equal("SG_ IncorrectMinMax in BO_ StandardMessage will not show correct data because minimum allowed value = 5 and maximum allowed value = -5. Please ask the customer for a new .dbc file with correct min/max values if this errors pops up often.")
	})

	it("PIP_12: SIG_VALTYPE_ not standard", () => {
		let dbcString = fs.readFileSync("./meta/test-input/breaking/12_SIG_VALTYPE_not_standard.dbc", "UTF-8")
		expect(function() {
			transmutator(dbcString)
		}).to.throw(/SIG_VALTYPE_ line at 37 does not follow DBC standard; should have a CAN ID, signal name and number./)
	})

	it("PIP_13: SIG_VALTYPE_ dataType not recognized", () => {
		let dbcString = fs.readFileSync("./meta/test-input/breaking/13_SIG_VALTYPE_dataType_not_recognized.dbc", "UTF-8")
		expect(function() {
			transmutator(dbcString)
		}).to.throw(/read dataType 3 at line 37 in the .dbc file. It should either be 0/)
	})

	it("PIP_14: SIG_VALTYPE_ unmatched BO_ and SG_", () => {
		let dbcString = fs.readFileSync("./meta/test-input/breaking/14_SIG_VALTYPE_not_matching_BO_or_SG.dbc", "UTF-8")
		let result = transmutator(dbcString)
		expect(result.problems[0].severity).to.equal("warning")
		expect(result.problems[0].line).to.equal(38)
		expect(result.problems[0].description).to.equal("SIG_VALTYPE_ line could not be matched to BO_ because CAN ID 2566890273 can not be found in any message. Nothing will break, but the customer might have intended to add another message to the DBC file, so they might complain that it's missing.")
		expect(result.problems[1].severity).to.equal("warning")
		expect(result.problems[1].line).to.equal(39)
		expect(result.problems[1].description).to.equal("SIG_VALTYPE_ line could not be matched to SG_ because there's no signal with the name NotThere in the DBC file. Nothing will break, but the customer might have intended to add another signal to the DBC file, so they might complain that it's missing.")
	})
})
