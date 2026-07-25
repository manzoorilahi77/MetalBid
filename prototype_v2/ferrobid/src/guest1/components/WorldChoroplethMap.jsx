import React, { useMemo, useRef, useState } from 'react';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import { scaleLinear } from 'd3-scale';
import geoData from 'world-atlas/countries-110m.json';

const HEAT_COLORS = ['#dbe6f2', '#f0cba6', '#e0925a', '#b8451f', '#7a1f14'];
const GREEN_COLORS = ['#eef6f0', '#d3ecdb', '#a6d9b8', '#5ba97a', '#1f6b4a'];

// Countries the reference design highlights as "hot" markets (North America,
// Western Europe, India/China, Australia, Brazil).
const HOT = {
  840: 0.95, // USA
  124: 0.55, // Canada
  276: 0.72, // Germany
  826: 0.68, // UK
  250: 0.6,  // France
  528: 0.85, // Netherlands
  356: 0.8,  // India
  156: 0.78, // China
  392: 0.55, // Japan
  36: 0.82,  // Australia
  76: 0.5,   // Brazil
  710: 0.45, // South Africa
};

// Deterministic pseudo-random per-country activity score seeded by the
// country's numeric id, so the map is stable across renders (no Math.random()).
const baseActivity = (id) => {
  const n = Number(id) || 0;
  const seed = Math.sin(n * 12.9898) * 43758.5453;
  return Math.abs(seed - Math.floor(seed)) * 0.35 + 0.05;
};

const activityTier = (val) => {
  if (val >= 0.75) return 'Very High';
  if (val >= 0.5) return 'High';
  if (val >= 0.3) return 'Moderate';
  return 'Low';
};

export const WorldChoroplethMap = ({ variant = 'heat', markers = [], fill = 'meet' }) => {
  const colors = variant === 'green' ? GREEN_COLORS : HEAT_COLORS;
  const colorScale = useMemo(
    () => scaleLinear().domain([0, 0.25, 0.5, 0.75, 1]).range(colors).clamp(true),
    [variant]
  );
  const containerRef = useRef(null);
  const [hover, setHover] = useState(null);

  const positionFromEvent = (evt) => {
    const rect = containerRef.current.getBoundingClientRect();
    return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
  };

  const handleEnter = (geo, val) => (evt) => {
    setHover({ name: geo.properties.name, val, ...positionFromEvent(evt) });
  };
  const handleMove = (evt) => {
    setHover((h) => (h ? { ...h, ...positionFromEvent(evt) } : h));
  };
  const handleLeave = () => setHover(null);

  return (
    <div className="choropleth-root" ref={containerRef}>
      <ComposableMap
        projection="geoEqualEarth"
        projectionConfig={{ scale: 148, center: [12, 4] }}
        width={800}
        height={400}
        preserveAspectRatio={`xMidYMid ${fill}`}
        style={{ width: '100%', height: '100%' }}
      >
        <Geographies geography={geoData}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const val = HOT[Number(geo.id)] ?? baseActivity(geo.id);
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={colorScale(val)}
                  stroke="#ffffff"
                  strokeWidth={0.5}
                  onMouseEnter={handleEnter(geo, val)}
                  onMouseMove={handleMove}
                  onMouseLeave={handleLeave}
                  style={{
                    default: { outline: 'none', transition: 'fill 150ms ease' },
                    hover: { outline: 'none', fill: '#f4b942', cursor: 'pointer' },
                    pressed: { outline: 'none', fill: '#f4b942' },
                  }}
                />
              );
            })
          }
        </Geographies>
        {markers.map((m, i) => (
          <Marker key={i} coordinates={m.coords}>
            <circle r={3.5} fill="#f4b942" stroke="#fff" strokeWidth={1.2} />
          </Marker>
        ))}
      </ComposableMap>

      {hover && (
        <div className="map-hover-tooltip" style={{ left: hover.x, top: hover.y }}>
          <div className="map-hover-name">{hover.name}</div>
          <div className="map-hover-row">
            <span>Activity</span>
            <strong>{activityTier(hover.val)}</strong>
          </div>
          <div className="map-hover-row">
            <span>Est. Volume</span>
            <strong>${Math.round(hover.val * 480 + 20)}M</strong>
          </div>
        </div>
      )}
    </div>
  );
};
