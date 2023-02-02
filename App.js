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
import DilithiumModule from './dilithium.js';
import crypto from 'crypto';

import {
  changePassword,
  eraseKeys,
  generateKeys,
  nfcPerformAction,
  signChallenge,
} from './Nfc';
import {bytesToHex} from './Util';
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
  const [erasePassword, setErasePassword] = React.useState('');
  const [oldPassword, setOldPassword] = React.useState('');

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
    let tmp = crypto.randomBytes(32);
    setChallenge(tmp);
  }

  React.useEffect(() => {
    generateChallenge();
  }, []);

  React.useEffect(() => {
    async function verifySignature() {
      if (nfcResult && nfcResult.signature) {
        let mod = await DilithiumModule();

        let m_ptr = mod._get_m_buffer();
        let m_len = mod._get_m_length();
        const m = new Uint8Array(mod.HEAP8.buffer, m_ptr, m_len);

        let sig_ptr = mod._get_sig_buffer();
        let sig_len = mod._get_sig_length();
        const sig = new Uint8Array(mod.HEAP8.buffer, sig_ptr, sig_len);

        let pk_ptr = mod._get_pk_buffer();
        let pk_len = mod._get_pk_length();
        const pk = new Uint8Array(mod.HEAP8.buffer, pk_ptr, pk_len);

        pk.set(Buffer.from(publicKey, 'hex'), 0);
        sig.set(nfcResult.signature, 0);
        m.set(nfcResult.challenge, 0);

        setVerifyResult(mod._dilithium_verify_signature() === 0);
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
        Alert.alert('Error!', e.message);
      } else {
        Alert.alert('Communication error!');
      }
    }

    await generateChallenge();
    setIsWorking(false);
  }

  async function btnGenerateKeys() {
    setCurrentAction('generate');
    setViewMode('password');
  }

  async function btnEraseKeys() {
    setCurrentAction('erase');
    setViewMode('password');
  }

  async function btnChangePassword() {
    setCurrentAction('change_prev');
    setViewMode('password');
  }

  async function btnCancelPassword() {
    await cancelNfcOperation();
    setVerifyResult(false);
    setNfcResult(null);
    setViewMode('create');
  }

  async function btnProceedAction() {
    if (erasePassword.length < 3) {
      Alert.alert('Erase password must have at least 3 characters!');
      return;
    }

    if (currentAction === 'change_prev') {
      setOldPassword(erasePassword);
      setErasePassword('');
      setCurrentAction('change_new');
    } else if (currentAction === 'change_new') {
      setWorkStatusMessage('PLEASE TAP TAG');
      setIsWorking(true);

      try {
        await nfcPerformAction(
          async () =>
            await changePassword(
              setWorkStatusMessage,
              oldPassword,
              erasePassword,
            ),
        );
        Alert.alert('Done, changed password.');
      } catch (e) {
        if (e.message) {
          Alert.alert('Error!', e.message);
        } else {
          Alert.alert('Communication error!');
        }
      }

      setOldPassword('');
      setErasePassword('');
      setNfcResult(null);
      setIsWorking(false);
      setViewMode('create');
    } else if (currentAction === 'generate') {
      let result = null;
      setCurrentAction('generate');
      setWorkStatusMessage('PLEASE TAP TAG');
      setIsWorking(true);

      try {
        result = await nfcPerformAction(
          async () => await generateKeys(setWorkStatusMessage, erasePassword),
        );
        setNfcResult(result);
        Alert.alert('Done, generated a new key.');
      } catch (e) {
        if (e.message) {
          Alert.alert('Error!', e.message);
        } else {
          Alert.alert('Communication error!');
        }
      }

      setErasePassword('');
      setIsWorking(false);
      setViewMode('create');
    } else if (currentAction === 'erase') {
      setWorkStatusMessage('PLEASE TAP TAG');
      setIsWorking(true);

      try {
        await nfcPerformAction(
          async () => await eraseKeys(setWorkStatusMessage, erasePassword),
        );
        Alert.alert('Done, erased keys.');
      } catch (e) {
        if (e.message) {
          Alert.alert('Error!', e.message);
        } else {
          Alert.alert('Communication error!');
        }
      }

      setErasePassword('');
      setNfcResult(null);
      setIsWorking(false);
      setViewMode('create');
    }
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
  const width = dimensions.width - 180;
  const imageHeight = Math.round((width * 439) / 1401);
  const imageWidth = width;
  let verifyButtonStyle = 'normal';
  let viewContent = <View />;
  let tagsPublicKey =
    nfcResult && nfcResult.publicKey ? bytesToHex(nfcResult.publicKey) : '';
  let verifyTagLabel = 'VERIFY TAG';

  if (isWorking) {
    verifyButtonStyle = 'working';
  } else if (nfcResult && nfcResult.signature) {
    verifyButtonStyle = verifyResult ? 'success' : 'failure';
    verifyTagLabel = verifyResult ? 'TAG VERIFIED' : 'TAG NOT VERIFIED';
  }

  if (viewMode === 'main') {
    viewContent = (
      <View>
        <View
          style={{
            paddingTop: 30,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
          <TextInput
            style={{
              backgroundColor: '#21272C',
              color: 'white',
              borderRadius: 4,
              elevation: 3,
              fontSize: 16,
              padding: 10,
              width: dimensions.width - 60 - 80 - 10,
              height: 80,
            }}
            multiline={true}
            placeholder={'Paste a public key or scan a QR code...'}
            placeholderTextColor={'#CCCCCC'}
            onChangeText={setPublicKey}
            value={publicKey}
          />
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => setViewMode('scan')}>
              <Image
                source={require('./assets/qr.png')}
                style={{marginLeft: 10, width: 50, height: 50}}
              />
            </TouchableOpacity>
          </View>
        </View>
        <View style={{paddingTop: 30}}>
          <SButton
            onPress={() => btnPerformSigning()}
            title={!isWorking ? verifyTagLabel : workStatusMessage}
            disabled={isWorking}
            btnStyle={verifyButtonStyle}
          />
        </View>
      </View>
    );
  } else if (viewMode === 'password') {
    let actionText = '';
    let proceedText = '';

    if (currentAction === 'generate') {
      actionText =
        'Please enter password to protect the tag. You will not be able to erase the key without knowing the password.';
      proceedText = 'GENERATE KEYS';
    } else if (currentAction === 'erase') {
      actionText =
        'Please enter erase password. This is the password that you have created upon key generation.';
      proceedText = 'ERASE KEYS';
    } else if (currentAction === 'change_prev') {
      actionText =
        'Please enter the current password. This is the password that you have created upon key generation.';
      proceedText = 'NEXT';
    } else if (currentAction === 'change_new') {
      actionText =
        'Please enter the new password. You will not be able to erase the key without knowing the password.';
      proceedText = 'CHANGE PASSWORD';
    }

    let passwordText = 'Current password:';

    if (currentAction === 'change_prev') {
      passwordText = 'Old password:';
    } else if (currentAction === 'change_new' || currentAction === 'generate') {
      passwordText = 'New password:';
    }

    viewContent = (
      <View>
        <View style={{paddingTop: 30}}>
          <View style={{padding: 10, backgroundColor: '#21272C', borderRadius: 6}}>
            <Text style={{color: 'white'}}>{actionText}</Text>
          </View>
          <Text style={{paddingTop: 15, paddingBottom: 15, color: 'white'}}>
            {passwordText}
          </Text>
          <TextInput
            secureTextEntry={true}
            onChangeText={setErasePassword}
            value={erasePassword}
            style={{
              backgroundColor: '#21272C',
              color: 'white',
              borderRadius: 4,
              elevation: 3,
              borderColor: 'black',
              fontSize: 16,
              paddingHorizontal: 10,
              height: 45,
            }}
            editable={!isWorking}
          />
          <View style={{paddingTop: 15}}>
            <SButton
              onPress={() => btnProceedAction()}
              title={isWorking ? workStatusMessage : proceedText}
              disabled={isWorking}
              btnStyle={isWorking ? 'working' : 'normal'}
            />
          </View>
          <View style={{paddingTop: 15}}>
            <SButton
              onPress={() => btnCancelPassword()}
              title={'CANCEL'}
              btnStyle={'cancel'}
            />
          </View>
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
        <View style={{paddingTop: 30}}>
          <SButton
            onPress={() => btnChangePassword()}
            title={'CHANGE PASSWORD'}
            btnStyle={'normal'}
          />
        </View>
        <TouchableOpacity onPress={() => copyPublicKeyToClipboard()}>
          <View
            style={{
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: '#21272C',
              marginTop: 30,
              height: 120,
              borderRadius: 6,
            }}>
            <Text style={{color: 'white', padding: 15}}>{tagsPublicKey}</Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={{flex: 1}}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{
          flex: 0.8,
          backgroundColor: '#141A1F',
        }}>
        <View>
          <View style={{flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: '#141A1F', padding: 40, margin: 20 }}>
            <Image
              source={require('./assets/logo.png')}
              style={{height: imageHeight, width: imageWidth}}
            />
          </View>

          <View style={{padding: 30, paddingTop: 0}}>
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
                Copryright © XRP Studio 2023
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
      {viewMode !== 'password' ? (
        <View style={{flex: 0.15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center'}}>
          <TouchableOpacity
            onPress={async () => {
              await cancelNfcOperation();
              setVerifyResult(false);
              setNfcResult(null);
              setViewMode('main');
            }}>
            <View
              style={{
                borderLeftWidth: 0,
                borderBottomWidth: 0,
                borderWidth: 2,
                borderStyle: 'solid',
                borderColor: '#008CFF',
                width: dimensions.width * 0.5,
                height: '100%',
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: '#141A1F',
              }}>
              <Text style={{fontSize: 20, fontWeight: 'bold', color: 'white'}}>
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
                borderTopWidth: 2,
                borderStyle: 'solid',
                borderColor: '#008CFF',
                width: dimensions.width * 0.5,
                height: '100%',
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: '#141A1F',
              }}>
              <Text style={{fontSize: 20, fontWeight: 'bold', color: 'white'}}>
                CREATE TAG
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      ) : (
        <View />
      )}
    </SafeAreaView>
  );
};

export default App;
