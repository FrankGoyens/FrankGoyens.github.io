
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
  loadPackage({"package_uuid":"996a8b67-c7ae-45cb-9dde-4fe0413a8854","remote_package_size":7027823,"files":[{"filename":"/assets/.DS_Store","crunched":0,"start":0,"end":8196,"audio":false},{"filename":"/assets/Icons_Controller.png","crunched":0,"start":8196,"end":10482,"audio":false},{"filename":"/assets/MKitten_pixelized.png","crunched":0,"start":10482,"end":13672,"audio":false},{"filename":"/assets/Simple_frame_8.png","crunched":0,"start":13672,"end":19663,"audio":false},{"filename":"/assets/cave_lightmap.png","crunched":0,"start":19663,"end":89335,"audio":false},{"filename":"/assets/cave_lightmap_candle_light.png","crunched":0,"start":89335,"end":97777,"audio":false},{"filename":"/assets/dance_frames/frame1.png","crunched":0,"start":97777,"end":153949,"audio":false},{"filename":"/assets/dance_frames/frame2.png","crunched":0,"start":153949,"end":208938,"audio":false},{"filename":"/assets/dance_frames/frame3.png","crunched":0,"start":208938,"end":265110,"audio":false},{"filename":"/assets/dance_frames/frame4.png","crunched":0,"start":265110,"end":319730,"audio":false},{"filename":"/assets/demo_victory_face.png","crunched":0,"start":319730,"end":384754,"audio":false},{"filename":"/assets/demo_victory_glow.png","crunched":0,"start":384754,"end":418640,"audio":false},{"filename":"/assets/dwarf_miner_sprite_sheet.png","crunched":0,"start":418640,"end":476309,"audio":false},{"filename":"/assets/font/Golden_Apple_LICENSE.txt","crunched":0,"start":476309,"end":480627,"audio":false},{"filename":"/assets/font/comic_neue_13.ttf","crunched":0,"start":480627,"end":537875,"audio":false},{"filename":"/assets/font/comic_neue_bold_19.ttf","crunched":0,"start":537875,"end":593591,"audio":false},{"filename":"/assets/font/earth_illusion.fnt","crunched":0,"start":593591,"end":618077,"audio":false},{"filename":"/assets/font/earth_illusion.png","crunched":0,"start":618077,"end":623493,"audio":false},{"filename":"/assets/font/earth_illusion_LICENSE.txt","crunched":0,"start":623493,"end":627811,"audio":false},{"filename":"/assets/font/golden_apple.fnt","crunched":0,"start":627811,"end":672033,"audio":false},{"filename":"/assets/font/golden_apple.png","crunched":0,"start":672033,"end":678834,"audio":false},{"filename":"/assets/font/monogram_extended_custom.ttf","crunched":0,"start":678834,"end":720918,"audio":false},{"filename":"/assets/font/monogram_extended_custom_credits.txt","crunched":0,"start":720918,"end":721337,"audio":false},{"filename":"/assets/font/shinonome_12.ttf","crunched":0,"start":721337,"end":2338761,"audio":false},{"filename":"/assets/font/shinonome_14.ttf","crunched":0,"start":2338761,"end":4079977,"audio":false},{"filename":"/assets/font/shinonome_16.ttf","crunched":0,"start":4079977,"end":6034705,"audio":false},{"filename":"/assets/font/shinonome_LICENSE.txt","crunched":0,"start":6034705,"end":6035364,"audio":false},{"filename":"/assets/gamecontrollerdb.txt","crunched":0,"start":6035364,"end":6619387,"audio":false},{"filename":"/assets/ground_particle.png","crunched":0,"start":6619387,"end":6619816,"audio":false},{"filename":"/assets/mkitten_idle_pixelized.png","crunched":0,"start":6619816,"end":6622950,"audio":false},{"filename":"/assets/mkitten_leap_pixelized.png","crunched":0,"start":6622950,"end":6626455,"audio":false},{"filename":"/assets/mkitten_strong_pixelized.png","crunched":0,"start":6626455,"end":6631124,"audio":false},{"filename":"/assets/mkitten_strong_walk_1_pixelized.png","crunched":0,"start":6631124,"end":6635640,"audio":false},{"filename":"/assets/mkitten_strong_walk_2_pixelized.png","crunched":0,"start":6635640,"end":6640424,"audio":false},{"filename":"/assets/mkitten_walk_1_pixelized.png","crunched":0,"start":6640424,"end":6643631,"audio":false},{"filename":"/assets/mkitten_walk_2_pixelized.png","crunched":0,"start":6643631,"end":6646808,"audio":false},{"filename":"/assets/pixelfont-11p.png","crunched":0,"start":6646808,"end":6648348,"audio":false},{"filename":"/assets/spike.png","crunched":0,"start":6648348,"end":6650996,"audio":false},{"filename":"/assets/star.png","crunched":0,"start":6650996,"end":6652376,"audio":false},{"filename":"/assets/world_tileset.png","crunched":0,"start":6652376,"end":6665030,"audio":false},{"filename":"/level1.lua","crunched":0,"start":6665030,"end":6738016,"audio":false},{"filename":"/main.lua","crunched":0,"start":6738016,"end":6879957,"audio":false},{"filename":"/sti/atlas.lua","crunched":0,"start":6879957,"end":6884332,"audio":false},{"filename":"/sti/graphics.lua","crunched":0,"start":6884332,"end":6886427,"audio":false},{"filename":"/sti/init.lua","crunched":0,"start":6886427,"end":6933508,"audio":false},{"filename":"/sti/plugins/box2d.lua","crunched":0,"start":6933508,"end":6943243,"audio":false},{"filename":"/sti/plugins/bump.lua","crunched":0,"start":6943243,"end":6949020,"audio":false},{"filename":"/sti/sti/atlas.lua","crunched":0,"start":6949020,"end":6953395,"audio":false},{"filename":"/sti/sti/graphics.lua","crunched":0,"start":6953395,"end":6955490,"audio":false},{"filename":"/sti/sti/init.lua","crunched":0,"start":6955490,"end":7002571,"audio":false},{"filename":"/sti/sti/plugins/box2d.lua","crunched":0,"start":7002571,"end":7012306,"audio":false},{"filename":"/sti/sti/plugins/bump.lua","crunched":0,"start":7012306,"end":7018083,"audio":false},{"filename":"/sti/sti/utils.lua","crunched":0,"start":7018083,"end":7022953,"audio":false},{"filename":"/sti/utils.lua","crunched":0,"start":7022953,"end":7027823,"audio":false}]});

})();
