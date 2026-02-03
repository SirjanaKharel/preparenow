import React, { createContext, useState, useContext, useEffect } from 'react';
import { auth } from '../config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { storageService } from '../services/storageServices';

const AppContext = createContext();

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState([]);
  const [monitoringActive, setMonitoringActive] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [userPoints, setUserPoints] = useState(0);
  const [completedTasks, setCompletedTasks] = useState([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });

    loadUserPoints();
    loadCompletedTasks();

    return unsubscribe;
  }, []);

  const addAlert = (alert) => {
    setAlerts(prev => [alert, ...prev]);
  };

  const clearAlerts = () => {
    setAlerts([]);
  };

  const loadUserPoints = async () => {
    const result = await storageService.getUserPoints();
    if (result.success && result.data) {
      setUserPoints(result.data);
    }
  };

  const updatePoints = async (points) => {
    const newPoints = userPoints + points;
    setUserPoints(newPoints);
    await storageService.saveUserPoints(newPoints);
  };

  const loadCompletedTasks = async () => {
    const result = await storageService.getCompletedTasks();
    if (result.success && result.data) {
      setCompletedTasks(result.data);
    }
  };

  const markTaskComplete = async (taskId) => {
    if (!completedTasks.includes(taskId)) {
      const updated = [...completedTasks, taskId];
      setCompletedTasks(updated);
      await storageService.saveCompletedTasks(updated);
    }
  };

  const value = {
    user,
    setUser,
    loading,
    alerts,
    addAlert,
    clearAlerts,
    monitoringActive,
    setMonitoringActive,
    currentLocation,
    setCurrentLocation,
    userPoints,
    updatePoints,
    completedTasks,
    markTaskComplete,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};