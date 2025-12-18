// 📁 src/core/firebase-client.js

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
    getFirestore, 
    collection, 
    addDoc, 
    getDocs,
    doc,
    deleteDoc,
    updateDoc, 
    query,      
    where,      
    or,         
    writeBatch  
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

export class FirebaseClient {
    constructor() {
        // 🔥 Ваша конфигурация
        this.firebaseConfig = {
            apiKey: "AIzaSyCjSZhhAGnKjBRuCnQq6iiiG_Hqo05ipKs",
            authDomain: "boardgames-stats-35cd5.firebaseapp.com",
            projectId: "boardgames-stats-35cd5",
            storageBucket: "boardgames-stats-35cd5.firebasestorage.app",
            messagingSenderId: "105438836224",
            appId: "1:105438836224:web:284a5edd2c12da02034ae5"
        };
        
        this.app = null;
        this.db = null;
        this.isInitialized = false;
    }

    initialize() {
        try {
            this.app = initializeApp(this.firebaseConfig);
            this.db = getFirestore(this.app);
            this.isInitialized = true;
            console.log('🔥 Firebase успешно инициализирован');
            return true;
        } catch (error) {
            console.error('❌ Ошибка инициализации Firebase:', error);
            return false;
        }
    }

    // 👥 РАБОТА С ИГРОКАМИ
    async addPlayer(playerName) {
        if (!this.isInitialized) throw new Error('Firebase не инициализирован');
        
        const docRef = await addDoc(collection(this.db, 'players'), {
            name: playerName,
            createdAt: new Date().toISOString()
        });
        return { id: docRef.id, name: playerName };
    }

    async getPlayers() {
        if (!this.isInitialized) throw new Error('Firebase не инициализирован');
        
        const querySnapshot = await getDocs(collection(this.db, 'players'));
        const players = [];
        querySnapshot.forEach((doc) => {
            players.push({
                id: doc.id,
                ...doc.data()
            });
        });
        return players.sort((a, b) => a.name.localeCompare(b.name));
    }

    async deletePlayer(playerId) {
        if (!this.isInitialized) throw new Error('Firebase не инициализирован');
        await deleteDoc(doc(this.db, 'players', playerId));
    }

    // 🎪 РАБОТА С СЕССИЯМИ
    async addSession(sessionData) {
        if (!this.isInitialized) throw new Error('Firebase не инициализирован');
        
        const sessionToSave = {
            ...sessionData,
            createdAt: new Date().toISOString(),
            date: typeof sessionData.date === 'string' 
                ? sessionData.date 
                : sessionData.date.toISOString().split('T')[0]
        };


        delete sessionToSave.firebaseId;
        delete sessionToSave.id;

        const docRef = await addDoc(collection(this.db, 'sessions'), sessionToSave);
        

        return { 
            id: docRef.id, 
            ...sessionToSave 
        };
    }

    async getSessions() {
        if (!this.isInitialized) throw new Error('Firebase не инициализирован');
        
        console.log('🔍 [FIREBASE] ЗАГРУЗКА СЕССИЙ - НАЧАЛО');
        
        const querySnapshot = await getDocs(collection(this.db, 'sessions'));
        const sessions = [];
        
        console.log('🔍 [FIREBASE] QuerySnapshot size:', querySnapshot.size);
        console.log('🔍 [FIREBASE] QuerySnapshot empty:', querySnapshot.empty);
        
        querySnapshot.forEach((doc) => {
            console.log('🔍 [FIREBASE] Найден документ:', doc.id, doc.data());
            sessions.push({
                id: doc.id, // 🔥 ИСПОЛЬЗУЕМ ТОЛЬКО FIREBASE DOCUMENT ID
                ...doc.data()
            });
        });
        
        console.log('🔍 [FIREBASE] ЗАГРУЗКА СЕССИЙ - КОНЕЦ. Найдено:', sessions.length);
        
        return sessions.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    async deleteSession(sessionId) {
        if (!this.isInitialized) throw new Error('Firebase не инициализирован');
        
        console.log('🔍 [FIREBASE] Удаляем сессию с ID:', sessionId);
        console.log('🔍 [FIREBASE] Коллекция sessions существует?', !!this.db);
        
        try {
            // 🔥 ПРОВЕРИМ СУЩЕСТВОВАНИЕ ДОКУМЕНТА ПЕРЕД УДАЛЕНИЕМ
            const docRef = doc(this.db, 'sessions', sessionId);
            console.log('🔍 [FIREBASE] Document reference создан');
            
            // 🔥 ПОПРОБУЕМ ПРОЧИТАТЬ ДОКУМЕНТ ПЕРЕД УДАЛЕНИЕМ
            const sessionsBefore = await this.getSessions();
            console.log('🔍 [FIREBASE] Сессий до удаления:', sessionsBefore.length);
            console.log('🔍 [FIREBASE] ID всех сессий до удаления:', sessionsBefore.map(s => s.id));
            
            // 🔥 ВЫПОЛНЯЕМ УДАЛЕНИЕ
            await deleteDoc(docRef);
            console.log('🔍 [FIREBASE] deleteDoc выполнен');
            
            // 🔥 ПРОВЕРИМ РЕЗУЛЬТАТ
            const sessionsAfter = await this.getSessions();
            console.log('🔍 [FIREBASE] Сессий после удаления:', sessionsAfter.length);
            console.log('🔍 [FIREBASE] ID всех сессий после удаления:', sessionsAfter.map(s => s.id));
            
        } catch (error) {
            console.error('❌ [FIREBASE] Ошибка при удалении:', error);
            throw error;
        }
    }

    // 🔥 REAL-TIME ПРОСЛУШИВАНИЕ (для будущих улучшений)
    subscribeToSessions(callback) {
        if (!this.isInitialized) throw new Error('Firebase не инициализирован');
        
        return onSnapshot(collection(this.db, 'sessions'), (snapshot) => {
            const sessions = [];
            snapshot.forEach((doc) => {
                sessions.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            callback(sessions);
        });
    }

    async updatePlayer(playerId, updates) {
        try {
            console.log(`🔥 Обновление игрока ${playerId}:`, updates);
            
            const playerRef = doc(this.db, "players", playerId);
            await updateDoc(playerRef, updates);
            
            console.log(`✅ Игрок ${playerId} обновлен в Firebase`);
            return true;
            
        } catch (error) {
            console.error('❌ Ошибка обновления игрока в Firebase:', error);
            throw error;
        }
    }

    // И метод для обновления имени в сессиях:
    async updatePlayerInSessions(oldName, newName) {
        try {
            console.log(`🔄 Обновление имени в сессиях: ${oldName} → ${newName}`);
            
            // Получаем все сессии где участвует игрок
            const sessionsRef = collection(this.db, "sessions");
            const q = query(
                sessionsRef,
                or(
                    where("players", "array-contains", oldName),
                    where("winner", "==", oldName)
                )
            );
            
            const snapshot = await getDocs(q);
            const batch = writeBatch(this.db);
            let updatedCount = 0;
            
            snapshot.forEach((docSnap) => {
                const session = docSnap.data();
                const updatedSession = { ...session };
                let needsUpdate = false;
                
                // Обновляем массив players
                if (updatedSession.players.includes(oldName)) {
                    updatedSession.players = updatedSession.players.map(p => 
                        p === oldName ? newName : p
                    );
                    needsUpdate = true;
                }
                
                // Обновляем winner
                if (updatedSession.winner === oldName) {
                    updatedSession.winner = newName;
                    needsUpdate = true;
                }
                
                // Обновляем scores
                if (updatedSession.scores && updatedSession.scores[oldName]) {
                    updatedSession.scores[newName] = updatedSession.scores[oldName];
                    delete updatedSession.scores[oldName];
                    needsUpdate = true;
                }
                
                // Обновляем totalScores
                if (updatedSession.totalScores && updatedSession.totalScores[oldName]) {
                    updatedSession.totalScores[newName] = updatedSession.totalScores[oldName];
                    delete updatedSession.totalScores[oldName];
                    needsUpdate = true;
                }
                
                if (needsUpdate) {
                    const sessionRef = doc(this.db, "sessions", docSnap.id);
                    batch.update(sessionRef, updatedSession);
                    updatedCount++;
                }
            });
            
            if (updatedCount > 0) {
                await batch.commit();
                console.log(`✅ Обновлено ${updatedCount} сессий в Firebase`);
            } else {
                console.log('ℹ️ Не найдено сессий для обновления');
            }
            
            return updatedCount;
            
        } catch (error) {
            console.error('❌ Ошибка обновления сессий в Firebase:', error);
            throw error;
        }
    }

}
