import { useState, useMemo, useCallback } from 'react';
import { Alert } from 'react-native';
import { getCurrentPosition } from '../services/locationService';
import { sortItemsByDistance, formatDistanceKm } from '../utils/listDistanceSort';

export function useNearbySort(items) {
  const [sortByNearby, setSortByNearby] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);

  const toggleNearbySort = useCallback(async () => {
    if (sortByNearby) {
      setSortByNearby(false);
      return;
    }
    setLocationLoading(true);
    try {
      const coords = userLocation || (await getCurrentPosition());
      if (!coords) {
        Alert.alert(
          'Konum alınamadı',
          'Yakından uzağa sıralamak için konum iznini açın ve tekrar deneyin.',
        );
        return;
      }
      setUserLocation(coords);
      setSortByNearby(true);
    } finally {
      setLocationLoading(false);
    }
  }, [sortByNearby, userLocation]);

  const displayList = useMemo(() => {
    if (!sortByNearby || !userLocation) return items;
    return sortItemsByDistance(items, userLocation);
  }, [items, sortByNearby, userLocation]);

  const distanceLabel = useCallback((item) => {
    if (!sortByNearby || item._distanceKm == null) return null;
    return formatDistanceKm(item._distanceKm);
  }, [sortByNearby]);

  return {
    displayList,
    sortByNearby,
    locationLoading,
    toggleNearbySort,
    distanceLabel,
  };
}
