
var Module;

if (typeof Module === 'undefined') Module = eval('(function() { try { return Module || {} } catch(e) { return {} } })()');

if (!Module.expectedDataFileDownloads) {
  Module.expectedDataFileDownloads = 0;
  Module.finishedDataFileDownloads = 0;
}
Module.expectedDataFileDownloads++;
(function() {
 var loadPackage = function(metadata) {

  var PACKAGE_PATH;
  if (typeof window === 'object') {
    PACKAGE_PATH = window['encodeURIComponent'](window.location.pathname.toString().substring(0, window.location.pathname.toString().lastIndexOf('/')) + '/');
  } else if (typeof location !== 'undefined') {
      // worker
      PACKAGE_PATH = encodeURIComponent(location.pathname.toString().substring(0, location.pathname.toString().lastIndexOf('/')) + '/');
    } else {
      throw 'using preloaded data can only be done on a web page or in a web worker';
    }
    var PACKAGE_NAME = 'game.data';
    var REMOTE_PACKAGE_BASE = 'game.data';
    if (typeof Module['locateFilePackage'] === 'function' && !Module['locateFile']) {
      Module['locateFile'] = Module['locateFilePackage'];
      Module.printErr('warning: you defined Module.locateFilePackage, that has been renamed to Module.locateFile (using your locateFilePackage for now)');
    }
    var REMOTE_PACKAGE_NAME = typeof Module['locateFile'] === 'function' ?
    Module['locateFile'](REMOTE_PACKAGE_BASE) :
    ((Module['filePackagePrefixURL'] || '') + REMOTE_PACKAGE_BASE);

    var REMOTE_PACKAGE_SIZE = metadata.remote_package_size;
    var PACKAGE_UUID = metadata.package_uuid;

    function fetchRemotePackage(packageName, packageSize, callback, errback) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', packageName, true);
      xhr.responseType = 'arraybuffer';
      xhr.onprogress = function(event) {
        var url = packageName;
        var size = packageSize;
        if (event.total) size = event.total;
        if (event.loaded) {
          if (!xhr.addedTotal) {
            xhr.addedTotal = true;
            if (!Module.dataFileDownloads) Module.dataFileDownloads = {};
            Module.dataFileDownloads[url] = {
              loaded: event.loaded,
              total: size
            };
          } else {
            Module.dataFileDownloads[url].loaded = event.loaded;
          }
          var total = 0;
          var loaded = 0;
          var num = 0;
          for (var download in Module.dataFileDownloads) {
            var data = Module.dataFileDownloads[download];
            total += data.total;
            loaded += data.loaded;
            num++;
          }
          total = Math.ceil(total * Module.expectedDataFileDownloads/num);
          if (Module['setStatus']) Module['setStatus']('Downloading data... (' + loaded + '/' + total + ')');
        } else if (!Module.dataFileDownloads) {
          if (Module['setStatus']) Module['setStatus']('Downloading data...');
        }
      };
      xhr.onerror = function(event) {
        throw new Error("NetworkError for: " + packageName);
      }
      xhr.onload = function(event) {
        if (xhr.status == 200 || xhr.status == 304 || xhr.status == 206 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
          var packageData = xhr.response;
          callback(packageData);
        } else {
          throw new Error(xhr.statusText + " : " + xhr.responseURL);
        }
      };
      xhr.send(null);
    };

    function handleError(error) {
      console.error('package error:', error);
    };

    function runWithFS() {

      function assert(check, msg) {
        if (!check) throw msg + new Error().stack;
      }
      Module['FS_createPath']('/', 'assets', true, true);
      Module['FS_createPath']('/assets', 'dance_frames', true, true);
      Module['FS_createPath']('/assets', 'font', true, true);
      Module['FS_createPath']('/assets', 'sounds', true, true);
      Module['FS_createPath']('/', 'moonshine', true, true);
      Module['FS_createPath']('/', 'sti', true, true);
      Module['FS_createPath']('/sti', 'plugins', true, true);

      function DataRequest(start, end, crunched, audio) {
        this.start = start;
        this.end = end;
        this.crunched = crunched;
        this.audio = audio;
      }
      DataRequest.prototype = {
        requests: {},
        open: function(mode, name) {
          this.name = name;
          this.requests[name] = this;
          Module['addRunDependency']('fp ' + this.name);
        },
        send: function() {},
        onload: function() {
          var byteArray = this.byteArray.subarray(this.start, this.end);

          this.finish(byteArray);

        },
        finish: function(byteArray) {
          var that = this;

        Module['FS_createDataFile'](this.name, null, byteArray, true, true, true); // canOwn this data in the filesystem, it is a slide into the heap that will never change
        Module['removeRunDependency']('fp ' + that.name);

        this.requests[this.name] = null;
      }
    };

    var files = metadata.files;
    for (i = 0; i < files.length; ++i) {
      new DataRequest(files[i].start, files[i].end, files[i].crunched, files[i].audio).open('GET', files[i].filename);
    }


    var indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
    var IDB_RO = "readonly";
    var IDB_RW = "readwrite";
    var DB_NAME = "EM_PRELOAD_CACHE";
    var DB_VERSION = 1;
    var METADATA_STORE_NAME = 'METADATA';
    var PACKAGE_STORE_NAME = 'PACKAGES';
    function openDatabase(callback, errback) {
      try {
        var openRequest = indexedDB.open(DB_NAME, DB_VERSION);
      } catch (e) {
        return errback(e);
      }
      openRequest.onupgradeneeded = function(event) {
        var db = event.target.result;

        if(db.objectStoreNames.contains(PACKAGE_STORE_NAME)) {
          db.deleteObjectStore(PACKAGE_STORE_NAME);
        }
        var packages = db.createObjectStore(PACKAGE_STORE_NAME);

        if(db.objectStoreNames.contains(METADATA_STORE_NAME)) {
          db.deleteObjectStore(METADATA_STORE_NAME);
        }
        var metadata = db.createObjectStore(METADATA_STORE_NAME);
      };
      openRequest.onsuccess = function(event) {
        var db = event.target.result;
        callback(db);
      };
      openRequest.onerror = function(error) {
        errback(error);
      };
    };

    /* Check if there's a cached package, and if so whether it's the latest available */
    function checkCachedPackage(db, packageName, callback, errback) {
      var transaction = db.transaction([METADATA_STORE_NAME], IDB_RO);
      var metadata = transaction.objectStore(METADATA_STORE_NAME);

      var getRequest = metadata.get("metadata/" + packageName);
      getRequest.onsuccess = function(event) {
        var result = event.target.result;
        if (!result) {
          return callback(false);
        } else {
          return callback(PACKAGE_UUID === result.uuid);
        }
      };
      getRequest.onerror = function(error) {
        errback(error);
      };
    };

    function fetchCachedPackage(db, packageName, callback, errback) {
      var transaction = db.transaction([PACKAGE_STORE_NAME], IDB_RO);
      var packages = transaction.objectStore(PACKAGE_STORE_NAME);

      var getRequest = packages.get("package/" + packageName);
      getRequest.onsuccess = function(event) {
        var result = event.target.result;
        callback(result);
      };
      getRequest.onerror = function(error) {
        errback(error);
      };
    };

    function cacheRemotePackage(db, packageName, packageData, packageMeta, callback, errback) {
      var transaction_packages = db.transaction([PACKAGE_STORE_NAME], IDB_RW);
      var packages = transaction_packages.objectStore(PACKAGE_STORE_NAME);

      var putPackageRequest = packages.put(packageData, "package/" + packageName);
      putPackageRequest.onsuccess = function(event) {
        var transaction_metadata = db.transaction([METADATA_STORE_NAME], IDB_RW);
        var metadata = transaction_metadata.objectStore(METADATA_STORE_NAME);
        var putMetadataRequest = metadata.put(packageMeta, "metadata/" + packageName);
        putMetadataRequest.onsuccess = function(event) {
          callback(packageData);
        };
        putMetadataRequest.onerror = function(error) {
          errback(error);
        };
      };
      putPackageRequest.onerror = function(error) {
        errback(error);
      };
    };

    function processPackageData(arrayBuffer) {
      Module.finishedDataFileDownloads++;
      assert(arrayBuffer, 'Loading data file failed.');
      assert(arrayBuffer instanceof ArrayBuffer, 'bad input to processPackageData');
      var byteArray = new Uint8Array(arrayBuffer);
      var curr;

        // copy the entire loaded file into a spot in the heap. Files will refer to slices in that. They cannot be freed though
        // (we may be allocating before malloc is ready, during startup).
        if (Module['SPLIT_MEMORY']) Module.printErr('warning: you should run the file packager with --no-heap-copy when SPLIT_MEMORY is used, otherwise copying into the heap may fail due to the splitting');
        var ptr = Module['getMemory'](byteArray.length);
        Module['HEAPU8'].set(byteArray, ptr);
        DataRequest.prototype.byteArray = Module['HEAPU8'].subarray(ptr, ptr+byteArray.length);

        var files = metadata.files;
        for (i = 0; i < files.length; ++i) {
          DataRequest.prototype.requests[files[i].filename].onload();
        }
        Module['removeRunDependency']('datafile_game.data');

      };
      Module['addRunDependency']('datafile_game.data');

      if (!Module.preloadResults) Module.preloadResults = {};

      function preloadFallback(error) {
        console.error(error);
        console.error('falling back to default preload behavior');
        fetchRemotePackage(REMOTE_PACKAGE_NAME, REMOTE_PACKAGE_SIZE, processPackageData, handleError);
      };

      openDatabase(
        function(db) {
          checkCachedPackage(db, PACKAGE_PATH + PACKAGE_NAME,
            function(useCached) {
              Module.preloadResults[PACKAGE_NAME] = {fromCache: useCached};
              if (useCached) {
                console.info('loading ' + PACKAGE_NAME + ' from cache');
                fetchCachedPackage(db, PACKAGE_PATH + PACKAGE_NAME, processPackageData, preloadFallback);
              } else {
                console.info('loading ' + PACKAGE_NAME + ' from remote');
                fetchRemotePackage(REMOTE_PACKAGE_NAME, REMOTE_PACKAGE_SIZE,
                  function(packageData) {
                    cacheRemotePackage(db, PACKAGE_PATH + PACKAGE_NAME, packageData, {uuid:PACKAGE_UUID}, processPackageData,
                      function(error) {
                        console.error(error);
                        processPackageData(packageData);
                      });
                  }
                  , preloadFallback);
              }
            }
            , preloadFallback);
        }
        , preloadFallback);

      if (Module['setStatus']) Module['setStatus']('Downloading...');

    }
    if (Module['calledRun']) {
      runWithFS();
    } else {
      if (!Module['preRun']) Module['preRun'] = [];
      Module["preRun"].push(runWithFS); // FS is not initialized yet, wait for it
    }

  }
  loadPackage({"package_uuid":"8644b756-7560-4580-928d-314892b22bfc","remote_package_size":3752294,"files":[{"filename":"/assets/.DS_Store","crunched":0,"start":0,"end":8196,"audio":false},{"filename":"/assets/Icons_Controller.png","crunched":0,"start":8196,"end":10535,"audio":false},{"filename":"/assets/MKitten_pixelized.png","crunched":0,"start":10535,"end":13725,"audio":false},{"filename":"/assets/README.md","crunched":0,"start":13725,"end":28055,"audio":false},{"filename":"/assets/Simple_frame_8.png","crunched":0,"start":28055,"end":34046,"audio":false},{"filename":"/assets/boxblur.lua","crunched":0,"start":34046,"end":36074,"audio":false},{"filename":"/assets/cave_lightmap.png","crunched":0,"start":36074,"end":105746,"audio":false},{"filename":"/assets/cave_lightmap_candle_light.png","crunched":0,"start":105746,"end":114188,"audio":false},{"filename":"/assets/chromasep.lua","crunched":0,"start":114188,"end":115770,"audio":false},{"filename":"/assets/colorgradesimple.lua","crunched":0,"start":115770,"end":116901,"audio":false},{"filename":"/assets/crt.lua","crunched":0,"start":116901,"end":119331,"audio":false},{"filename":"/assets/dance_frames/frame1.png","crunched":0,"start":119331,"end":175503,"audio":false},{"filename":"/assets/dance_frames/frame2.png","crunched":0,"start":175503,"end":230492,"audio":false},{"filename":"/assets/dance_frames/frame3.png","crunched":0,"start":230492,"end":286664,"audio":false},{"filename":"/assets/dance_frames/frame4.png","crunched":0,"start":286664,"end":341284,"audio":false},{"filename":"/assets/demo_victory_glow.png","crunched":0,"start":341284,"end":375170,"audio":false},{"filename":"/assets/desaturate.lua","crunched":0,"start":375170,"end":376770,"audio":false},{"filename":"/assets/dmg.lua","crunched":0,"start":376770,"end":381148,"audio":false},{"filename":"/assets/dwarf_miner_sprite_sheet.png","crunched":0,"start":381148,"end":438817,"audio":false},{"filename":"/assets/fastgaussianblur.lua","crunched":0,"start":438817,"end":444134,"audio":false},{"filename":"/assets/filmgrain.lua","crunched":0,"start":444134,"end":446139,"audio":false},{"filename":"/assets/fog.lua","crunched":0,"start":446139,"end":449198,"audio":false},{"filename":"/assets/font/comic_neue_13.ttf","crunched":0,"start":449198,"end":506446,"audio":false},{"filename":"/assets/font/shinonome_16.ttf","crunched":0,"start":506446,"end":2461174,"audio":false},{"filename":"/assets/gamecontrollerdb.txt","crunched":0,"start":2461174,"end":3045197,"audio":false},{"filename":"/assets/gaussianblur.lua","crunched":0,"start":3045197,"end":3047126,"audio":false},{"filename":"/assets/glow.lua","crunched":0,"start":3047126,"end":3050559,"audio":false},{"filename":"/assets/godsray.lua","crunched":0,"start":3050559,"end":3053805,"audio":false},{"filename":"/assets/ground_particle.png","crunched":0,"start":3053805,"end":3054234,"audio":false},{"filename":"/assets/init.lua","crunched":0,"start":3054234,"end":3059166,"audio":false},{"filename":"/assets/mainmenu_header.png","crunched":0,"start":3059166,"end":3261583,"audio":false},{"filename":"/assets/mkitten_barf_head_pixelized.png","crunched":0,"start":3261583,"end":3264396,"audio":false},{"filename":"/assets/mkitten_ducking_pixelized.png","crunched":0,"start":3264396,"end":3267153,"audio":false},{"filename":"/assets/mkitten_idle_pixelized.png","crunched":0,"start":3267153,"end":3270287,"audio":false},{"filename":"/assets/mkitten_leap_pixelized.png","crunched":0,"start":3270287,"end":3273792,"audio":false},{"filename":"/assets/mkitten_strong_pixelized.png","crunched":0,"start":3273792,"end":3278461,"audio":false},{"filename":"/assets/mkitten_strong_walk_1_pixelized.png","crunched":0,"start":3278461,"end":3282977,"audio":false},{"filename":"/assets/mkitten_strong_walk_2_pixelized.png","crunched":0,"start":3282977,"end":3287761,"audio":false},{"filename":"/assets/mkitten_walk_1_pixelized.png","crunched":0,"start":3287761,"end":3290968,"audio":false},{"filename":"/assets/mkitten_walk_2_pixelized.png","crunched":0,"start":3290968,"end":3294145,"audio":false},{"filename":"/assets/pixelate.lua","crunched":0,"start":3294145,"end":3295961,"audio":false},{"filename":"/assets/pixelfont-11p.png","crunched":0,"start":3295961,"end":3297501,"audio":false},{"filename":"/assets/posterize.lua","crunched":0,"start":3297501,"end":3299488,"audio":false},{"filename":"/assets/scanlines.lua","crunched":0,"start":3299488,"end":3301823,"audio":false},{"filename":"/assets/sketch.lua","crunched":0,"start":3301823,"end":3304037,"audio":false},{"filename":"/assets/sounds/cave_dweller_warble.wav","crunched":0,"start":3304037,"end":3307537,"audio":true},{"filename":"/assets/sounds/coin.wav","crunched":0,"start":3307537,"end":3316322,"audio":true},{"filename":"/assets/sounds/explosion.wav","crunched":0,"start":3316322,"end":3336299,"audio":true},{"filename":"/assets/sounds/hairball_cough.wav","crunched":0,"start":3336299,"end":3375745,"audio":true},{"filename":"/assets/sounds/hurt.wav","crunched":0,"start":3375745,"end":3383421,"audio":true},{"filename":"/assets/sounds/jump.wav","crunched":0,"start":3383421,"end":3387480,"audio":true},{"filename":"/assets/sounds/metal_clang.wav","crunched":0,"start":3387480,"end":3476104,"audio":true},{"filename":"/assets/sounds/power_up.wav","crunched":0,"start":3476104,"end":3491916,"audio":true},{"filename":"/assets/sounds/shoot.wav","crunched":0,"start":3491916,"end":3505236,"audio":true},{"filename":"/assets/sounds/spike_pass.wav","crunched":0,"start":3505236,"end":3552908,"audio":true},{"filename":"/assets/sounds/splat.wav","crunched":0,"start":3552908,"end":3596192,"audio":true},{"filename":"/assets/sounds/tap.wav","crunched":0,"start":3596192,"end":3597757,"audio":true},{"filename":"/assets/spike.png","crunched":0,"start":3597757,"end":3600405,"audio":false},{"filename":"/assets/star.png","crunched":0,"start":3600405,"end":3601785,"audio":false},{"filename":"/assets/vignette.lua","crunched":0,"start":3601785,"end":3603672,"audio":false},{"filename":"/assets/world_tileset.png","crunched":0,"start":3603672,"end":3616700,"audio":false},{"filename":"/main.lua","crunched":0,"start":3616700,"end":3616722,"audio":false},{"filename":"/moonshine/README.md","crunched":0,"start":3616722,"end":3631052,"audio":false},{"filename":"/moonshine/boxblur.lua","crunched":0,"start":3631052,"end":3633080,"audio":false},{"filename":"/moonshine/chromasep.lua","crunched":0,"start":3633080,"end":3634662,"audio":false},{"filename":"/moonshine/colorgradesimple.lua","crunched":0,"start":3634662,"end":3635793,"audio":false},{"filename":"/moonshine/crt.lua","crunched":0,"start":3635793,"end":3638223,"audio":false},{"filename":"/moonshine/desaturate.lua","crunched":0,"start":3638223,"end":3639823,"audio":false},{"filename":"/moonshine/dmg.lua","crunched":0,"start":3639823,"end":3644201,"audio":false},{"filename":"/moonshine/fastgaussianblur.lua","crunched":0,"start":3644201,"end":3649518,"audio":false},{"filename":"/moonshine/filmgrain.lua","crunched":0,"start":3649518,"end":3651523,"audio":false},{"filename":"/moonshine/fog.lua","crunched":0,"start":3651523,"end":3654582,"audio":false},{"filename":"/moonshine/gaussianblur.lua","crunched":0,"start":3654582,"end":3656511,"audio":false},{"filename":"/moonshine/glow.lua","crunched":0,"start":3656511,"end":3659944,"audio":false},{"filename":"/moonshine/godsray.lua","crunched":0,"start":3659944,"end":3663190,"audio":false},{"filename":"/moonshine/init.lua","crunched":0,"start":3663190,"end":3668122,"audio":false},{"filename":"/moonshine/pixelate.lua","crunched":0,"start":3668122,"end":3669938,"audio":false},{"filename":"/moonshine/posterize.lua","crunched":0,"start":3669938,"end":3671925,"audio":false},{"filename":"/moonshine/scanlines.lua","crunched":0,"start":3671925,"end":3674260,"audio":false},{"filename":"/moonshine/sketch.lua","crunched":0,"start":3674260,"end":3676474,"audio":false},{"filename":"/moonshine/vignette.lua","crunched":0,"start":3676474,"end":3678361,"audio":false},{"filename":"/sti/atlas.lua","crunched":0,"start":3678361,"end":3682736,"audio":false},{"filename":"/sti/graphics.lua","crunched":0,"start":3682736,"end":3684831,"audio":false},{"filename":"/sti/init.lua","crunched":0,"start":3684831,"end":3731912,"audio":false},{"filename":"/sti/plugins/box2d.lua","crunched":0,"start":3731912,"end":3741647,"audio":false},{"filename":"/sti/plugins/bump.lua","crunched":0,"start":3741647,"end":3747424,"audio":false},{"filename":"/sti/utils.lua","crunched":0,"start":3747424,"end":3752294,"audio":false}]});

})();
