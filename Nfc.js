import {Platform} from 'react-native';
import NfcManager, {
  NfcTech,
  Nfc15693RequestFlagIOS,
} from 'react-native-nfc-manager';
import {bytesToHex, hexToBytes} from './Util';
import CRC32 from 'crc-32';

function sleep(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

async function iso15693Cmd(code, data, skipManufCode) {
  let res = null;

  let cmdHdr = [0x02, code, 0x04];

  if (skipManufCode) {
    cmdHdr = [0x02, code];
  }

  if (Platform.OS === 'android') {
    console.log(bytesToHex(cmdHdr.concat(data)));
    res = await NfcManager.transceive(cmdHdr.concat(data));
    res = res.slice(1);
  } else if (Platform.OS === 'ios') {
    res = await NfcManager.iso15693HandlerIOS.customCommand({
      flags: Nfc15693RequestFlagIOS.HighDataRate,
      customCommandCode: code,
      customRequestParameters: data,
    });
  } else {
    throw Error('Invalid platform OS.');
  }

  return res;
}

function timeMs() {
  return new Date().getTime();
}

async function waitUnlockNFC() {
  let success = false;
  let startTime = timeMs();

  while (timeMs() - startTime < 8000) {
    try {
      let res = await iso15693Cmd(0xc0, hexToBytes('A000'));
      console.log('Config reg. A0 = ', bytesToHex(res));

      // eslint-disable-next-line no-bitwise
      if ((res[1] & 0x03) === 0x01) {
        success = true;
        break;
      }
    } catch (e) {
      console.log(e);
    }

    await sleep(20);
  }

  if (!success) {
    throw Error('NFC did not unlock in time.');
  }
}

async function doHLCommand(data) {
  let origDataLength = data.length;

  if (data.length > 248) {
    throw Error('Command data can not be longer than 248.');
  }

  let crcBuf = Buffer.alloc(4);
  crcBuf.writeInt32LE(CRC32.buf(data), 0);

  if (data.length % 4 !== 0) {
    // zero-pad data to make length divisible by 4
    let pad = Array(4 - (data.length % 4));
    pad.fill(0);
    data = data.concat(pad);
  }

  // write command data to the tag's RAM
  let payload = [0xde, 0x21, 0x37, origDataLength]
    .concat([...crcBuf])
    .concat(data);
  let numPages = payload.length / 4 - 1;

  let res = await iso15693Cmd(0xd3, [0x00, numPages].concat(payload));
  console.log(bytesToHex(res));

  // pass control to the NFC tag
  res = await iso15693Cmd(0xd3, hexToBytes('3F00FFFFFFFF'));
  console.log(bytesToHex(res));

  await waitUnlockNFC();

  // read first page
  res = await iso15693Cmd(0xd2, [0x00, 0x01]);
  console.log('Output header: ', bytesToHex(res));

  let resBuf = Buffer.from(res);
  let magic = Buffer.from('DECA', 'hex');

  if (resBuf.slice(0, 2).compare(magic) !== 0) {
    throw Error('Invalid magic value');
  }

  let isSuccess;

  if (resBuf[2] === 0xf0) {
    isSuccess = true;
  } else if (resBuf[2] === 0xee) {
    isSuccess = false;
  } else {
    throw Error('Invalid status code: ' + resBuf[2]);
  }

  let numValidBytes = resBuf[3];
  let theirCrc = Buffer.from(resBuf.slice(4));

  if (numValidBytes > 244) {
    throw Error('Invalid numValidBytes, can not be more than 244.');
  }

  let out = [];

  if (numValidBytes > 0) {
    // eslint-disable-next-line no-bitwise
    let numOutPages = (numValidBytes & ~3) / 4 - 1;

    if (numOutPages % 4 !== 0) {
      numOutPages++;
    }

    res = await iso15693Cmd(0xd2, [0x02, numOutPages]);
    out = res.slice(0, numValidBytes);
  }

  let ourCrcBuf = Buffer.alloc(4);
  ourCrcBuf.writeInt32LE(CRC32.buf(out), 0);

  if (ourCrcBuf.compare(theirCrc) !== 0) {
    throw Error('Output CRC mismatch.');
  }

  if (!isSuccess) {
    throw Error('Device returned error: ' + bytesToHex(out));
  }

  return out;
}

async function checkConfig() {
  let success = false;
  let timeout = false;
  let startTime = timeMs();
  let res = null;

  // arbiter mode = pass through, SRAM is accessible, transfer dir = nfc
  while (true) {
    try {
      res = await iso15693Cmd(0xc0, hexToBytes('A100'));
      console.log('Config reg. A1: ', bytesToHex(res));

      // eslint-disable-next-line no-bitwise
      if ((res[1] & 0x0f) === 0x0b) {
        success = true;
        break;
      }
    } catch (e) {
      console.log(e);
    }

    await sleep(Math.ceil(Math.random() * 25));

    if (timeout) {
      break;
    } else if (timeMs() - startTime > 3000) {
      timeout = true;
    }
  }

  if (!success) {
    throw Error('Config A1 invalid: ' + bytesToHex(res));
  }
}

async function signChallenge(challenge) {
  await checkConfig();
  await waitUnlockNFC();

  // get public key
  let pkey = await doHLCommand([0xb0]);
  console.log('pkey', bytesToHex(pkey));

  // sign digest
  let res = await doHLCommand([0xb1].concat(Array.from(challenge)));
  console.log('signature', bytesToHex(res));

  return {
    challenge: challenge,
    publicKey: pkey,
    signature: {r: res.slice(0, 32), s: res.slice(32, 64)},
  };
}

async function generateKeys() {
  await checkConfig();
  await waitUnlockNFC();

  let res = await doHLCommand([0xe5]);
  console.log(res);
}

async function eraseKeys() {
  await checkConfig();
  await waitUnlockNFC();

  let res = await doHLCommand([0xe7]);
  console.log(res);
}

async function nfcPerformAction(actionCb) {
  let result = null;

  let nfcTech = NfcTech.NfcV;

  if (Platform.OS === 'ios') {
    nfcTech = NfcTech.Iso15693IOS;
  }

  await NfcManager.requestTechnology(nfcTech, {
    alertMessage: 'Please tap the tag and hold it.',
  });

  let caughtEx = null;

  try {
    if (Platform.OS === 'ios') {
      await NfcManager.setAlertMessageIOS('Working, please keep holding...');
    }

    result = await actionCb();
  } catch (ex) {
    caughtEx = ex;
  }

  if (result === null) {
    if (Platform.OS === 'ios') {
      await NfcManager.invalidateSessionWithErrorIOS('Communication error.');
    } else {
      await NfcManager.cancelTechnologyRequest();
    }

    if (caughtEx) {
      throw caughtEx;
    }

    return null;
  }

  if (Platform.OS === 'ios') {
    await NfcManager.setAlertMessageIOS('Done!');
  }

  await NfcManager.cancelTechnologyRequest();
  return result;
}

export {nfcPerformAction, signChallenge, generateKeys, eraseKeys};
