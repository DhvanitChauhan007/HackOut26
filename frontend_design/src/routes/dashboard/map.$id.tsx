import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { PageTitle } from "../../components/PageTitle";
import { ArrowLeft, CheckCircle2, ExternalLink, Loader2, MapPin, PackageCheck, Truck } from "lucide-react";
import { useJobs } from "../../lib/useJobs";
import "leaflet/dist/leaflet.css";

export const Route = createFileRoute("/dashboard/map/$id")({
  component: MapPage,
});

function MapPage() {
  const { id } = Route.useParams();
  const { jobs, loading, deliverJob } = useJobs();
  
  const job = jobs.find((j) => j.id === id);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  const [routeLoading, setRouteLoading] = useState(true);
  const [delivering, setDelivering] = useState(false);
  const [deliveredSuccess, setDeliveredSuccess] = useState(false);

  const handleDeliver = async () => {
    if (!job) return;
    setDelivering(true);
    try {
      await deliverJob(job.id);
      setDeliveredSuccess(true);
    } catch (err) {
      console.error("Failed to deliver job:", err);
    } finally {
      setDelivering(false);
    }
  };

  useEffect(() => {
    if (!job || !mapContainerRef.current) return;
    if (typeof window === "undefined") return;

    let isMounted = true;

    import("leaflet").then((L) => {
      if (!isMounted || !mapContainerRef.current) return;

      // Clean up previous map instance if any
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const pLat = job.pickup_lat ?? 23.1895;
      const pLon = job.pickup_long ?? 72.6302;
      const dLat = job.dropoff_lat ?? 21.1452;
      const dLon = job.dropoff_long ?? 72.7767;

      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
      }).setView([pLat, pLon], 10);
      mapInstanceRef.current = map;

      // Clean OpenStreetMap tiles
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      // Custom crisp SVG badges
      const pickupIcon = L.divIcon({
        className: "custom-map-icon",
        html: `
          <div style="background-color: #15803d; color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(0,0,0,0.35); border: 2.5px solid white; font-size: 17px;">
            📦
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const dropoffIcon = L.divIcon({
        className: "custom-map-icon",
        html: `
          <div style="background-color: #1d4ed8; color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(0,0,0,0.35); border: 2.5px solid white; font-size: 17px;">
            📍
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const carrierIcon = L.divIcon({
        className: "custom-map-icon",
        html: `
          <div style="background-color: #f59e0b; color: #78350f; width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 18px rgba(245,158,11,0.5); border: 3px solid white; font-size: 20px;">
            🚚
          </div>
        `,
        iconSize: [42, 42],
        iconAnchor: [21, 21],
      });

      L.marker([pLat, pLon], { icon: pickupIcon })
        .addTo(map)
        .bindPopup(`
          <div style="font-family: inherit; font-size: 13px;">
            <strong style="color: #15803d;">PICKUP LOCATION</strong><br/>
            ${job.pickup_location}<br/>
            <span style="color: #6b7280; font-size: 11px;">${pLat.toFixed(4)}, ${pLon.toFixed(4)}</span>
          </div>
        `);

      L.marker([dLat, dLon], { icon: dropoffIcon })
        .addTo(map)
        .bindPopup(`
          <div style="font-family: inherit; font-size: 13px;">
            <strong style="color: #1d4ed8;">DROPOFF LOCATION</strong><br/>
            ${job.dropoff_location}<br/>
            <span style="color: #6b7280; font-size: 11px;">${dLat.toFixed(4)}, ${dLon.toFixed(4)}</span>
          </div>
        `);

      // Fetch highway road route from OSRM
      setRouteLoading(true);
      fetch(
        `https://router.project-osrm.org/route/v1/driving/${pLon},${pLat};${dLon},${dLat}?overview=full&geometries=geojson`
      )
        .then((res) => res.json())
        .then((data) => {
          if (!isMounted || !map) return;
          if (data.code === "Ok" && data.routes?.[0]?.geometry?.coordinates) {
            const rawCoords = data.routes[0].geometry.coordinates;
            // Convert [lon, lat] from GeoJSON to [lat, lon] for Leaflet
            const latLngs = rawCoords.map((c: [number, number]) => [c[1], c[0]]);
            
            const polyline = L.polyline(latLngs, {
              color: "#2563eb",
              weight: 5,
              opacity: 0.85,
              lineCap: "round",
              lineJoin: "round",
            }).addTo(map);

            // Place carrier tracking pin along the highway (approx ~35% into the route)
            const trackIndex = Math.min(Math.floor(latLngs.length * 0.35), latLngs.length - 1);
            const carrierPos = latLngs[trackIndex] || latLngs[0];
            L.marker(carrierPos, { icon: carrierIcon })
              .addTo(map)
              .bindPopup(`
                <div style="font-family: inherit; font-size: 13px;">
                  <strong style="color: #d97706;">CARRIER LIVE POSITION</strong><br/>
                  In transit towards destination<br/>
                  <strong>ETA:</strong> ${job.eta}
                </div>
              `);

            map.fitBounds(polyline.getBounds(), { padding: [60, 60] });
          } else {
            // Fallback dashed line
            const fallbackLine = L.polyline(
              [[pLat, pLon], [dLat, dLon]],
              { color: "#2563eb", weight: 4, dashArray: "8, 8" }
            ).addTo(map);
            map.fitBounds(fallbackLine.getBounds(), { padding: [60, 60] });
          }
        })
        .catch((err) => {
          console.warn("OSRM route fetch failed, using straight-line bounds:", err);
          if (!isMounted || !map) return;
          const fallbackLine = L.polyline(
            [[pLat, pLon], [dLat, dLon]],
            { color: "#2563eb", weight: 4, dashArray: "8, 8" }
          ).addTo(map);
          map.fitBounds(fallbackLine.getBounds(), { padding: [60, 60] });
        })
        .finally(() => {
          if (isMounted) setRouteLoading(false);
        });
    });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [job]);

  const googleMapsUrl = job
    ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(job.pickup_location)}&destination=${encodeURIComponent(job.dropoff_location)}`
    : "#";

  return (
    <div className="mx-auto max-w-5xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-4">
        <Link
          to="/dashboard/logistics"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to job board
        </Link>
      </div>

      <PageTitle 
        icon={<MapPin />} 
        eyebrow="Live Tracking" 
        title={`Route Map for J-${id.slice(-4).toUpperCase()}`} 
        copy="Turn-by-turn road network route, live transit status, and waypoint tracking." 
      />

      {loading && !job ? (
        <div className="flex h-[600px] items-center justify-center rounded-card border-2 border-foreground/10 bg-card shadow-panel">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : job ? (
        <div className="space-y-4">
          {/* Header Summary Card */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-card border-2 border-foreground/10 bg-card p-5 shadow-panel">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-amber-400/20 px-2.5 py-0.5 text-xs font-semibold text-amber-900 dark:text-amber-300">
                  {job.status === "assigned" ? "In transit" : job.status.toUpperCase()}
                </span>
                <p className="font-display text-lg font-semibold text-foreground">{job.route}</p>
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                {job.detail} • <span className="font-semibold text-primary">{job.eta}</span>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs uppercase text-muted-foreground">Carrier payout</p>
                <p className="font-display text-2xl font-bold text-foreground">{job.payout}</p>
              </div>

              {job.status !== "delivered" && !deliveredSuccess && (
                <button
                  onClick={handleDeliver}
                  disabled={delivering}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-button transition-all hover:-translate-y-0.5 hover:bg-primary/90 disabled:opacity-50"
                >
                  {delivering ? <Loader2 className="size-4 animate-spin" /> : <PackageCheck className="size-4" />}
                  Mark delivered
                </button>
              )}

              {(job.status === "delivered" || deliveredSuccess) && (
                <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-4 py-2 text-sm font-semibold text-primary">
                  <CheckCircle2 className="size-4" /> Delivered
                </div>
              )}

              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border-2 border-foreground/10 bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-all hover:-translate-y-0.5 hover:bg-foreground/5"
                title="Open driving navigation in Google Maps"
              >
                <ExternalLink className="size-4" /> Navigation
              </a>
            </div>
          </div>

          {/* Interactive Leaflet Map Container */}
          <div className="relative h-[550px] w-full overflow-hidden rounded-card border-2 border-foreground/10 bg-card shadow-panel">
            {routeLoading && (
              <div className="absolute right-4 top-4 z-[1000] flex items-center gap-2 rounded-full bg-card/90 px-3.5 py-1.5 text-xs font-semibold text-foreground shadow-md backdrop-blur">
                <Loader2 className="size-3.5 animate-spin text-primary" /> Calculating road route...
              </div>
            )}
            <div ref={mapContainerRef} className="h-full w-full" style={{ zIndex: 1 }} />
          </div>

          {/* Route Legend & Info Bar */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-2xl border-2 border-foreground/10 bg-card p-4 shadow-sm">
              <div className="grid size-10 place-items-center rounded-xl bg-green-500/15 text-green-700 dark:text-green-400">
                <span className="text-xl">📦</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs uppercase text-muted-foreground">Origin</p>
                <p className="truncate font-semibold text-foreground">{job.pickup_location}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border-2 border-foreground/10 bg-card p-4 shadow-sm">
              <div className="grid size-10 place-items-center rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400">
                <Truck className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs uppercase text-muted-foreground">Live Transit</p>
                <p className="font-semibold text-foreground">{job.distance_km} km • {job.eta}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border-2 border-foreground/10 bg-card p-4 shadow-sm">
              <div className="grid size-10 place-items-center rounded-xl bg-blue-500/15 text-blue-700 dark:text-blue-400">
                <span className="text-xl">📍</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs uppercase text-muted-foreground">Destination</p>
                <p className="truncate font-semibold text-foreground">{job.dropoff_location}</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex h-[600px] flex-col items-center justify-center rounded-card border-2 border-foreground/10 bg-card shadow-panel">
          <MapPin className="mb-2 size-12 text-muted-foreground opacity-40" />
          <p className="text-lg font-semibold text-foreground">Job not found.</p>
          <Link
            to="/dashboard/logistics"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
          >
            <ArrowLeft className="size-4" /> Back to job board
          </Link>
        </div>
      )}
    </div>
  );
}
