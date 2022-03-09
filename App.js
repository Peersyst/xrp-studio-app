import NfcManager from 'react-native-nfc-manager';
import React from 'react';
import type {Node} from 'react';
import {
  Alert,
  Button,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import QRCodeScanner from 'react-native-qrcode-scanner';
import {RNCamera} from 'react-native-camera';

import {eraseKeys, generateKeys, nfcPerformAction, signChallenge} from './Nfc';
import {bytesToHex} from './Util';
import {ec as EC} from 'elliptic';

const App: () => Node = () => {
  const [supported, setSupported] = React.useState(null);
  const [enabled, setEnabled] = React.useState(null);
  const [isWorking, setIsWorking] = React.useState(false);
  const [nfcResult, setNfcResult] = React.useState(null);
  const [viewMode, setViewMode] = React.useState('main');
  const [publicKey, setPublicKey] = React.useState('');

  const [challenge, setChallenge] = React.useState(null);
  const [verifyResult, setVerifyResult] = React.useState(null);

  React.useEffect(() => {
    async function initNfc() {
      try {
        await NfcManager.start();
        setSupported(await NfcManager.isSupported());
        setEnabled(await NfcManager.isEnabled());
      } catch (ex) {
        console.error(ex);
        Alert.alert('ERROR', 'Failed to init NFC', [{text: 'OK'}]);
      }
    }

    initNfc();
  }, []);

  async function generateChallenge() {
    let tmp = new Uint8Array(32);
    crypto.getRandomValues(tmp);
    setChallenge(tmp);
  }

  React.useEffect(() => {
    generateChallenge();
  }, []);

  React.useEffect(() => {
    async function verifySignature() {
      if (nfcResult) {
        let ec = new EC('secp256k1');

        try {
          let key = ec.keyFromPublic(publicKey, 'hex');
          let res = key.verify(nfcResult.challenge, nfcResult.signature);
          setVerifyResult(res);
        } catch (e) {
          setVerifyResult(false);
        }
      }
    }

    verifySignature();
  }, [challenge, nfcResult]);

  async function btnScanQRCode() {
    setViewMode('scan');
  }

  async function btnCancelScan() {
    setViewMode('main');
  }

  function onScanSuccess(e) {
    setPublicKey(e.data);
    setViewMode('main');
  }

  async function btnPerformSigning() {
    let result = null;
    setIsWorking(true);
    setNfcResult(null);

    try {
      result = await nfcPerformAction(
        async () => await signChallenge(challenge),
      );
      setNfcResult(result);
    } catch (e) {
      if (e.message) {
        Alert.alert(e.message);
      } else {
        Alert.alert('Communication error!');
      }
    }

    await generateChallenge();
    setIsWorking(false);
  }

  async function btnGenerateKeys() {
    let result = null;
    setIsWorking(true);

    try {
      result = await nfcPerformAction(async () => await generateKeys());
      console.log('result', result);
      setNfcResult(result);
    } catch (e) {
      if (e.message) {
        Alert.alert(e.message);
      } else {
        Alert.alert('Communication error!');
      }
    }

    setIsWorking(false);
  }

  async function btnEraseKeys() {
    setIsWorking(true);

    try {
      await nfcPerformAction(async () => await eraseKeys());
      Alert.alert('Done, erased keys.');
    } catch (e) {
      if (e.message) {
        Alert.alert(e.message);
      } else {
        Alert.alert('Communication error!');
      }
    }

    setIsWorking(false);
  }

  function copyPublicKeyToClipboard() {
    Clipboard.setString(bytesToHex(nfcResult.publicKey));
  }

  function copySignatureToClipboard() {
    let hexR = bytesToHex(nfcResult.signature.r).padStart(32, '0');
    let hexS = bytesToHex(nfcResult.signature.s).padStart(32, '0');
    Clipboard.setString(hexR + hexS);
  }

  function renderNfcResult() {
    return (
      <View>
        {nfcResult.publicKey ? (
          <View>
            <TouchableOpacity onPress={() => copyPublicKeyToClipboard()}>
              <Text style={{color: 'black'}}>
                Received tag's public key: {bytesToHex(nfcResult.publicKey)}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View />
        )}
        {nfcResult.signature ? (
          <View>
            <View>
              <TouchableOpacity onPress={() => copySignatureToClipboard()}>
                <Text style={{color: 'black'}}>
                  Received signature: ({bytesToHex(nfcResult.signature.r)},{' '}
                  {bytesToHex(nfcResult.signature.s)})
                </Text>
              </TouchableOpacity>
            </View>
            <View>
              <Text
                style={{
                  color: verifyResult ? 'green' : 'red',
                  fontWeight: 'bold',
                }}>
                Verify result: {verifyResult ? 'Valid' : 'Invalid'}
              </Text>
            </View>
          </View>
        ) : (
          <View />
        )}
      </View>
    );
  }

  if (!supported || !enabled) {
    return (
      <SafeAreaView>
        <StatusBar barStyle={'light-content'} />
        <ScrollView contentInsetAdjustmentBehavior="automatic">
          <View style={{backgroundColor: 'white', padding: 30}}>
            <Text style={{color: 'black'}}>
              NFC is not supported or enabled.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (viewMode === 'scan') {
    return (
      <QRCodeScanner
        onRead={e => onScanSuccess(e)}
        flashMode={RNCamera.Constants.FlashMode.off}
        topContent={<Text>Please scan QR code with the public key.</Text>}
        bottomContent={
          <View
            style={{
              width: '100%',
              justifyContent: 'center',
            }}>
            <Button
              onPress={() => btnCancelScan()}
              title={'Cancel scan'}
              containerViewStyle={{width: '100%', marginLeft: 0}}
            />
          </View>
        }
      />
    );
  }

  return (
    <SafeAreaView>
      <StatusBar barStyle={'light-content'} />
      <ScrollView contentInsetAdjustmentBehavior="automatic">
        <View style={{backgroundColor: 'white', padding: 30}}>
          <View>
            <Text style={{color: 'black', fontSize: 36}}>
              ECDSA NFC Tag Prototype (build 2022-03-08 01:10)
            </Text>
          </View>
          {(nfcResult && nfcResult.challenge) || challenge ? (
            <View>
              <Text style={{color: 'black'}}>
                Challenge:{' '}
                {nfcResult && nfcResult.challenge
                  ? bytesToHex(nfcResult.challenge)
                  : challenge
                  ? bytesToHex(challenge)
                  : '(null)'}
              </Text>
            </View>
          ) : (
            <View />
          )}
          {nfcResult ? renderNfcResult() : <View />}
          <View style={{paddingTop: 30}}>
            <Button onPress={() => btnScanQRCode()} title={'Scan QR code'} />
            <Text style={{color: 'black'}}>Public key:</Text>
            <TextInput
              style={{
                backgroundColor: 'white',
                color: 'black',
                borderWidth: 1,
                borderColor: 'black',
              }}
              onChangeText={setPublicKey}
              value={publicKey}
            />
          </View>
          <View style={{paddingTop: 30}}>
            <Button
              onPress={() => btnPerformSigning()}
              title={!isWorking ? 'Authenticate tag' : 'Please tap the tag'}
              disabled={isWorking}
            />
          </View>
          <View style={{paddingTop: 30}}>
            <Button
              onPress={() => btnGenerateKeys()}
              title={!isWorking ? 'Generate keys' : 'Please tap the tag'}
              disabled={isWorking}
            />
          </View>
          <View style={{paddingTop: 30}}>
            <Button
              onPress={() => btnEraseKeys()}
              title={!isWorking ? 'Erase key' : 'Please tap the tag'}
              disabled={isWorking}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default App;
