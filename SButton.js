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

  if (props.btnStyle === 'success') {
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
    borderRadius: 4,
    elevation: 3,
    padding: 24,
    backgroundColor: '#DCB54C',
  },
  buttonWorking: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    elevation: 3,
    padding: 24,
    backgroundColor: '#CCCCCC',
  },
  buttonSuccess: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    elevation: 3,
    padding: 24,
    backgroundColor: '#22E372',
  },
  buttonFailure: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    elevation: 3,
    padding: 24,
    backgroundColor: '#E32234',
  },
  text: {
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 0.25,
    color: 'white',
  },
});
