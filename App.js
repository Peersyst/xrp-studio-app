import NfcManager from 'react-native-nfc-manager';
import React from 'react';
import type {Node} from 'react';
import {
  Alert,
  Button,
  Dimensions,
  Image,
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
import SButton from './SButton';

const App: () => Node = () => {
  const [supported, setSupported] = React.useState(null);
  const [enabled, setEnabled] = React.useState(null);
  const [isWorking, setIsWorking] = React.useState(false);
  const [workStatusMessage, setWorkStatusMessage] = React.useState('');
  const [currentAction, setCurrentAction] = React.useState('');
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

  async function cancelNfcOperation() {
    if (isWorking) {
      await NfcManager.cancelTechnologyRequest();
    }

    setNfcResult(null);
    setIsWorking(false);
  }

  async function btnPerformSigning() {
    let result = null;
    setCurrentAction('sign');
    setWorkStatusMessage('PLEASE TAP TAG');
    setIsWorking(true);
    setVerifyResult(false);
    setNfcResult(null);

    try {
      result = await nfcPerformAction(
        async () => await signChallenge(challenge, setWorkStatusMessage),
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
    setCurrentAction('generate');
    setWorkStatusMessage('PLEASE TAP TAG');
    setIsWorking(true);

    try {
      result = await nfcPerformAction(
        async () => await generateKeys(setWorkStatusMessage),
      );
      setNfcResult(result);
      Alert.alert('Done, generated a new key.');
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
    setCurrentAction('erase');
    setWorkStatusMessage('PLEASE TAP TAG');
    setIsWorking(true);

    try {
      await nfcPerformAction(async () => await eraseKeys(setWorkStatusMessage));
      Alert.alert('Done, erased keys.');
    } catch (e) {
      if (e.message) {
        Alert.alert(e.message);
      } else {
        Alert.alert('Communication error!');
      }
    }

    setNfcResult(null);
    setIsWorking(false);
  }

  function copyPublicKeyToClipboard() {
    if (nfcResult && nfcResult.publicKey) {
      Clipboard.setString(bytesToHex(nfcResult.publicKey));
      Alert.alert('Public key was copied to the clipboard!');
    }
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

  const dimensions = Dimensions.get('window');
  const width = dimensions.width - 80;
  const imageHeight = Math.round((width * 439) / 1401);
  const imageWidth = width;
  let verifyButtonStyle = 'normal';
  let viewContent = <View />;
  let tagsPublicKey =
    nfcResult && nfcResult.publicKey ? bytesToHex(nfcResult.publicKey) : '';

  if (isWorking) {
    verifyButtonStyle = 'working';
  } else if (nfcResult && nfcResult.signature) {
    verifyButtonStyle = verifyResult ? 'success' : 'failure';
  }

  if (viewMode === 'main') {
    viewContent = (
      <View>
        <View style={{paddingTop: 30, flexDirection: 'row'}}>
          <TextInput
            style={{
              backgroundColor: 'white',
              color: 'black',
              borderRadius: 4,
              elevation: 3,
              borderColor: 'black',
              fontSize: 16,
              padding: 16,
              width: dimensions.width - 60 - 80 - 10,
              height: 80,
            }}
            multiline={true}
            placeholder={'Paste public key or scan QR code...'}
            placeholderTextColor={'#000000'}
            onChangeText={setPublicKey}
            value={publicKey}
          />
          <TouchableOpacity onPress={() => setViewMode('scan')}>
            <Image
              source={require('./assets/qr.png')}
              style={{marginLeft: 10, width: 80, height: 80}}
            />
          </TouchableOpacity>
        </View>
        <View style={{paddingTop: 30}}>
          <SButton
            onPress={() => btnPerformSigning()}
            title={!isWorking ? 'VERIFY TAG' : workStatusMessage}
            disabled={isWorking}
            btnStyle={verifyButtonStyle}
          />
        </View>
      </View>
    );
  } else if (viewMode === 'create') {
    viewContent = (
      <View>
        <View style={{paddingTop: 30}}>
          <SButton
            onPress={() => btnGenerateKeys()}
            title={
              isWorking && currentAction === 'generate'
                ? workStatusMessage
                : 'GENERATE KEYS ON TAG'
            }
            disabled={isWorking}
            btnStyle={
              isWorking && currentAction === 'generate' ? 'working' : 'normal'
            }
          />
        </View>
        <View style={{paddingTop: 30}}>
          <SButton
            onPress={() => btnEraseKeys()}
            title={
              isWorking && currentAction === 'erase'
                ? workStatusMessage
                : 'ERASE KEYS ON TAG'
            }
            disabled={isWorking}
            btnStyle={
              isWorking && currentAction === 'erase' ? 'working' : 'normal'
            }
          />
        </View>
        <TouchableOpacity onPress={() => copyPublicKeyToClipboard()}>
          <View style={{backgroundColor: 'white', marginTop: 30, height: 120}}>
            <Text style={{color: 'black', padding: 15}}>{tagsPublicKey}</Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={{flex: 1}}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{flex: 0.8, backgroundColor: '#1E1E1F'}}>
        <View style={{backgroundColor: '#1E1E1F', padding: 40}}>
          <Image
            source={require('./assets/logo.png')}
            style={{height: imageHeight, width: imageWidth}}
          />
        </View>

        <View style={{padding: 30}}>
          {viewContent}

          <View>
            <Text
              style={{
                color: 'white',
                width: '100%',
                textAlign: 'center',
                marginTop: 30,
                fontSize: 16,
              }}>
              Copyright © EncryptoArt Systems S.L.
            </Text>
          </View>
        </View>
      </ScrollView>
      <View style={{flex: 0.2, flexDirection: 'row'}}>
        <TouchableOpacity
          onPress={async () => {
            await cancelNfcOperation();
            setVerifyResult(false);
            setNfcResult(null);
            setViewMode('main');
          }}>
          <View
            style={{
              borderWidth: 2,
              borderStyle: 'solid',
              borderColor: 'white',
              width: dimensions.width * 0.5,
              height: '100%',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
            <Text style={{fontSize: 24, fontWeight: 'bold', color: 'white'}}>
              VERIFY TAG
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={async () => {
            await cancelNfcOperation();
            setVerifyResult(false);
            setNfcResult(null);
            setViewMode('create');
          }}>
          <View
            style={{
              borderWidth: 2,
              borderStyle: 'solid',
              borderLeftWidth: 0,
              borderColor: 'white',
              width: dimensions.width * 0.5,
              height: '100%',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
            <Text style={{fontSize: 24, fontWeight: 'bold', color: 'white'}}>
              CREATE TAG
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default App;
