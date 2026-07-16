'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  GeoJSON as LeafletGeoJsonLayer,
  Layer,
  LatLngBoundsExpression,
  LatLngExpression,
  Map as LeafletMap,
  Path,
  PathOptions,
} from 'leaflet';
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from 'geojson';
import { HomeIcon } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { MunicipalityDeliverySummary } from '@/lib/municipality-delivery-totals';
import type { ThemeBudget } from '@/types/domain';

const COLOR_BIN_COUNT = 5;
const MAP_COLORS = ['#d7ebf7', '#9fcce5', '#67add2', '#347fa8', '#1f5f85'] as const;
const SATELLITE_TILE_URL =
  'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const ACRE_BOUNDS: LatLngBoundsExpression = [
  [-11.15, -74.05],
  [-7.1, -66.45],
];
const ACRE_CENTER: LatLngExpression = [-9.2, -70.25];
const INITIAL_ACRE_ZOOM = 6;
const ACRE_ZOOM_ADJUSTMENT = 0.5;
const MAP_SHAPE_VERTICAL_OFFSET = 24;

type AcreMunicipalityProperties = {
  CD_MUN: string;
  NM_MUN: string;
};

type AcreMunicipalityGeometry = Polygon | MultiPolygon;
type AcreMunicipalitiesGeoJson = FeatureCollection<AcreMunicipalityGeometry, AcreMunicipalityProperties>;

export type DeliveryMapTheme = 'ALL' | ThemeBudget;
export type MunicipalityDeliverySummaries = Record<DeliveryMapTheme, MunicipalityDeliverySummary>;

const THEME_OPTIONS: Array<{ value: DeliveryMapTheme; label: string }> = [
  { value: 'ALL', label: 'Todos os temas' },
  { value: 'OSG', label: 'Orçamento Sensível ao Gênero' },
  { value: 'OCAD', label: 'Orçamento da Criança e do Adolescente' },
  { value: 'CLIMATICO', label: 'Orçamento Climático' },
];

function formatDeliveries(count: number): string {
  return `${count.toLocaleString('pt-BR')} ${count === 1 ? 'entrega' : 'entregas'}`;
}

function colorBin(value: number, maximum: number): number {
  if (value <= 0 || maximum <= 0) return 0;
  return Math.min(COLOR_BIN_COUNT, Math.max(1, Math.ceil((value / maximum) * COLOR_BIN_COUNT)));
}

function isAcreGeoJson(value: unknown): value is AcreMunicipalitiesGeoJson {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AcreMunicipalitiesGeoJson>;
  return (
    candidate.type === 'FeatureCollection' &&
    Array.isArray(candidate.features) &&
    candidate.features.length === 22 &&
    candidate.features.every(
      (feature) =>
        feature?.type === 'Feature' &&
        (feature.geometry?.type === 'Polygon' || feature.geometry?.type === 'MultiPolygon') &&
        typeof feature.properties?.CD_MUN === 'string' &&
        typeof feature.properties?.NM_MUN === 'string',
    )
  );
}

function tooltipContent(name: string, deliveries: number): HTMLDivElement {
  const wrapper = document.createElement('div');
  const municipality = document.createElement('strong');
  const value = document.createElement('div');
  municipality.textContent = name;
  value.textContent = formatDeliveries(deliveries);
  wrapper.append(municipality, value);
  return wrapper;
}

function fitMapToAcre(map: LeafletMap, container: HTMLDivElement): boolean {
  if (container.clientWidth === 0 || container.clientHeight === 0) return false;
  map.invalidateSize({ animate: false, pan: false });
  map.fitBounds(ACRE_BOUNDS, { animate: false, padding: [12, 12] });
  map.setZoom(map.getZoom() + ACRE_ZOOM_ADJUSTMENT, { animate: false });
  map.panBy([0, -MAP_SHAPE_VERTICAL_OFFSET], { animate: false });
  return true;
}

export function AcreDeliveriesMap({ summaries }: { summaries: MunicipalityDeliverySummaries }) {
  const [selectedTheme, setSelectedTheme] = useState<DeliveryMapTheme>('ALL');
  const [geoJson, setGeoJson] = useState<AcreMunicipalitiesGeoJson | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [satelliteError, setSatelliteError] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [activeMunicipality, setActiveMunicipality] = useState<string | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const geoJsonLayerRef = useRef<LeafletGeoJsonLayer | null>(null);
  const leafletRef = useRef<typeof import('leaflet') | null>(null);
  const hasFittedBoundsRef = useRef(false);

  const summary = summaries[selectedTheme];
  const selectedThemeLabel = THEME_OPTIONS.find((option) => option.value === selectedTheme)?.label;
  const deliveriesByMunicipality = useMemo(
    () => new Map<string, number>(summary.totals.map((item) => [item.municipality, item.deliveries])),
    [summary.totals],
  );

  const recenterMap = () => {
    const map = mapRef.current;
    const container = mapContainerRef.current;
    if (map && container) fitMapToAcre(map, container);
  };
  const maximum = useMemo(
    () => summary.totals.reduce((highest, item) => Math.max(highest, item.deliveries), 0),
    [summary.totals],
  );

  useEffect(() => {
    const controller = new AbortController();

    fetch('/maps/acre-municipalities-2025.geojson', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Não foi possível carregar a malha municipal.');
        return response.json() as Promise<unknown>;
      })
      .then((data) => {
        if (!isAcreGeoJson(data)) throw new Error('A malha municipal está incompleta.');
        setGeoJson(data);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(true);
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!geoJson || !mapContainerRef.current) return;
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;

    void import('leaflet').then((leafletModule) => {
      if (cancelled || !mapContainerRef.current) return;
      const leaflet = leafletModule;
      const container = mapContainerRef.current;
      mapRef.current?.remove();
      mapRef.current = null;
      container.replaceChildren();
      delete (container as HTMLDivElement & { _leaflet_id?: number })._leaflet_id;
      hasFittedBoundsRef.current = false;
      leafletRef.current = leafletModule;

      const map = leaflet.map(container, {
        attributionControl: false,
        scrollWheelZoom: true,
        zoomControl: true,
        zoomSnap: 0.5,
      });
      map.setView(ACRE_CENTER, INITIAL_ACRE_ZOOM, { animate: false });
      const satelliteLayer = leaflet.tileLayer(SATELLITE_TILE_URL, {
        maxZoom: 19,
      });
      satelliteLayer.on('tileerror', () => setSatelliteError(true));
      satelliteLayer.on('load', () => setSatelliteError(false));
      satelliteLayer.addTo(map);
      mapRef.current = map;
      setMapReady(true);
      const refreshMapSize = () => {
        if (cancelled) return;
        map.invalidateSize({ animate: false, pan: false });
        if (!hasFittedBoundsRef.current) {
          hasFittedBoundsRef.current = fitMapToAcre(map, container);
        }
      };
      resizeObserver = new ResizeObserver(() => window.requestAnimationFrame(refreshMapSize));
      resizeObserver.observe(container);
      map.whenReady(() => window.requestAnimationFrame(refreshMapSize));
    }).catch(() => setMapError(true));

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      geoJsonLayerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      leafletRef.current = null;
      setMapReady(false);
    };
  }, [geoJson]);

  useEffect(() => {
    const map = mapRef.current;
    const leaflet = leafletRef.current;
    if (!map || !leaflet || !geoJson || !mapReady) return;

    setActiveMunicipality(null);
    if (geoJsonLayerRef.current) map.removeLayer(geoJsonLayerRef.current);

    const styleForMunicipality = (name: string): PathOptions => {
      const deliveries = deliveriesByMunicipality.get(name) ?? 0;
      const bin = colorBin(deliveries, maximum);
      return {
        color: '#ffffff',
        fillColor: bin === 0 ? '#94a3b8' : MAP_COLORS[bin - 1],
        fillOpacity: bin === 0 ? 0.18 : 0.62,
        opacity: 0.95,
        weight: 1.4,
      };
    };

    const layer = leaflet.geoJSON(geoJson, {
      style: (feature?: Feature<Geometry, AcreMunicipalityProperties>) =>
        styleForMunicipality(feature?.properties?.NM_MUN ?? ''),
      onEachFeature: (
        feature: Feature<AcreMunicipalityGeometry, AcreMunicipalityProperties>,
        municipalityLayer: Layer,
      ) => {
        const name = feature.properties.NM_MUN;
        const deliveries = deliveriesByMunicipality.get(name) ?? 0;
        const pathLayer = municipalityLayer as Path;
        pathLayer.bindTooltip(tooltipContent(name, deliveries), {
          direction: 'top',
          sticky: true,
        });
        pathLayer.on({
          mouseover: () => {
            setActiveMunicipality(name);
            pathLayer.setStyle({ fillOpacity: deliveries > 0 ? 0.78 : 0.32, weight: 3 });
          },
          mouseout: () => {
            setActiveMunicipality(null);
            pathLayer.setStyle(styleForMunicipality(name));
          },
          add: () => {
            const element = pathLayer.getElement();
            if (!element) return;
            element.setAttribute('aria-label', `${name}: ${formatDeliveries(deliveries)}`);
            element.setAttribute('tabindex', '0');
            element.addEventListener('focus', () => {
              setActiveMunicipality(name);
              pathLayer.openTooltip();
              pathLayer.setStyle({ fillOpacity: deliveries > 0 ? 0.78 : 0.32, weight: 3 });
            });
            element.addEventListener('blur', () => {
              setActiveMunicipality(null);
              pathLayer.closeTooltip();
              pathLayer.setStyle(styleForMunicipality(name));
            });
          },
        });
      },
    });

    layer.addTo(map);
    layer.bringToFront();
    geoJsonLayerRef.current = layer;
    if (!hasFittedBoundsRef.current) {
      const container = mapContainerRef.current;
      if (container) hasFittedBoundsRef.current = fitMapToAcre(map, container);
    }
    window.requestAnimationFrame(() => map.invalidateSize());

    return () => {
      if (map.hasLayer(layer)) map.removeLayer(layer);
      if (geoJsonLayerRef.current === layer) geoJsonLayerRef.current = null;
    };
  }, [geoJson, mapReady, maximum, deliveriesByMunicipality]);

  return (
    <Card>
      <CardHeader className="bg-transparent text-card-foreground [&_[data-slot=card-title]]:text-card-foreground [&_[data-slot=card-description]]:text-muted-foreground">
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span>Entregas por município</span>
          <Select value={selectedTheme} onValueChange={(value) => setSelectedTheme(value as DeliveryMapTheme)}>
            <SelectTrigger
              id="delivery-map-theme"
              className="w-full font-normal sm:w-64"
              aria-label="Selecionar orçamento temático"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {THEME_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {loadError || mapError ? (
          <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
            Não foi possível inicializar o mapa dos municípios do Acre.
          </div>
        ) : (
          <div
            className="relative isolate h-[28rem] min-h-80 w-full overflow-hidden rounded-lg border"
            role="region"
            aria-label={`Mapa de satélite das entregas por município — ${selectedThemeLabel}`}
          >
            <div
              ref={mapContainerRef}
              className="size-full bg-muted"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="absolute left-3 top-[4.75rem] z-[1000] bg-background/95 shadow-sm backdrop-blur-sm hover:bg-background"
              aria-label="Recentralizar mapa do Acre"
              title="Recentralizar mapa"
              disabled={!mapReady}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                recenterMap();
              }}
            >
              <HomeIcon aria-hidden="true" />
            </Button>
            <CardDescription className="pointer-events-none absolute right-3 top-3 z-[1000] max-w-[calc(100%-4.5rem)] rounded-md border bg-background/90 px-2 py-1 text-right !text-xs !leading-4 shadow-sm backdrop-blur-sm">
              Nº de entregas aprovadas por município — {selectedThemeLabel}.
            </CardDescription>
            {!geoJson ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-muted text-sm text-muted-foreground">
                Carregando mapa…
              </div>
            ) : null}
          </div>
        )}

        {satelliteError ? (
          <p className="text-xs text-destructive">
            A imagem de satélite não pôde ser carregada. Os limites municipais continuam disponíveis.
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground" aria-label="Legenda de intensidade das entregas">
          <span className="inline-block size-3 rounded-sm border bg-slate-400/20" aria-hidden="true" />
          <span>Sem entregas</span>
          <span className="ml-auto">Menos</span>
          {MAP_COLORS.map((color) => (
            <span
              key={color}
              className="inline-block size-3 rounded-sm border border-white/70"
              style={{ backgroundColor: color }}
              aria-hidden="true"
            />
          ))}
          <span>Mais</span>
        </div>

        {activeMunicipality ? (
          <p className="text-xs text-foreground" aria-live="polite">
            Município selecionado: <span className="font-semibold">{activeMunicipality}</span>
          </p>
        ) : null}

        {summary.outsideStateDeliveries > 0 ? (
          <p className="text-xs text-muted-foreground">
            {summary.outsideStateDeliveries.toLocaleString('pt-BR')}{' '}
            {summary.outsideStateDeliveries === 1 ? 'entrega possui' : 'entregas possuem'} alcance fora do Acre
            {' '}e não aparece no mapa.
          </p>
        ) : null}

        <p className="text-[11px] text-muted-foreground">
          Malha: IBGE 2025. Imagem: Esri, Vantor, Earthstar Geographics e GIS User Community.
        </p>
      </CardContent>
    </Card>
  );
}
