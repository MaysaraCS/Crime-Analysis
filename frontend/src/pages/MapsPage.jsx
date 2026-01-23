import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Circle, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import toast from 'react-hot-toast';

// Component to handle map centering
const MapController = ({ center }) => {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      map.setView(center, 13);
    }
  }, [center, map]);
  
  return null;
};

// Helper function to determine circle color based on crime weight
// Converts numeric crime weight (1-10) to color code
// Red = high risk (9-10), Green = low risk (3)
// Creates visual heat map effect on the map
const getWeightColor = (weight) => {
  if (weight >= 9) return '#ef4444'; // red (high)
  if (weight >= 7) return '#f97316'; // orange (high-medium)
  if (weight >= 5) return '#eab308'; // yellow (low-medium)
  if (weight >= 4) return '#06b6d4'; // light blue (high-low)
  return '#22c55e'; // green (low)
};

// Helper function to get weight category label
const getWeightLabel = (weight) => {
  if (weight >= 9) return 'High';
  if (weight >= 7) return 'High-Medium';
  if (weight >= 5) return 'Low-Medium';
  if (weight >= 4) return 'High-Low';
  return 'Low';
};

const MapsPage = () => {
  const [neighbourhoods, setNeighbourhoods] = useState([]);
  const [selectedNeighbourhood, setSelectedNeighbourhood] = useState(null);
  const [crimeData, setCrimeData] = useState(null);
  const [showCrimeWeight, setShowCrimeWeight] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingWeight, setLoadingWeight] = useState(false);

  // Default center for Dammam
  const defaultCenter = [26.4207, 50.0888];

  // Load neighbourhoods on mount
  useEffect(() => {
    const loadNeighbourhoods = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/neighbourhoods-with-coords`);
        if (!res.ok) throw new Error('Failed to load neighbourhoods');
        const data = await res.json();
        
        // Filter out neighbourhoods without coordinates
        // Filters out neighbourhoods without GPS data
        // Only neighbourhoods with lat/long can be displayed on map
        const validNeighbourhoods = data.filter(n => n.latitude && n.longitude);
        setNeighbourhoods(validNeighbourhoods);
      } catch (err) {
        console.error('Failed to load neighbourhoods', err);
        toast.error('Failed to load neighbourhood data');
      } finally {
        setLoading(false);
      }
    };

    loadNeighbourhoods();
  }, []);

  // Handle neighbourhood selection
  // Updates map center when user selects neighbourhood from dropdown
// Resets crime weight display until user clicks "Show Crime Weight"
  const handleNeighbourhoodSelect = (e) => {
    const neighbourhoodName = e.target.value;
    if (!neighbourhoodName) {
      setSelectedNeighbourhood(null);
      setCrimeData(null);
      setShowCrimeWeight(false);
      return;
    }

    const neighbourhood = neighbourhoods.find(n => n.name === neighbourhoodName);
    setSelectedNeighbourhood(neighbourhood);
    setCrimeData(null);
    setShowCrimeWeight(false);
  };

  // Load crime weight for selected neighbourhood
  // Fetches crime weight data for selected neighbourhood
// Calculates based on most common crime type in that area
// Displays colored circle overlay on map indicating risk level

  const handleShowCrimeWeight = async () => {
    if (!selectedNeighbourhood) return;

    setLoadingWeight(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/neighbourhood/${encodeURIComponent(selectedNeighbourhood.name)}/crime-weight`
      );
      if (!res.ok) throw new Error('Failed to load crime data');
      const data = await res.json();
      
      setCrimeData(data);
      setShowCrimeWeight(true);
    } catch (err) {
      console.error('Failed to load crime weight', err);
      toast.error('Failed to load crime weight data');
    } finally {
      setLoadingWeight(false);
    }
  };

  const mapCenter = selectedNeighbourhood 
    ? [selectedNeighbourhood.latitude, selectedNeighbourhood.longitude]
    : defaultCenter;

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Loading map data...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-auto" style={{ height: 'calc(120vh - 56px)' }}>
      {/* Header & Search Bar */}
      <div className="bg-white border-b border-gray-200 p-4 space-y-4">
        <h2 className="text-2xl font-semibold text-gray-800">Crime Weight Maps</h2>
        <p className="text-sm text-gray-600">
          Select a neighbourhood in Dammam to view its location and crime weight visualization.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex-1 w-full sm:w-auto">
            <label className="block text-sm font-medium mb-1 text-gray-700">
              Select Neighbourhood
            </label>
            <select
              onChange={handleNeighbourhoodSelect}
              value={selectedNeighbourhood?.name || ''}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
            >
              <option value="">Choose a neighbourhood...</option>
              {neighbourhoods.map((n) => (
                <option key={n.id} value={n.name}>
                  {n.name}
                </option>
              ))}
            </select>
          </div>

          {selectedNeighbourhood && (
            <button
              onClick={handleShowCrimeWeight}
              disabled={loadingWeight}
              className="px-6 py-2 mt-6 sm:mt-0 bg-primary text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {loadingWeight ? 'Loading...' : 'Show Crime Weight'}
            </button>
          )}
        </div>

        {/* Crime Weight Legend */}
        {showCrimeWeight && crimeData && (
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="font-semibold text-gray-800">
                  {selectedNeighbourhood.name}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Crime Weight: <span className="font-semibold">{crimeData.crime_weight}/10</span> ({getWeightLabel(crimeData.crime_weight)})
                </p>
                {crimeData.main_category && (
                  <p className="text-sm text-gray-600">
                    Most Common: {crimeData.main_category} ({crimeData.crime_count} cases)
                  </p>
                )}
              </div>
              
              <div className="flex gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded-full bg-[#22c55e]"></div>
                  <span>Low (3)</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded-full bg-[#06b6d4]"></div>
                  <span>H-Low (4)</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded-full bg-[#eab308]"></div>
                  <span>L-Med (5-6)</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded-full bg-[#f97316]"></div>
                  <span>H-Med (7-8)</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded-full bg-[#ef4444]"></div>
                  <span>High (9-10)</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Map Container
      // MapContainer: Leaflet map component centered on Dammam
      // Circle: Visual indicator of crime weight with 1km radius
      // Color and opacity change based on crime weight
      // Popup shows detailed information when clicked
      //  */}
      
      <div className="relative" style={{ height: '600px', minHeight: '400px' }}>
        <MapContainer
          center={defaultCenter}
          zoom={12}
          className="h-full w-full"
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          <MapController center={selectedNeighbourhood ? mapCenter : null} />

          {/* Show circle when crime weight is displayed */}
          {showCrimeWeight && crimeData && selectedNeighbourhood && (
            <Circle
              center={[selectedNeighbourhood.latitude, selectedNeighbourhood.longitude]}
              radius={1000} // 1km radius
              pathOptions={{
                color: getWeightColor(crimeData.crime_weight),
                fillColor: getWeightColor(crimeData.crime_weight),
                fillOpacity: 0.4,
                weight: 3,
              }}
            >
              <Popup>
                <div className="text-sm">
                  <h3 className="font-semibold">{selectedNeighbourhood.name}</h3>
                  <p className="mt-1">Crime Weight: {crimeData.crime_weight}/10</p>
                  <p>Risk Level: {getWeightLabel(crimeData.crime_weight)}</p>
                  {crimeData.main_category && (
                    <p className="mt-1 text-xs text-gray-600">
                      Main Category: {crimeData.main_category}
                    </p>
                  )}
                </div>
              </Popup>
            </Circle>
          )}
        </MapContainer>
      </div>
    </div>
  );
};

export default MapsPage;