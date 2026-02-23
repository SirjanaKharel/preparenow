import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, db } from '../config/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

const SignUpScreen = ({ navigation }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Name is required.');
      return;
    }
    if (!email.trim() || !password.trim()) {
      Alert.alert('Validation Error', 'Email and password are required.');
      return;
    }

    setLoading(true);
    try {
      // ── Step 1: Create the Firebase Auth user ──────────────────────────────
      // This is the critical step. If this fails, we show an error.
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // ── Step 2: Set displayName on the Auth profile ────────────────────────
      // Non-critical — failure here doesn't prevent sign-in.
      try {
        await updateProfile(user, { displayName: name.trim() });
      } catch (profileErr) {
        console.warn('updateProfile failed (non-critical):', profileErr.message);
      }

      // ── Step 3: Write user doc to Firestore ────────────────────────────────
      // Non-critical — a Firestore permission error here should NOT show
      // "Sign Up Failed" because the account was already created successfully.
      // Fix your Firestore rules if this keeps failing (see below).
      try {
        await setDoc(doc(db, 'users', user.uid), {
          name: name.trim(),
          email,
          createdAt: serverTimestamp(),
        });
      } catch (firestoreErr) {
        // Log for debugging but don't block the user — auth succeeded.
        console.warn('Firestore setDoc failed (non-critical):', firestoreErr.message);
        // If you see this warning, fix your Firestore rules:
        // match /users/{userId} {
        //   allow read, write: if request.auth != null && request.auth.uid == userId;
        // }
      }

      // Navigation is handled by onAuthStateChanged in AppContext
    } catch (error) {
      // Only Auth errors (wrong email format, weak password, etc.) reach here
      Alert.alert('Sign Up Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign Up</Text>
      <TextInput
        style={styles.input}
        placeholder="Name"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Button
        title={loading ? 'Signing Up...' : 'Sign Up'}
        onPress={handleSignUp}
        disabled={loading}
      />
      <Text style={styles.toggleText} onPress={() => navigation.replace('SignIn')}>
        Already have an account? Sign In
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  toggleText: {
    color: '#007bff',
    marginTop: 16,
    textAlign: 'center',
    textDecorationLine: 'underline',
    fontSize: 16,
  },
});

export default SignUpScreen;