import React from 'react';
import {
  Text,
  StyleSheet,
  Pressable,
  Image,
  View,
  TouchableOpacity,
} from 'react-native';

export default function SButton(props) {
  const {onPress, title = 'Save'} = props;
  let buttonStyle = styles.button;
  let textStyle = styles.text;
  let img = <View />;

  if (props.btnStyle === 'cancel') buttonStyle = styles.buttonCancel;
  else if (props.btnStyle === 'success') {
    buttonStyle = styles.buttonSuccess;
    img = (
      <Image
        source={require('./assets/success.png')}
        style={{position: 'absolute', right: 15, width: 50, height: 50}}
      />
    );
  } else if (props.btnStyle === 'failure') {
    buttonStyle = styles.buttonFailure;
    img = (
      <Image
        source={require('./assets/failure.png')}
        style={{position: 'absolute', right: 15, width: 50, height: 50}}
      />
    );
  } else if (props.btnStyle === 'working') {
    buttonStyle = styles.buttonWorking;
  }

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={!props.disabled ? onPress : () => {}}>
      <Text style={textStyle}>{title}</Text>
      {img}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    elevation: 3,
    height: 50,
    paddingVertical: 8,
    paddingHorizontal: 14,
    color: 'white',
    backgroundColor: '#008CFF',
  },
  buttonWorking: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    elevation: 3,
    padding: 24,
    height: 55,
    backgroundColor: '#CCCCCC',
  },
  buttonCancel: {
    color: '#CCCCCC',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    height: 55,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  buttonSuccess: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    elevation: 3,
    padding: 24,
    height: 55,
    backgroundColor: '#37FF33',
  },
  buttonFailure: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    elevation: 3,
    padding: 24,
    height: 55,
    backgroundColor: '#FF3364',
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.25,
    color: 'white',
  },
});
