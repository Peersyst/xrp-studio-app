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
  View,
} from 'react-native';

import {eraseKeys, generateKeys, nfcPerformAction, signChallenge} from './Nfc';
import {bytesToHex} from './Util';
import {ec as EC} from 'elliptic';

const App: () => Node = () => {
  const [supported, setSupported] = React.useState(null);
  const [enabled, setEnabled] = React.useState(null);
  const [isWorking, setIsWorking] = React.useState(false);
  const [nfcResult, setNfcResult] = React.useState(null);

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

  React.useEffect(() => {
    async function generateChallenge() {
      let tmp = new Uint8Array(32);
      crypto.getRandomValues(tmp);
      setChallenge(tmp);
    }

    generateChallenge();
  }, []);

  React.useEffect(() => {
    async function verifySignature() {
      if (nfcResult) {
        let ec = new EC('secp256k1');
        let key = ec.keyFromPublic(
          '04' + bytesToHex(nfcResult.publicKey),
          'hex',
        );
        let res = key.verify(challenge, nfcResult.signature);
        setVerifyResult(res);
      }
    }

    verifySignature();
  }, [challenge, nfcResult]);

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

    setIsWorking(false);
  }

  async function btnGenerateKeys() {
    setIsWorking(true);

    try {
      await nfcPerformAction(async () => await generateKeys());
      Alert.alert('Done, generated keys.');
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

  function renderNfcResult() {
    return (
      <View>
        <View>
          <Text style={{color: 'black'}}>
            Received tag's public key: {bytesToHex(nfcResult.publicKey)}
          </Text>
        </View>
        <View>
          <Text style={{color: 'black'}}>
            Received signature: ({bytesToHex(nfcResult.signature.r)},{' '}
            {bytesToHex(nfcResult.signature.s)})
          </Text>
        </View>
        <View>
          <Text
            style={{color: verifyResult ? 'green' : 'red', fontWeight: 'bold'}}>
            Verify result: {verifyResult ? 'Valid' : 'Invalid'}
          </Text>
        </View>
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

  return (
    <SafeAreaView>
      <StatusBar barStyle={'light-content'} />
      <ScrollView contentInsetAdjustmentBehavior="automatic">
        <View style={{backgroundColor: 'white', padding: 30}}>
          <View>
            <Text style={{color: 'black', fontSize: 36}}>
              Dilithium NFC Tag Prototype
            </Text>
          </View>
          <View>
            <Text style={{color: 'black'}}>
              Challenge: {challenge ? bytesToHex(challenge) : '(null)'}
            </Text>
          </View>
          {nfcResult ? renderNfcResult() : <View />}
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
