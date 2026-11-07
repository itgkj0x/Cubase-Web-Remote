//-----------------------------------------------------------------------------
// Cubase Web Remote Controller - MIDI Remote API Script (v3 - Native Port Wake + Pure CC Stream)
// Vendor: webremote | Device: cubasectrl
// Virtual MIDI Ports:
//   Input  (Server -> Cubase): CubaseWeb_In
//   Output (Cubase -> Server): CubaseWeb_Out
//
// Uses 100% 3-byte Control Change packets (Ch1/Ch2/Ch3) + Native Output Binding
// so Cubase unconditionally opens CubaseWeb_Out and bypasses any SysEx filter.
//-----------------------------------------------------------------------------

var midiremote_api = require('midiremote_api_v1');

function logMsg(msg) {
    try {
        if (typeof console !== 'undefined' && console.log) {
            console.log('[CubaseWebRemote v3] ' + msg);
        }
    } catch (e) {}
}

var deviceDriver = midiremote_api.makeDeviceDriver(
    'webremote',
    'cubasectrl',
    'CubaseWebRemote'
);

var midiInput = deviceDriver.mPorts.makeMidiInput('InPort');
var midiOutput = deviceDriver.mPorts.makeMidiOutput('OutPort');

deviceDriver
    .makeDetectionUnit()
    .detectPortPair(midiInput, midiOutput)
    .expectInputNameContains('CubaseWeb_In')
    .expectOutputNameContains('CubaseWeb_Out');

var surface = deviceDriver.mSurface;
var page = deviceDriver.mMapping.makePage('Main');

// Native output-bound variable to guarantee Cubase opens the OS MIDI Output handle
var outWakeVar = surface.makeCustomValueVariable('outWake');
outWakeVar.mMidiBinding.setOutputPort(midiOutput).bindToControlChange(15, 127);
var wakeToggle = 0;

var currentMapping = null;
var hasSentInitialDump = false;

// Cache latest values so newly connected WebSocket clients get an instant full sync
var ccStateCache = {
    10: 0,   // Play
    11: 127, // Stop
    12: 0,   // Record
    13: 0,   // Cycle
    14: 0,   // Metronome
    62: 0,   // Track Rec Enable
    63: 0,   // Track Monitor
    64: 0,   // Track Mute
    65: 0,   // Track Solo
    66: 100  // Track Volume (0-127)
};

var textCache = {
    primaryTime: '1.1.1.0',
    primaryFormat: 'Bars+Beats',
    secondaryTime: '00:00:00:00',
    leftLocator: '1.1.1.0',
    rightLocator: '5.1.1.0',
    trackName: '',
    trackVolText: '0.0 dB'
};

//-----------------------------------------------------------------------------
// Channel 3 (0xB2) Mini-Packet Encoder (Cubase -> Server)
//   [0xB2, 0x00, msgType]   -> Start packet of msgType
//   [0xB2, 0x01, ascii7bit] -> Append ASCII byte (0x20..0x7E)
//   [0xB2, 0x02, nibble4]   -> Append UTF-16 4-bit nibble (4 per char)
//   [0xB2, 0x03, 0x7F]      -> Commit packet
//
// msgType IDs:
//   1 = Primary Time
//   2 = Primary Format (UTF-16, supports Japanese "小節+拍" etc.)
//   3 = Secondary Time
//   4 = Left Locator
//   5 = Right Locator
//   6 = Selected Track Name (UTF-16, supports Japanese track names)
//   7 = Selected Track Volume dB text
//  15 = Script Ready / Pong
//-----------------------------------------------------------------------------
function sendAsciiPacket(activeDevice, msgType, text) {
    if (!activeDevice) return;
    var str = String(text || '');
    midiOutput.sendMidi(activeDevice, [0xB2, 0x00, msgType & 0x7F]);
    var maxLen = str.length > 64 ? 64 : str.length;
    for (var i = 0; i < maxLen; i++) {
        var code = str.charCodeAt(i);
        var safe = code >= 0x20 && code <= 0x7E ? code : 0x20;
        midiOutput.sendMidi(activeDevice, [0xB2, 0x01, safe]);
    }
    midiOutput.sendMidi(activeDevice, [0xB2, 0x03, 0x7F]);
}

function sendUtf16Packet(activeDevice, msgType, text) {
    if (!activeDevice) return;
    var str = String(text || '');
    midiOutput.sendMidi(activeDevice, [0xB2, 0x00, msgType & 0x7F]);
    var maxLen = str.length > 48 ? 48 : str.length;
    for (var i = 0; i < maxLen; i++) {
        var code = str.charCodeAt(i) & 0xFFFF;
        midiOutput.sendMidi(activeDevice, [0xB2, 0x02, (code >> 12) & 0x0F]);
        midiOutput.sendMidi(activeDevice, [0xB2, 0x02, (code >> 8) & 0x0F]);
        midiOutput.sendMidi(activeDevice, [0xB2, 0x02, (code >> 4) & 0x0F]);
        midiOutput.sendMidi(activeDevice, [0xB2, 0x02, code & 0x0F]);
    }
    midiOutput.sendMidi(activeDevice, [0xB2, 0x03, 0x7F]);
}

function sendFeedbackCC(activeDevice, ccNum, val7bit) {
    var v = Math.max(0, Math.min(127, Math.round(val7bit)));
    ccStateCache[ccNum] = v;
    if (!activeDevice) return;
    // Channel 2 (0xB1) is dedicated for Cubase -> Server discrete/fader state
    midiOutput.sendMidi(activeDevice, [0xB1, ccNum & 0x7F, v]);
}

function sendFullStateDump(activeDevice) {
    if (!activeDevice) return;
    hasSentInitialDump = true;
    try {
        wakeToggle = wakeToggle > 0.5 ? 0 : 1;
        outWakeVar.setProcessValue(activeDevice, wakeToggle);
    } catch (e) {}
    sendAsciiPacket(activeDevice, 15, 'READY');
    var keys = [10, 11, 12, 13, 14, 62, 63, 64, 65, 66];
    for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        midiOutput.sendMidi(activeDevice, [0xB1, k, ccStateCache[k] || 0]);
    }
    sendAsciiPacket(activeDevice, 1, textCache.primaryTime);
    sendUtf16Packet(activeDevice, 2, textCache.primaryFormat);
    sendAsciiPacket(activeDevice, 3, textCache.secondaryTime);
    sendAsciiPacket(activeDevice, 4, textCache.leftLocator);
    sendAsciiPacket(activeDevice, 5, textCache.rightLocator);
    sendUtf16Packet(activeDevice, 6, textCache.trackName);
    sendAsciiPacket(activeDevice, 7, textCache.trackVolText);
}

function normalizeTimeString(raw) {
    // Clean up padding spaces from Cubase e.g. "   1. 1. 1.  0" -> "1.1.1.0" or "00:00:00:00"
    return String(raw || '')
        .replace(/\s*\.\s*/g, '.')
        .replace(/\s*:\s*/g, ':')
        .replace(/^\s+|\s+$/g, '')
        .replace(/\s+/g, ' ');
}

//-----------------------------------------------------------------------------
// Surface Button & Host Binding Helpers
//-----------------------------------------------------------------------------
function makeInputButton(x, y, ccNum) {
    var btn = surface.makeButton(x, y, 1, 1);
    btn.mSurfaceValue.mMidiBinding
        .setInputPort(midiInput)
        .bindToControlChange(0, ccNum);
    return btn;
}

function bindHostToggle(x, y, ccNum, hostValue) {
    var btn = makeInputButton(x, y, ccNum);
    var binding = page.makeValueBinding(btn.mSurfaceValue, hostValue).setTypeToggle();

    var onHostVal = function (activeDevice, activeMapping, value) {
        currentMapping = activeMapping;
        if (!hasSentInitialDump) {
            sendFullStateDump(activeDevice);
        }
        sendFeedbackCC(activeDevice, ccNum, value > 0.5 ? 127 : 0);
    };

    binding.mOnValueChange = onHostVal;
    try {
        hostValue.mOnProcessValueChange = onHostVal;
    } catch (e) {}
    return btn;
}

function bindMomentaryValue(x, y, ccNum, hostValue) {
    var btn = makeInputButton(x, y, ccNum);
    page.makeValueBinding(btn.mSurfaceValue, hostValue);
    return btn;
}

function bindKeyCommand(x, y, ccNum, category, commandName) {
    var btn = makeInputButton(x, y, ccNum);
    page.makeCommandBinding(btn.mSurfaceValue, category, commandName);
    return btn;
}

//-----------------------------------------------------------------------------
// Row 0: Transport & Timeline Controls
//-----------------------------------------------------------------------------
var hostTransport = page.mHostAccess.mTransport;

bindHostToggle(0, 0, 10, hostTransport.mValue.mStart);
bindHostToggle(1, 0, 11, hostTransport.mValue.mStop);
bindHostToggle(2, 0, 12, hostTransport.mValue.mRecord);
bindHostToggle(3, 0, 13, hostTransport.mValue.mCycleActive);
bindHostToggle(4, 0, 14, hostTransport.mValue.mMetronomeActive);

bindKeyCommand(5, 0, 15, 'Transport', 'Precount On');
bindKeyCommand(6, 0, 16, 'Transport', 'Return to Zero');
bindKeyCommand(7, 0, 17, 'Transport', 'Step Back Bar');
bindKeyCommand(8, 0, 18, 'Transport', 'Step Bar');
bindMomentaryValue(9, 0, 19, hostTransport.mValue.mRewind);
bindMomentaryValue(10, 0, 20, hostTransport.mValue.mForward);
bindKeyCommand(11, 0, 21, 'Transport', 'Set Left Locator');
bindKeyCommand(12, 0, 22, 'Transport', 'Set Right Locator');
bindKeyCommand(13, 0, 23, 'Transport', 'To Left Locator');
bindKeyCommand(14, 0, 24, 'Edit', 'Undo');
bindKeyCommand(15, 0, 25, 'Edit', 'Redo');

// Dedicated Ping / Full Sync Trigger on Ch1 CC 29 (bypasses any SysEx filter!)
var btnSyncPing = makeInputButton(15, 1, 29);
btnSyncPing.mSurfaceValue.mOnProcessValueChange = function (activeDevice, value) {
    if (value > 0.5) {
        sendFullStateDump(activeDevice);
    }
};

//-----------------------------------------------------------------------------
// Row 2: Marker Navigation & Selected Track Controls
//-----------------------------------------------------------------------------
bindKeyCommand(0, 2, 30, 'Transport', 'Locate Previous Marker');
bindKeyCommand(1, 2, 31, 'Transport', 'Locate Next Marker');
bindKeyCommand(2, 2, 32, 'Transport', 'Insert Marker');

var trackSel = page.mHostAccess.mTrackSelection;
var btnPrevTrack = makeInputButton(4, 2, 60);
var btnNextTrack = makeInputButton(5, 2, 61);
page.makeActionBinding(btnPrevTrack.mSurfaceValue, trackSel.mAction.mPrevTrack);
page.makeActionBinding(btnNextTrack.mSurfaceValue, trackSel.mAction.mNextTrack);

var selectedChannel = trackSel.mMixerChannel;
var mixerVal = selectedChannel.mValue;

bindHostToggle(6, 2, 62, mixerVal.mRecordEnable);
bindHostToggle(7, 2, 63, mixerVal.mMonitorEnable);
bindHostToggle(8, 2, 64, mixerVal.mMute);
bindHostToggle(9, 2, 65, mixerVal.mSolo);

// Selected Track Volume Fader (CC 66)
var volFader = surface.makeFader(10, 2, 2, 2);
volFader.mSurfaceValue.mMidiBinding
    .setInputPort(midiInput)
    .bindToControlChange(0, 66);
var volBinding = page.makeValueBinding(volFader.mSurfaceValue, mixerVal.mVolume);

var onVolVal = function (activeDevice, activeMapping, value) {
    currentMapping = activeMapping;
    sendFeedbackCC(activeDevice, 66, Math.round(value * 127));
};
volBinding.mOnValueChange = onVolVal;
try {
    mixerVal.mVolume.mOnProcessValueChange = onVolVal;
} catch (e) {}

volFader.mSurfaceValue.mOnDisplayValueChange = function (activeDevice, value, units) {
    var disp = String(value || '0.0') + (units ? ' ' + String(units) : '');
    if (disp !== textCache.trackVolText) {
        textCache.trackVolText = disp;
        sendAsciiPacket(activeDevice, 7, disp);
    }
};

try {
    selectedChannel.mOnTitleChange = function (activeDevice, activeMapping, title) {
        currentMapping = activeMapping;
        var name = String(title || '');
        if (name !== textCache.trackName) {
            textCache.trackName = name;
            sendUtf16Packet(activeDevice, 6, name);
        }
    };
} catch (e) {}

// Also keep surface title fallback for track name
volFader.mSurfaceValue.mOnTitleChange = function (activeDevice, objectTitle) {
    var name = String(objectTitle || '');
    if (name && name !== textCache.trackName) {
        textCache.trackName = name;
        sendUtf16Packet(activeDevice, 6, name);
    }
};

//-----------------------------------------------------------------------------
// Row 4-5: Marker Pads 1-16
//-----------------------------------------------------------------------------
for (var m = 1; m <= 9; m++) {
    var mx = (m - 1) % 8;
    var my = m <= 8 ? 4 : 5;
    bindKeyCommand(mx, my, 40 + m, 'Transport', 'To Marker ' + m);
}

for (var cm = 1; cm <= 7; cm++) {
    bindKeyCommand(cm, 5, 49 + cm, 'Transport', 'Recall Cycle Marker ' + cm);
}

//-----------------------------------------------------------------------------
// Channel 3 (0xB2) Receiver for Direct Time Jump (Server -> Cubase setTime)
//   CC 10 (val > 0) -> Reset incoming time buffer
//   CC 11 (val > 0) -> Append ASCII char (val = charCode 32..126), reset with 0 between chars
//   CC 12 (val > 0) -> Commit & call mTransportLocator.setTime(currentMapping, rxTimeBuf)
//-----------------------------------------------------------------------------
var rxTimeBuf = '';
var rxResetVar = surface.makeCustomValueVariable('rxTimeReset');
var rxCharVar = surface.makeCustomValueVariable('rxTimeChar');
var rxCommitVar = surface.makeCustomValueVariable('rxTimeCommit');

rxResetVar.mMidiBinding.setInputPort(midiInput).bindToControlChange(2, 10);
rxCharVar.mMidiBinding.setInputPort(midiInput).bindToControlChange(2, 11);
rxCommitVar.mMidiBinding.setInputPort(midiInput).bindToControlChange(2, 12);

rxResetVar.mOnProcessValueChange = function (activeDevice, value) {
    if (value > 0.5) {
        rxTimeBuf = '';
    }
};

rxCharVar.mOnProcessValueChange = function (activeDevice, value) {
    var code = Math.round(value * 127);
    if (code >= 0x20 && code <= 0x7E) {
        rxTimeBuf += String.fromCharCode(code);
    }
};

rxCommitVar.mOnProcessValueChange = function (activeDevice, value) {
    if (value > 0.5 && currentMapping && rxTimeBuf.length > 0) {
        try {
            hostTransport.mTimeDisplay.mPrimary.mTransportLocator.setTime(
                currentMapping,
                rxTimeBuf
            );
        } catch (e) {}
        rxTimeBuf = '';
    }
};

//-----------------------------------------------------------------------------
// Time Display Callbacks (Primary / Secondary / Cycle Locators)
//-----------------------------------------------------------------------------
try {
    var timeDisplay = hostTransport.mTimeDisplay;

    if (timeDisplay && timeDisplay.mPrimary && timeDisplay.mPrimary.mTransportLocator) {
        timeDisplay.mPrimary.mTransportLocator.mOnChange = function (
            activeDevice,
            activeMapping,
            time,
            format
        ) {
            currentMapping = activeMapping;
            if (!hasSentInitialDump) {
                sendFullStateDump(activeDevice);
            }

            var cleanTime = normalizeTimeString(time);
            var cleanFmt = String(format || '');

            if (cleanTime && cleanTime !== textCache.primaryTime) {
                textCache.primaryTime = cleanTime;
                sendAsciiPacket(activeDevice, 1, cleanTime);
            }
            if (cleanFmt && cleanFmt !== textCache.primaryFormat) {
                textCache.primaryFormat = cleanFmt;
                sendUtf16Packet(activeDevice, 2, cleanFmt);
            }
        };
    }

    if (timeDisplay && timeDisplay.mSecondary && timeDisplay.mSecondary.mTransportLocator) {
        timeDisplay.mSecondary.mTransportLocator.mOnChange = function (
            activeDevice,
            activeMapping,
            time
        ) {
            currentMapping = activeMapping;
            var cleanSec = normalizeTimeString(time);
            if (cleanSec && cleanSec !== textCache.secondaryTime) {
                textCache.secondaryTime = cleanSec;
                sendAsciiPacket(activeDevice, 3, cleanSec);
            }
        };
    }

    if (timeDisplay && timeDisplay.mPrimary && timeDisplay.mPrimary.mCycleLocatorLeft) {
        timeDisplay.mPrimary.mCycleLocatorLeft.mOnChange = function (
            activeDevice,
            activeMapping,
            time
        ) {
            currentMapping = activeMapping;
            var cleanLeft = normalizeTimeString(time);
            if (cleanLeft && cleanLeft !== textCache.leftLocator) {
                textCache.leftLocator = cleanLeft;
                sendAsciiPacket(activeDevice, 4, cleanLeft);
            }
        };
    }

    if (timeDisplay && timeDisplay.mPrimary && timeDisplay.mPrimary.mCycleLocatorRight) {
        timeDisplay.mPrimary.mCycleLocatorRight.mOnChange = function (
            activeDevice,
            activeMapping,
            time
        ) {
            currentMapping = activeMapping;
            var cleanRight = normalizeTimeString(time);
            if (cleanRight && cleanRight !== textCache.rightLocator) {
                textCache.rightLocator = cleanRight;
                sendAsciiPacket(activeDevice, 5, cleanRight);
            }
        };
    }
} catch (e) {}

//-----------------------------------------------------------------------------
// Device & Page Activation Hooks + Legacy SysEx Fallback
//-----------------------------------------------------------------------------
deviceDriver.mOnActivate = function (activeDevice) {
    logMsg('Device activated -> sending full state dump');
    sendFullStateDump(activeDevice);
};

page.mOnActivate = function (activeDevice, activeMapping) {
    logMsg('Main page activated -> sending full state dump');
    currentMapping = activeMapping;
    sendFullStateDump(activeDevice);
};

logMsg('Driver script loaded');

midiInput.mOnSysex = function (activeDevice, message) {
    if (!message || message.length < 5) return;
    if (message[0] !== 0xF0 || message[1] !== 0x7D || message[2] !== 0x43) return;
    var cmdId = message[3];
    if (cmdId === 0x1F) {
        sendFullStateDump(activeDevice);
    }
};
