/*
 * leaflet.nmealayer.js  v1.0
 *
 */


var FileLoader = L.Layer.extend({
    options: {
	parseRMC:     false,
	parseGGA:     false,
	parseGSV:     false,
	parseVTG:     false,
	parseGSA:     false,
	parseGLL:     false,
	parseZDA:     false,
        layerOptions: {}
    },

    initialize: function(map, options) {
        this._map = map;
        L.Util.setOptions(this, options);

        this.nmea = new NMEA();
	this.nmea.setErrorHandler(this.nmeaErrorHandler);
    },

    load: function(file) {
        var ext = file.name.split('.').pop();
        var reader = new FileReader();

        reader.onload = L.Util.bind(function(e) {
            this.fire('data:loading', {
		filename:  file.name,
		format:    ext
	    });

	    var layer = this.parser.call(this, e.target.result, ext);

	    this.fire('data:loaded', {
		layer:     layer,
		filename:  file.name,
		format:    ext
	    });
        }, this);

        reader.readAsText(file);
    },

    parser: function(content, format) {
	var geoJson = {
	    type:  'FeatureCollection',
	    features: []
	};
	var points = [];
	var rmcData = {},
	    ggaData = {},
	    sat = [],
	    gsaData = {};
	var haveRMC = false,
	    haveGGA = false,
	    haveGSV = false,
	    haveVTG = false,
	    haveGSA = false,
	    haveGLL = false,
	    haveZDA = false;
	var latitude, longitude;
	var sentences = content.split(/\r\n|\n/);

	for(var i = 0, l = sentences.length; i < l; i++) {
	    var sentence = sentences[i];
	    var obj = this.nmea.parse(sentence);

	    if(obj) {
		var sentenceID = obj.id;

		switch(sentenceID) {
		case 'GPRMC':
		    rmcData['date'] = obj.date;
		    rmcData['time'] = obj.time;
		    rmcData['speed'] = obj.speed;
		    rmcData['course'] = obj.course;
		    haveRMC = true;
		    break;
		case 'GPGGA':
		    ggaData['altitude'] = obj.altitude;
		    ggaData['satellites'] = obj.satellites;
		    latitude = obj.latitude;
		    longitude = obj.longitude;
		    haveGGA = true;
		    break;
		case 'GPGSV':
		    var msgs = obj.msgs;
		    var mnum = obj.mnum;

		    sat = sat.concat(obj.sat);

		    if(msgs === mnum)
			haveGSV = true;
		    break;
		case 'GPVTG':
		    haveVTG = true;
		    break;
		case 'GPGSA':
		    gsaData['mode'] = obj.mode;
		    gsaData['fix'] = obj.fix;
		    gsaData['hdop'] = obj.hdop;
		    gsaData['vdop'] = obj.vdop;
		    gsaData['pdop'] = obj.pdop;
		    haveGSA = true;
		    break;
		case 'GPGLL':
		    haveGLL = true;
		    break;
		case 'GPZDA':
		    haveZDA = true;
		    break;
		default:
		    break;
		}

		if(haveRMC && haveGGA && haveGSV && haveGSA) {
		    var properties = this.merge_objs(rmcData,
						     ggaData,
						     gsaData);
		    properties['sat'] = sat;

		    var feature = {
			type:  'Feature',
			geometry: {
			    type:  'Point',
			    coordinates: [
				longitude,
				latitude
			    ]
			},
			properties:  properties
		    };
		    var point = L.latLng(latitude, longitude);

		    points.push(point);
		    geoJson.features.push(feature);

		    sat = [];
		    haveRMC = haveGGA = haveGSV = haveVTG = haveGSA = haveGSA = haveZDA = false;
		}
	    }
	}

	var polylineOptions = this.merge_objs(this.options.layerOptions, {
	    features:  geoJson.features
	});
	var polyline = L.polyline(points, polylineOptions);

	return polyline.addTo(this._map);
    },

    nmeaErrorHandler: function(msg) {
	console.log('NMEA error:', msg);
    },

    merge_objs: function() {
	var objs = Array.prototype.slice.call(arguments);
	var _ = {};

	for(var i = 0, l = objs.length; i < l; i++) {
	    var obj = objs[i];

	    for(var attr in obj) {
		if(obj.hasOwnProperty(attr)) {
		    _[attr] = obj[attr];
		}
	    }
	}

	return _;
    }
});


L.Control.NmeaLayer = L.Control.extend({
    statics: {
        TITLE:  'Load NMEA file (NMEA, LOG, TXT)',
        LABEL:  '&#x1f4c2;' //&#8965;
    },
    options: {
        position:   'topleft',
        fitBounds:  true,
        layerOptions: {}
    },

    initialize: function(options) {
        L.Util.setOptions(this, options);
        this.loader = null;
    },

    onAdd: function (map) {
        this.loader = new FileLoader(map, {
	    layerOptions:  this.options.layerOptions
	});

        this.loader.on('data:loaded', function (e) {
            if(this.options.fitBounds) {
                window.setTimeout(function () {
                    map.fitBounds(e.layer.getBounds());//.zoomOut();
                }, 500);
            }
        }, this);

        this._initDragAndDrop(map);

        return this._initContainer();
    },

    _initDragAndDrop: function(map) {
        var fileLoader = this.loader,
            dropbox = map._container;

        var callbacks = {
            dragenter: function () {
                map.scrollWheelZoom.disable();
            },
            dragleave: function () {
                map.scrollWheelZoom.enable();
            },
            dragover: function (e) {
                e.stopPropagation();
                e.preventDefault();
            },
            drop: function (e) {
                e.stopPropagation();
                e.preventDefault();

                var files = Array.prototype.slice.apply(e.dataTransfer.files),
                    i = files.length;

                setTimeout(function() {
                    fileLoader.load(files.shift());
                    if(files.length > 0) {
                        setTimeout(arguments.callee, 25);
                    }
                }, 25);

                map.scrollWheelZoom.enable();
            }
        };

        for(var name in callbacks)
            dropbox.addEventListener(name, callbacks[name], false);
    },

    _initContainer: function() {
        var fileInput = L.DomUtil.create('input', 'hidden', container);
	fileInput.type = 'file';
        fileInput.accept = '.nmea,.log,.txt';
        fileInput.multiple = true;
        fileInput.style.display = 'none';

        var fileLoader = this.loader;
        fileInput.addEventListener("change", function(e) {
            var files = Array.prototype.slice.apply(this.files);

            setTimeout(function() {
                fileLoader.load(files.shift());
                if(files.length > 0) {
                    setTimeout(arguments.callee, 25);
                }
            }, 25);
            //fileLoader.load(this.files[0]);
        }, false);

        var zoomName = 'leaflet-control-filelayer leaflet-control-zoom',
            barName = 'leaflet-bar',
            partName = barName + '-part',
            container = L.DomUtil.create('div', zoomName + ' ' + barName);
        var link = L.DomUtil.create('a', zoomName + '-in ' + partName, container);
        link.innerHTML = L.Control.NmeaLayer.LABEL;
        link.href = '#';
        link.title = L.Control.NmeaLayer.TITLE;

        var stop = L.DomEvent.stopPropagation;
        L.DomEvent
            .on(link, 'click', stop)
            .on(link, 'mousedown', stop)
            .on(link, 'dblclick', stop)
            .on(link, 'click', L.DomEvent.preventDefault)
            .on(link, 'click', function(e) {
                fileInput.click();
                e.preventDefault();
            });

        return container;
    }
});

L.Control.nmeaLayer = function (options) {
    return new L.Control.NmeaLayer(options);
};

