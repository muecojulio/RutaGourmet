# RutaGourmet

App instalable para guardar restaurantes y lugares, marcar favoritos y ver cómo llegar.

- **Mapa con buscador**: escribe el restaurante al que quieres ir y guárdalo con un toque.
- **Botón *Agregar lugar***: abre una hoja con el buscador y «Cerca» para ver qué hay alrededor.
- **Punto de partida**: botón sobre el mapa. Toma tu ubicación (geolocalización) o busca una
  dirección; de ahí salen todas las rutas.
- **Cómo llegar**: ruta a pie, en auto o en bici, con distancia, tiempo e indicaciones paso a paso.
- **Favoritos**: cada lugar visitado se puede marcar con el corazón; los visitados que aún no lo
  están aparecen sugeridos en la pestaña de Favoritos.

Los lugares quedan en el teléfono. Las búsquedas y rutas usan OpenStreetMap (Photon, Nominatim,
Overpass) y enrutamiento público OSRM, sin cuenta y sin llave. Si el servidor de la app no alcanza
esos servicios (por ejemplo en una red restringida), el navegador los consulta directamente.

Node.js 24.x
