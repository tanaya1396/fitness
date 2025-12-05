import { doc, setDoc, getDoc } from 'firebase/firestore';

// This module expects a Firestore `db` instance to be passed in.
// It avoids initializing the Firebase app to prevent duplicate-app errors.
const appId = 'trio-fitness-app';

export const initializeFirestoreData = async (db) => {
  try {
    // Initialize profiles only if missing
    const profilesDocRef = doc(db, 'fitness_apps', appId, 'data', 'config_profiles');
    const profilesSnap = await getDoc(profilesDocRef);
    if (!profilesSnap.exists()) {
      await setDoc(profilesDocRef, {
        list: [
          { id: 'p1', name: 'Friend 1' },
          { id: 'p2', name: 'Friend 2' },
          { id: 'p3', name: 'Friend 3' }
        ]
      });
      console.log('Created `config_profiles`');
    } else {
      console.log('`config_profiles` already exists — skipping create');
    }

    // Initialize sample data for today
    const today = new Date().toISOString().split('T')[0];
    const profiles = ['p1', 'p2', 'p3'];
    const profileNames = ['Friend 1', 'Friend 2', 'Friend 3'];

    for (let i = 0; i < profiles.length; i++) {
      const docId = `${today}_${profiles[i]}`;
      const dataDocRef = doc(db, 'fitness_apps', appId, 'data', docId);
      const dataSnap = await getDoc(dataDocRef);
      if (!dataSnap.exists()) {
        await setDoc(dataDocRef, {
          date: today,
          userId: profiles[i],
          userDisplayName: profileNames[i],
          walking: 0,
          cardio: 0,
          bodyFocus: '-',
          reps: '-',
          workoutMinutes: 0,
          strength: 0
        });
        console.log(`Created sample data: ${docId}`);
      } else {
        console.log(`Sample data ${docId} already exists — skipping create`);
      }
    }

    console.log('✅ Firestore data initialized successfully!');
  } catch (error) {
    console.error('❌ Error initializing Firestore:', error);
  }
};
