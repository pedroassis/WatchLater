/**
 * Created by Sagar on 23/10/14.
 */
(function() {

var copyObjInPlace = function(from, to) {
  for(var prop in to) {
    delete to[prop];
  }

  for(var prop in from) {
    to[prop] = from[prop];
  }
}

var parsePath = function(path) {
  var slashIndex;
  return {
    ns: path.slice(0, ((slashIndex = path.indexOf('/')) !== -1) ? slashIndex : undefined),
    v: path.slice((slashIndex !== -1)? slashIndex + 1 : undefined)
  }
}

/* phaadArray
   - implements sortedSet on an Array, as angular requires an array for ng-repeat
   - add/remove O(n), can be improved using binary search
   - automatically fetches vertices' properties and adds into the object
   - allows onAdd/onRemove/onChange callbacks.
*/
var phaadArray = function(reverse, callbacks, $timeout, remoteScope, ref) {
  var exports = {};
  var toBeDeleted = {};
  exports.data = [];
  var toBeAdded = 0;
  
  var initialAddCompleted;
  var checkIfComplete = function() {
    if(toBeAdded === 0 && callbacks.onComplete && initialAddCompleted) {
      callbacks.onComplete(remoteScope, ref);
      delete callbacks.onComplete; // so that its called only once
    }
  };
  
  exports.initialAddComplete = function() {
    initialAddCompleted = true;
    checkIfComplete();
  };

  handleAdd = function(name, vObj, addNow) {
    addNow = $timeout.bind(null, addNow);
    var updateScope = $timeout.bind(null, function() {});
    var added;
    vObj.properties = vObj.ref.bindProperties(remoteScope, {
      onProperties: function(scope, newProps) {
        vObj.properties = newProps;
        if(!added) {
          added = true;
          if(callbacks.onAdd) {
            callbacks.onAdd(remoteScope, vObj, vObj.ref, addNow);
          }
          else {
            addNow(); //adds the object into the array
          }
        } else {
          if(callbacks.onChange) {
            callbacks.onChange(remoteScope, vObj, vObj.ref, updateScope);
          }
          else {
            updateScope();// just update the scope, and dont call addNow() which adds a new obj
          }
        }
      }
    });
  }

  handleRemove = function(name, vObj, removeNow) {
    removeNow = $timeout.bind(null, removeNow);
    vObj.ref.unbindProperties();
    if(callbacks.onRemove) {
      callbacks.onRemove(remoteScope, vObj, vObj.ref, removeNow);
    } else {
      removeNow();
    }
  };

  exports.add = function(name, obj) {
    if(toBeDeleted[name] > 0) {
      toBeDeleted[name]--
      return
    }
    toBeAdded += 1;
    var added;
    var addNow = function () {
      var onAdd = function() {        
        added = true;
        toBeAdded -= 1;
        checkIfComplete();
      }
      
      for(var i = 0; i<exports.data.length && !added && obj.priority !== undefined; i++) {
        if(reverse? exports.data[i].priority < obj.priority : exports.data[i].priority < obj.priority) {
          exports.data.splice(i, 0, obj);
          onAdd();
          break;
        }
      }

      if(!added) {
        reverse? exports.data.push(obj) : exports.data.unshift(obj);
        onAdd();
      }

      //checking if delete was called on the name while performing onAdd
      if(toBeDeleted[name] > 0) {
        toBeDeleted[name]--;
        exports.remove(name);
      }
    }

    if(handleAdd) {
      handleAdd(name, obj, addNow);
    } else {
      addNow();
    }
  }

  exports.remove = function(name) {
    var deleted;
    var removeNow = function() {
      for(var j = 0; j < exports.data.length; j++) {
        if(exports.data[j].name === name) {
          exports.data.splice(j ,1);
          break;
        }
      }
    }

    for(var i = 0; i < exports.data.length; i++) {
      if(exports.data[i].name === name) {
        if(handleRemove) {
          handleRemove(name, exports.data[i], removeNow);
        } else {
          removeNow();
        }
        deleted = true;
        break;
      }
    }

    if(!deleted) {
      if(toBeDeleted[name] === undefined)
        toBeDeleted[name] = 0;
      toBeDeleted[name]++;
    }
  }

  return exports;
}

angular.module('ngAppbase',[])
  .factory('$appbase', function($timeout) {
    if(typeof Appbase === 'undefined') {
      throw ("Appbase library is not loaded.");
    } else if (Appbase.ns === undefined) {
      throw ("Wrong version of Appbase library is loaded. Make sure you are using v2.0");
    }
    var $appbase = {};

    //returns an Appbase namespace reference, with injected methods: bindVertices, unbindVertices, unbind
    $appbase.ns = function(namespace) {
      var nsRef = Appbase.ns(namespace);
      var nsRefCopy = Appbase.ns(namespace); // as bind-unbind rely on 'on' methods, they are done on this ref, so that they dont interfere with 'on' methods of the refrence which is returned.
      var callbacks;
      var remoteScope;
      var dataExposed;
      
      nsRef.bindVertices = function(remoteS, cb, reverse) {
        remoteScope = remoteS;
        callbacks = cb || {};
        dataExposed = phaadArray(reverse, callbacks, $timeout, remoteScope, nsRef);
        
        nsRefCopy.on('vertex_added', function(error, vRef) {
          if(error) {
            throw error;
            return;
          }
          var vPath = parsePath(vRef.path()).v;
          var vKey = parsePath(vPath).ns;
          var vObj = { name: vKey, ref: vRefNG(vRef.path())};
          dataExposed.add(vObj.name, vObj);
        }, function() {
          dataExposed.initialAddComplete();
        });

        nsRefCopy.on('vertex_removed',function(error, vRef) {
          if(error) {
            throw error;
            return;
          }
          var vPath = parsePath(vRef.path()).v;
          var vKey = parsePath(vPath).ns;
          dataExposed.remove(vKey);
        })

        remoteScope && remoteScope.$on('$destroy', function() {
          nsRef.unbindVertices();
        })

        return dataExposed.data;
      }

      nsRef.unbindVertices = function() {
        nsRefCopy.off('vertex_added');
        nsRefCopy.off('vertex_removed');
        if(dataExposed && dataExposed.data) while(dataExposed.data.length > 0) {
          var vObj = dataExposed.data[0];
          dataExposed.data.splice(0, 1);
          vObj.ref.unbindProperties();
          callbacks.onUnbind && callbacks.onUnbind(remoteScope, vObj);
        }
      }
      
      nsRef.unbind = nsRef.unbindVertices;
      nsRef.isModified = true;

      return nsRef;
    }

    //returns an Appbase vertex reference, with injected methods: bindProperties, bindEdges, unbindProperties, unbindEdges, unbind
    var vRefNG = function(pathOrRef) {
      var parsed, ref, refCopy;
      if(typeof pathOrRef === 'string') {
        parsed = parsePath(pathOrRef);
        if(!parsed.v) return;
        ref = Appbase.ns(parsed.ns).v(parsed.v); //inject methods on this reference
      } else {
        ref = pathOrRef;
        parsed = parsePath(ref.path());
      }
      refCopy = Appbase.ns(parsed.ns).v(parsed.v);  // as bind-unbind rely on 'on' methods, they are done on this ref, so that they dont interfere with 'on' methods of the refrence which is returned.
      
      var callbacks = {
        properties: {
        }, 
        edges: {
        }
      };
      var remoteScopes = {};
      var dataExposed = {
        properties: {}
      };

      ref.bindProperties = function(remoteScope, cbs) {
        remoteScopes.properties = remoteScope;
        callbacks.properties = cbs || {};
        refCopy.on('properties', function(error, r, vSnap) {
          if(error) {
            throw error;
          }
          
          var newProps = vSnap.properties();
          var done = $timeout.bind(null, copyObjInPlace.bind(null, newProps, dataExposed.properties));
          if(callbacks.properties.onProperties) {
            callbacks.properties.onProperties(remoteScope, newProps, ref, done);
          } else {
            done();
          }
        });

        remoteScope && remoteScope.$on('$destroy', function() {
          ref.unbindProperties();
        })

        return dataExposed.properties;
      }
      
      ref.unbindProperties = function() {
        refCopy.off('properties');
        callbacks.properties.onUnbind && callbacks.properties.onUnbind(remoteScopes.properties, dataExposed.properties, ref);
      }

      ref.bindEdges = function(remoteScope, cb, reverse) {
        remoteScopes.edges = remoteScope;
        callbacks.edges = cb || {};
        dataExposed.edges = phaadArray(reverse, callbacks.edges, $timeout, remoteScope, ref);
        
        refCopy.on('edge_added',function(error, edgeRef, edgeSnap) {
          if(error) {
            throw error;
            return;
          }
          var vObj = { name: edgeSnap.name(), priority: edgeSnap.priority(), ref: vRefNG(edgeRef.path())};
          dataExposed.edges.add(vObj.name, vObj);
        }, function() {
          dataExposed.edges.initialAddComplete();
        });

        refCopy.on('edge_removed',function(error, edgeRef, edgeSnap) {
          if(error) {
            throw error;
            return;
          }
          dataExposed.edges.remove(edgeSnap.name());
        })

        refCopy.on('edge_changed',function(error, edgeRef, edgeSnap) {
          if(error) {
            throw error;
            return;
          }
          
          dataExposed.edges.remove(edgeSnap.name());
          dataExposed.edges.add(edgeSnap.name(), {name: edgeSnap.name(), priority: edgeSnap.priority() , ref: vRefNG(edgeRef.path())});
        })

        remoteScope && remoteScope.$on('$destroy', function() {
          ref.unbindEdges();
        })

        return dataExposed.edges.data;
      }

      ref.unbindEdges = function() {
        refCopy.off('edge_added');
        refCopy.off('edge_removed');
        refCopy.off('edge_changed');
        while(dataExposed.edges && dataExposed.edges.data.length > 0) {
          var vObj = dataExposed.edges.data[0];
          dataExposed.edges.data.splice(0, 1);
          vObj.ref.unbindProperties();
          callbacks.edges.onUnbind && callbacks.edges.onUnbind(remoteScopes.edges, vObj);
        }
      }
      
      ref.unbind = function() {
        ref.unbindEdges();
        ref.unbindProperties();
      }
      
      ref.isModified = true;
      
      return ref;
    }
    
    for(var methodName in Appbase) {
      if($appbase[methodName] === undefined) {
        $appbase[methodName] = Appbase[methodName];
      }
    }

    // setting vertex method
    Appbase.vRefModifier(vRefNG);
    return $appbase;
  
  })

}());