# dbc-to-json
Converts a .dbc file to a JSON object that contains all BO_, SG_, VAL_ and CM_ information.

Will also provide a list of possibly incorrect signal definitions (like having both a postfix and a VAL_ entry for the same signal).

## Usage
Go to https://viriciti.github.io/dbc-to-json/ and upload a .dbc file. Open your browser's console to see if there's any mistakes in the .dbc file. Fix those (using the line number provided) and reupload.

## Example input
See meta/test-input/00_ReadmeExample.dbc
```
BO_ 123 StandardMessage: 8 Vector__XXX
 SG_ Normal : 0|8@1+ (1,0) [0|0] "A" Vector__XXX
 SG_ Special : 43|12@0- (0.5,-50) [0|0] "V" Vector__XXX
 SG_ States : 8|2@1+ (1,0) [0|0] "" Vector__XXX

BO_ 2566906689 ExtendedMessage: 8 Vector__XXX
 SG_ Multiplexor M : 0|8@1+ (1,0) [0|0] "" Vector__XXX
 SG_ BatteryCell1Voltage m0 : 8|16@1+ (1,0) [0|0] "V" Vector__XXX
 SG_ BatteryCell2Voltage m1 : 8|16@1+ (1,0) [0|0] "V" Vector__XXX

VAL_ 123 States 0 "Off" 1 "On" 2 "Blinking" 3 "Unavailable" ;

CM_ BO_ 123 "Small description on BO";
CM_ SG_ 123 Normal "Small description on SG";
```

## Example output
```
[
    {
        "canId": 123,
        "pgn": 123,
        "name": "StandardMessage",
        "isExtendedFrame": false,
        "dlc": 8,
        "comment": "Small description on BO",
        "signals": [
            {
                "name": "Normal",
                "label": "standard_message.normal",
                "startBit": 0,
                "bitLength": 8,
                "isLittleEndian": true,
                "isSigned": false,
                "factor": 1,
                "offset": 0,
                "min": 0,
                "max": 0,
                "sourceUnit": "A",
                "dataType": "int",
                "comment": "Small description on SG"
            },
            {
                "name": "Special",
                "label": "standard_message.special",
                "startBit": 43,
                "bitLength": 12,
                "isLittleEndian": true,
                "isSigned": true,
                "factor": 0.5,
                "offset": -50,
                "min": 0,
                "max": 0,
                "sourceUnit": "V",
                "dataType": "int",
                "comment": null
            },
            {
                "name": "States",
                "label": "standard_message.states",
                "startBit": 8,
                "bitLength": 2,
                "isLittleEndian": true,
                "isSigned": false,
                "factor": 1,
                "offset": 0,
                "min": 0,
                "max": 0,
                "dataType": "int",
                "states": [
                    {
                        "value": 0,
                        "state": "Off"
                    },
                    {
                        "value": 1,
                        "state": "On"
                    },
                    {
                        "value": 2,
                        "state": "Blinking"
                    },
                    {
                        "value": 3,
                        "state": "Unavailable"
                    }
                ],
                "comment": null
            }
        ],
        "lineInDbc": 31,
        "label": "standard_message"
    },
    {
        "canId": 2566906689,
        "pgn": 65507,
        "source": 65,
        "name": "ExtendedMessage",
        "priority": 152,
        "isExtendedFrame": true,
        "dlc": 8,
        "signals": [
            {
                "name": "Multiplexor",
                "label": "extended_message.multiplexor",
                "startBit": 0,
                "bitLength": 8,
                "isLittleEndian": true,
                "isSigned": false,
                "factor": 1,
                "offset": 0,
                "min": 0,
                "max": 0,
                "isMultiplexor": true,
                "dataType": "int",
                "comment": null
            },
            {
                "name": "BatteryCell1Voltage",
                "label": "extended_message.battery_cell1_voltage",
                "startBit": 8,
                "bitLength": 16,
                "isLittleEndian": true,
                "isSigned": false,
                "factor": 1,
                "offset": 0,
                "min": 0,
                "max": 0,
                "sourceUnit": "V",
                "multiplexerValue": 0,
                "dataType": "int",
                "comment": null
            },
            {
                "name": "BatteryCell2Voltage",
                "label": "extended_message.battery_cell2_voltage",
                "startBit": 8,
                "bitLength": 16,
                "isLittleEndian": true,
                "isSigned": false,
                "factor": 1,
                "offset": 0,
                "min": 0,
                "max": 0,
                "sourceUnit": "V",
                "multiplexerValue": 1,
                "dataType": "int",
                "comment": null
            }
        ],
        "lineInDbc": 36,
        "label": "extended_message"
    }
]
```
