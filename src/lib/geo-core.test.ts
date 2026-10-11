import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  crow,
  hitsFromNominatim,
  hitsFromOverpass,
  hitsFromPhoton,
  labelFromReverse,
  osrmUrls,
  overpassQuery,
  photonSearchUrl,
  rankByDistance,
  routeFromOsrm,
  stepText,
} from "./geo-core.ts";

describe("hitsFromPhoton", () => {
  it("maps a Photon feature to a place the app can save", () => {
    const hits = hitsFromPhoton({
      features: [
        {
          properties: {
            name: "Contramar",
            street: "Calle de Durango",
            housenumber: "200",
            locality: "Roma Norte",
            osm_type: "N",
            osm_id: 42,
            osm_value: "restaurant",
          },
          geometry: { coordinates: [-99.1631, 19.4151] },
        },
      ],
    });
    assert.deepEqual(hits, [
      {
        id: "osm-N-42",
        name: "Contramar",
        address: "Calle de Durango 200, Roma Norte",
        lon: -99.1631,
        lat: 19.4151,
        category: "Restaurante",
      },
    ]);
  });

  it("drops features without usable coordinates instead of pinning them at 0,0", () => {
    assert.deepEqual(hitsFromPhoton({ features: [{ properties: { name: "X" } }] }), []);
    assert.deepEqual(
      hitsFromPhoton({
        features: [{ properties: { name: "Y" }, geometry: { coordinates: ["a", "b"] } }],
      }),
      [],
    );
  });

  it("survives an unexpected payload", () => {
    assert.deepEqual(hitsFromPhoton(null), []);
    assert.deepEqual(hitsFromPhoton({}), []);
  });
});

describe("hitsFromNominatim", () => {
  it("uses the first line of display_name when there is no name", () => {
    const hits = hitsFromNominatim([
      { place_id: "7", display_name: "Mercado Roma, Colima, Roma Norte", lat: "19.413", lon: "-99.161", type: "cafe" },
    ]);
    assert.deepEqual(hits, [
      {
        id: "nom-7",
        name: "Mercado Roma",
        address: "Mercado Roma, Colima, Roma Norte",
        lat: 19.413,
        lon: -99.161,
        category: "Café",
      },
    ]);
  });

  it("ignores rows without coordinates", () => {
    assert.deepEqual(hitsFromNominatim([{ place_id: "8", display_name: "Nada" }]), []);
  });
});

describe("hitsFromOverpass", () => {
  const point = { lat: 19.4194, lon: -99.1617 };

  it("reads nodes and ways, nearest first, and keeps only named places", () => {
    const hits = hitsFromOverpass(
      {
        elements: [
          { type: "node", id: 1, lat: 19.44, lon: -99.16, tags: { name: "Lejos", amenity: "bar" } },
          { type: "node", id: 2, lat: 19.4196, lon: -99.1618, tags: { name: "Cerca", amenity: "cafe", "addr:street": "Colima", "addr:housenumber": "12" } },
          { type: "node", id: 3, lat: 19.42, lon: -99.162, tags: { amenity: "restaurant" } },
          { type: "way", id: 4, center: { lat: 19.42, lon: -99.162 }, tags: { name: "Way Centro", amenity: "restaurant" } },
        ],
      },
      point,
    );
    assert.deepEqual(
      hits.map((hit) => hit.name),
      ["Cerca", "Way Centro", "Lejos"],
    );
    assert.equal(hits[0].category, "Café");
    assert.equal(hits[0].address, "Colima 12");
  });
});

describe("rankByDistance", () => {
  const here = { lat: 19.4194, lon: -99.1617 };
  const hits = [
    { id: "a", lat: 48.8566, lon: 2.3522 }, // Paris
    { id: "b", lat: 19.42, lon: -99.162 }, // two blocks away
    { id: "c", lat: 19.43, lon: -99.16 },
  ];

  it("keeps nearby results and drops the ones on another continent", () => {
    assert.deepEqual(
      rankByDistance(hits, here).map((hit) => hit.id),
      ["b", "c"],
    );
  });

  it("keeps the closest five when nothing is close", () => {
    const far = [
      { id: "p1", lat: 48.85, lon: 2.35 },
      { id: "p2", lat: 48.86, lon: 2.36 },
    ];
    assert.deepEqual(
      rankByDistance(far, here).map((hit) => hit.id),
      ["p1", "p2"],
    );
  });
});

describe("crow", () => {
  it("measures the straight line in metres", () => {
    assert.equal(Math.round(crow(19.4194, -99.1617, 19.4194, -99.1617)), 0);
    assert.ok(Math.abs(crow(19.4194, -99.1617, 19.4294, -99.1617) - 1112) < 20);
  });
});

describe("url builders", () => {
  it("asks Photon for nearby restaurants with a bias point", () => {
    const url = new URL(photonSearchUrl("tacos", { lat: 19.42, lon: -99.16 }));
    assert.equal(url.origin + url.pathname, "https://photon.komoot.io/api/");
    assert.equal(url.searchParams.get("q"), "tacos");
    assert.equal(url.searchParams.get("limit"), "8");
    assert.equal(url.searchParams.get("lat"), "19.42");
  });

  it("scopes Overpass to food amenities around the point", () => {
    const query = overpassQuery({ lat: 19.42, lon: -99.16 });
    assert.match(query, /around:1200,19\.42,-99\.16/);
    assert.match(query, /restaurant\|cafe\|fast_food\|bar\|ice_cream/);
  });

  it("offers the demo OSRM server and the community mirror for the mode", () => {
    const urls = osrmUrls({ lat: 1, lon: 2 }, { lat: 3, lon: 4 }, "bike");
    assert.equal(urls[0], "https://router.project-osrm.org/route/v1/bike/2,1;4,3?overview=full&geometries=geojson&steps=true");
    assert.match(urls[1], /^https:\/\/routing\.openstreetmap\.de\/routed-bike\/route\/v1\/bike\//);
  });
});

describe("routeFromOsrm", () => {
  it("flips OSRM's lon/lat pairs into Leaflet's lat/lon order and translates steps", () => {
    const plan = routeFromOsrm({
      code: "Ok",
      routes: [
        {
          distance: 1234.5,
          duration: 600,
          geometry: { coordinates: [[-99.16, 19.42], [-99.17, 19.43]] },
          legs: [
            {
              steps: [
                { distance: 100, name: "Colima", maneuver: { type: "depart" } },
                { distance: 1134.5, name: "Álvaro Obregón", maneuver: { type: "turn", modifier: "right" } },
                { distance: 0, name: "", maneuver: { type: "arrive" } },
              ],
            },
          ],
        },
      ],
    });
    assert.equal(plan?.distanceM, 1234.5);
    assert.deepEqual(plan?.geometry, [
      [19.42, -99.16],
      [19.43, -99.17],
    ]);
    assert.deepEqual(plan?.steps, [
      { text: "Empieza por Colima", distanceM: 100 },
      { text: "Gira a la derecha por Álvaro Obregón", distanceM: 1134.5 },
      { text: "Llegaste al destino", distanceM: 0 },
    ]);
  });

  it("returns null when there is nothing to draw", () => {
    assert.equal(routeFromOsrm({ code: "NoRoute", routes: [] }), null);
    assert.equal(routeFromOsrm(null), null);
  });
});

describe("stepText", () => {
  it("translates the manoeuvres a route actually uses", () => {
    assert.equal(stepText("turn", "left", "Reforma"), "Gira a la izquierda por Reforma");
    assert.equal(stepText("roundabout", undefined, ""), "Toma la glorieta");
    assert.equal(stepText("merge", "slight right", "Circuito"), "Incorpórate ligeramente a la derecha por Circuito");
  });
});

describe("labelFromReverse", () => {
  it("prefers the neighbourhood, then the city", () => {
    assert.equal(labelFromReverse({ address: { suburb: "Roma Norte", city: "CDMX" } }), "Roma Norte");
    assert.equal(labelFromReverse({ address: { city: "CDMX" } }), "CDMX");
    assert.equal(labelFromReverse({}), "Tu ubicación");
  });
});
