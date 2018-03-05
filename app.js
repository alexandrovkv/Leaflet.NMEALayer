/*
 * app.js  v1.0
 *
 */



function init(mapElId) {
    var mapContainer = document.getElementById(mapElId);

    var map = L.map(mapContainer, {
	center:  L.latLng(0, 0),
	zoom:    2,
	minZoom: 1,
	maxZoom: 18
    });

    var layerControl = L.control.layers().addTo(map);

    var osm = L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
	attribution: '&copy; <a href="http://openstreetmap.org/copyright">OpenStreetMap</a> contributors,' +
            '  <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>'
    }).addTo(map);
    layerControl.addBaseLayer(osm, 'OpenStreetMap');

    var nmeaLayer = L.Control.nmeaLayer({
        layerOptions: {
            color:  '#ff6600'
        }
    }).addTo(map);
    nmeaLayer.loader.on('data:loaded', function(e) {
	var layer = e.layer;
	var name = e.filename;

	layerControl.addOverlay(layer, name);
    });
}

