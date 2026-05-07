
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
      Module['FS_createPath']('/', 'sti', true, true);
      Module['FS_createPath']('/sti', 'plugins', true, true);
      Module['FS_createPath']('/sti', 'sti', true, true);
      Module['FS_createPath']('/sti/sti', 'plugins', true, true);

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
  loadPackage({"package_uuid":"c2765d0d-080d-4bfa-97de-0193693b62cf","remote_package_size":7039585,"files":[{"filename":"/assets/.DS_Store","crunched":0,"start":0,"end":8196,"audio":false},{"filename":"/assets/Icons_Controller.png","crunched":0,"start":8196,"end":10535,"audio":false},{"filename":"/assets/MKitten_pixelized.png","crunched":0,"start":10535,"end":13725,"audio":false},{"filename":"/assets/Simple_frame_8.png","crunched":0,"start":13725,"end":19716,"audio":false},{"filename":"/assets/cave_lightmap.png","crunched":0,"start":19716,"end":89388,"audio":false},{"filename":"/assets/cave_lightmap_candle_light.png","crunched":0,"start":89388,"end":97830,"audio":false},{"filename":"/assets/dance_frames/frame1.png","crunched":0,"start":97830,"end":154002,"audio":false},{"filename":"/assets/dance_frames/frame2.png","crunched":0,"start":154002,"end":208991,"audio":false},{"filename":"/assets/dance_frames/frame3.png","crunched":0,"start":208991,"end":265163,"audio":false},{"filename":"/assets/dance_frames/frame4.png","crunched":0,"start":265163,"end":319783,"audio":false},{"filename":"/assets/demo_victory_face.png","crunched":0,"start":319783,"end":384807,"audio":false},{"filename":"/assets/demo_victory_glow.png","crunched":0,"start":384807,"end":418693,"audio":false},{"filename":"/assets/dwarf_miner_sprite_sheet.png","crunched":0,"start":418693,"end":476362,"audio":false},{"filename":"/assets/font/Golden_Apple_LICENSE.txt","crunched":0,"start":476362,"end":480680,"audio":false},{"filename":"/assets/font/comic_neue_13.ttf","crunched":0,"start":480680,"end":537928,"audio":false},{"filename":"/assets/font/comic_neue_bold_19.ttf","crunched":0,"start":537928,"end":593644,"audio":false},{"filename":"/assets/font/earth_illusion.fnt","crunched":0,"start":593644,"end":618130,"audio":false},{"filename":"/assets/font/earth_illusion.png","crunched":0,"start":618130,"end":623546,"audio":false},{"filename":"/assets/font/earth_illusion_LICENSE.txt","crunched":0,"start":623546,"end":627864,"audio":false},{"filename":"/assets/font/golden_apple.fnt","crunched":0,"start":627864,"end":672086,"audio":false},{"filename":"/assets/font/golden_apple.png","crunched":0,"start":672086,"end":678887,"audio":false},{"filename":"/assets/font/monogram_extended_custom.ttf","crunched":0,"start":678887,"end":720971,"audio":false},{"filename":"/assets/font/monogram_extended_custom_credits.txt","crunched":0,"start":720971,"end":721390,"audio":false},{"filename":"/assets/font/shinonome_12.ttf","crunched":0,"start":721390,"end":2338814,"audio":false},{"filename":"/assets/font/shinonome_14.ttf","crunched":0,"start":2338814,"end":4080030,"audio":false},{"filename":"/assets/font/shinonome_16.ttf","crunched":0,"start":4080030,"end":6034758,"audio":false},{"filename":"/assets/font/shinonome_LICENSE.txt","crunched":0,"start":6034758,"end":6035417,"audio":false},{"filename":"/assets/gamecontrollerdb.txt","crunched":0,"start":6035417,"end":6619440,"audio":false},{"filename":"/assets/ground_particle.png","crunched":0,"start":6619440,"end":6619869,"audio":false},{"filename":"/assets/mkitten_ducking_pixelized.png","crunched":0,"start":6619869,"end":6622626,"audio":false},{"filename":"/assets/mkitten_idle_pixelized.png","crunched":0,"start":6622626,"end":6625760,"audio":false},{"filename":"/assets/mkitten_leap_pixelized.png","crunched":0,"start":6625760,"end":6629265,"audio":false},{"filename":"/assets/mkitten_strong_pixelized.png","crunched":0,"start":6629265,"end":6633934,"audio":false},{"filename":"/assets/mkitten_strong_walk_1_pixelized.png","crunched":0,"start":6633934,"end":6638450,"audio":false},{"filename":"/assets/mkitten_strong_walk_2_pixelized.png","crunched":0,"start":6638450,"end":6643234,"audio":false},{"filename":"/assets/mkitten_walk_1_pixelized.png","crunched":0,"start":6643234,"end":6646441,"audio":false},{"filename":"/assets/mkitten_walk_2_pixelized.png","crunched":0,"start":6646441,"end":6649618,"audio":false},{"filename":"/assets/pixelfont-11p.png","crunched":0,"start":6649618,"end":6651158,"audio":false},{"filename":"/assets/spike.png","crunched":0,"start":6651158,"end":6653806,"audio":false},{"filename":"/assets/star.png","crunched":0,"start":6653806,"end":6655186,"audio":false},{"filename":"/assets/world_tileset.png","crunched":0,"start":6655186,"end":6667840,"audio":false},{"filename":"/level1.lua","crunched":0,"start":6667840,"end":6743244,"audio":false},{"filename":"/main.lua","crunched":0,"start":6743244,"end":6891719,"audio":false},{"filename":"/sti/atlas.lua","crunched":0,"start":6891719,"end":6896094,"audio":false},{"filename":"/sti/graphics.lua","crunched":0,"start":6896094,"end":6898189,"audio":false},{"filename":"/sti/init.lua","crunched":0,"start":6898189,"end":6945270,"audio":false},{"filename":"/sti/plugins/box2d.lua","crunched":0,"start":6945270,"end":6955005,"audio":false},{"filename":"/sti/plugins/bump.lua","crunched":0,"start":6955005,"end":6960782,"audio":false},{"filename":"/sti/sti/atlas.lua","crunched":0,"start":6960782,"end":6965157,"audio":false},{"filename":"/sti/sti/graphics.lua","crunched":0,"start":6965157,"end":6967252,"audio":false},{"filename":"/sti/sti/init.lua","crunched":0,"start":6967252,"end":7014333,"audio":false},{"filename":"/sti/sti/plugins/box2d.lua","crunched":0,"start":7014333,"end":7024068,"audio":false},{"filename":"/sti/sti/plugins/bump.lua","crunched":0,"start":7024068,"end":7029845,"audio":false},{"filename":"/sti/sti/utils.lua","crunched":0,"start":7029845,"end":7034715,"audio":false},{"filename":"/sti/utils.lua","crunched":0,"start":7034715,"end":7039585,"audio":false}]});

})();
